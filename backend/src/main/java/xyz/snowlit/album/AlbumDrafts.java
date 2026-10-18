package xyz.snowlit.album;

import xyz.snowlit.album.AlbumDtos.AlbumCreateDto;
import xyz.snowlit.album.AlbumDtos.AlbumPhotoMetadataDto;
import xyz.snowlit.album.AlbumVos.AlbumCurrentDraftVo;
import xyz.snowlit.album.AlbumVos.AlbumDraftVo;
import xyz.snowlit.album.AlbumVos.AlbumPhotoVo;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ImageFormat;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ImagePolicy;
import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.text.Text;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Draft albums: a manager creates one draft, fills it with photos, then publishes or discards it.
 */
@Service
public class AlbumDrafts {

    private static final int MAX_PHOTOS = 300;
    private static final int PREVIEW_PHOTO_COUNT = 9;
    private static final Set<String> VISIBILITIES = Set.of("public", "private");
    private static final ImagePolicy ORIGINAL_IMAGE =
            ImagePolicy.standard("ALBUM", "album", false, "相册图片上传失败，请稍后重试");
    private static final ImagePolicy.Rejection PREVIEW_NOT_WEBP =
            new ImagePolicy.Rejection("ALBUM_PREVIEW_TYPE_INVALID", "预览图必须是 WebP");
    private static final ImagePolicy PREVIEW_IMAGE = new ImagePolicy(
            "album",
            false,
            Set.of(ImageFormat.WEBP),
            ImagePolicy.TEN_MEGABYTES,
            PREVIEW_NOT_WEBP,
            PREVIEW_NOT_WEBP,
            ORIGINAL_IMAGE.tooLarge(),
            ORIGINAL_IMAGE.storeFailed()
    );

    private final AlbumMapper albumMapper;
    private final PasswordEncoder passwordEncoder;
    private final ImageIntake images;
    private final Clock clock;

    public AlbumDrafts(AlbumMapper albumMapper, PasswordEncoder passwordEncoder, ImageIntake images, Clock clock) {
        this.albumMapper = albumMapper;
        this.passwordEncoder = passwordEncoder;
        this.images = images;
        this.clock = clock;
    }

    public AlbumCurrentDraftVo currentDraft(AuthenticatedActor actor) {
        requireManager(actor);
        Album draft = albumMapper.findLatestDraftByUserId(actor.userId());
        return new AlbumCurrentDraftVo(draft == null ? null : toDraftVo(draft));
    }

    public AlbumDraftVo createDraft(AuthenticatedActor actor, AlbumCreateDto request) {
        requireManager(actor);
        validateCreateRequest(request);
        if (albumMapper.findLatestDraftByUserId(actor.userId()) != null) {
            throw ApplicationFailure.conflict("ALBUM_DRAFT_EXISTS", "已有未发布相册草稿，请继续上传或取消草稿");
        }

        Album album = new Album();
        album.setTitle(Text.trim(request.title()));
        album.setDescription(Text.trim(request.description()));
        album.setCoverPhotoUrl("");
        album.setAuthorName(actor.displayName());
        album.setCreatedAt(LocalDateTime.now(clock));
        album.setEventDate(request.eventDate());
        album.setLocation(Albums.locationOrEarth(request.location()));
        album.setViewCount(0);
        album.setLikeCount(0);
        album.setVisibility(Text.trim(request.visibility()));
        album.setPrivatePasswordHash(privatePasswordHash(request));
        album.setPinned(Boolean.TRUE.equals(request.pinned()));
        album.setSortOrder(Boolean.TRUE.equals(request.pinned()) ? 10 : 100);
        album.setStatus("draft");
        album.setCreatedByUserId(actor.userId());
        albumMapper.insertAlbum(album);
        return toDraftVo(album);
    }

    /**
     * Web upload: an original plus a client-generated WebP preview.
     */
    public AlbumPhotoVo uploadPhoto(
            AuthenticatedActor actor,
            Long albumId,
            MultipartFile original,
            MultipartFile preview,
            AlbumPhotoMetadataDto metadata
    ) {
        return addPhoto(actor, albumId, original, preview, PREVIEW_IMAGE, metadata);
    }

    /**
     * Mini-program upload: one file stored as both original and preview.
     */
    public AlbumPhotoVo uploadMobilePhoto(
            AuthenticatedActor actor,
            Long albumId,
            MultipartFile file,
            AlbumPhotoMetadataDto metadata
    ) {
        return addPhoto(actor, albumId, file, file, ORIGINAL_IMAGE, metadata);
    }

    public AlbumDraftVo publish(AuthenticatedActor actor, Long albumId) {
        requireManager(actor);
        Album draft = requireOwnedDraft(albumId, actor.userId());
        int photoCount = albumMapper.countPhotosByAlbumId(draft.getId());
        if (photoCount < 1) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_REQUIRED", "发布相册前至少上传 1 张照片");
        }
        if (photoCount > MAX_PHOTOS) {
            throw photoLimitExceeded();
        }
        String coverPhotoUrl = draft.getCoverPhotoUrl().isBlank()
                ? albumMapper.findFirstPhotoByAlbumId(draft.getId()).getPreviewUrl()
                : draft.getCoverPhotoUrl();
        albumMapper.publishAlbum(draft.getId(), coverPhotoUrl, LocalDateTime.now(clock));
        return toDraftVo(Albums.require(albumMapper, draft.getId()));
    }

    public void discard(AuthenticatedActor actor, Long albumId) {
        requireManager(actor);
        Album draft = requireOwnedDraft(albumId, actor.userId());
        albumMapper.findPhotosByAlbumId(draft.getId()).forEach(photo -> {
            images.deleteBestEffort(photo.getOriginalObjectName());
            images.deleteBestEffort(photo.getPreviewObjectName());
        });
        albumMapper.deleteAlbumById(draft.getId());
    }

    private AlbumPhotoVo addPhoto(
            AuthenticatedActor actor,
            Long albumId,
            MultipartFile original,
            MultipartFile preview,
            ImagePolicy previewPolicy,
            AlbumPhotoMetadataDto metadata
    ) {
        requireManager(actor);
        Album album = requireOwnedDraft(albumId, actor.userId());
        validatePhotoMetadata(metadata);
        images.verify(original, ORIGINAL_IMAGE);
        images.verify(preview, previewPolicy);
        if (albumMapper.countPhotosByAlbumId(album.getId()) >= MAX_PHOTOS) {
            throw photoLimitExceeded();
        }

        ObjectStore.StoredObject originalAsset =
                images.store(original, ORIGINAL_IMAGE, album.getId(), "original", actor.userId());
        ObjectStore.StoredObject previewAsset;
        try {
            previewAsset = images.store(preview, previewPolicy, album.getId(), "preview", actor.userId());
        } catch (RuntimeException ex) {
            images.deleteBestEffort(originalAsset.objectName());
            throw ex;
        }

        AlbumPhoto photo = new AlbumPhoto();
        photo.setAlbumId(album.getId());
        photo.setCaption(captionOrUntitled(metadata.caption()));
        photo.setDescription("");
        photo.setTakenAt(metadata.takenAt());
        photo.setLocation(Albums.locationOrEarth(metadata.location()));
        photo.setSortOrder(metadata.sortOrder() == null ? 100 : metadata.sortOrder());
        photo.setWidth(metadata.width());
        photo.setHeight(metadata.height());
        photo.setOriginalUrl(originalAsset.url());
        photo.setOriginalObjectName(originalAsset.objectName());
        photo.setOriginalContentType(originalAsset.contentType());
        photo.setOriginalSizeBytes(originalAsset.sizeBytes());
        photo.setPreviewUrl(previewAsset.url());
        photo.setPreviewObjectName(previewAsset.objectName());
        photo.setPreviewContentType(previewAsset.contentType());
        photo.setPreviewSizeBytes(previewAsset.sizeBytes());
        albumMapper.insertPhoto(photo);
        return Albums.toPhotoVo(albumMapper.findPhotoById(photo.getId()));
    }

    private AlbumDraftVo toDraftVo(Album album) {
        List<AlbumPhotoVo> photos = albumMapper.findPhotosByAlbumId(album.getId()).stream()
                .map(Albums::toPhotoVo)
                .toList();
        return new AlbumDraftVo(
                Albums.toAlbumVo(album, false, photos.stream().limit(PREVIEW_PHOTO_COUNT).toList(), false),
                photos
        );
    }

    private Album requireOwnedDraft(Long albumId, Long userId) {
        Album album = Albums.require(albumMapper, albumId);
        if (!"draft".equals(album.getStatus()) || !userId.equals(album.getCreatedByUserId())) {
            throw ApplicationFailure.notFound("ALBUM_DRAFT_NOT_FOUND", "相册草稿不存在");
        }
        return album;
    }

    private void requireManager(AuthenticatedActor actor) {
        actor.requireManager("ALBUM_FORBIDDEN", "只有站点主人可以管理相册");
    }

    private void validateCreateRequest(AlbumCreateDto request) {
        if (Text.trim(request.title()).isBlank()) {
            throw ApplicationFailure.invalidInput("ALBUM_TITLE_REQUIRED", "相册标题不能为空");
        }
        if (request.eventDate() == null) {
            throw ApplicationFailure.invalidInput("ALBUM_EVENT_DATE_REQUIRED", "相册日期不能为空");
        }
        String visibility = Text.trim(request.visibility());
        if (!VISIBILITIES.contains(visibility)) {
            throw ApplicationFailure.invalidInput("ALBUM_VISIBILITY_INVALID", "相册可见性不正确");
        }
        if ("private".equals(visibility) && Text.trim(request.privatePassword()).isBlank()) {
            throw ApplicationFailure.invalidInput("ALBUM_PRIVATE_PASSWORD_REQUIRED", "私密相册密码不能为空");
        }
    }

    private String privatePasswordHash(AlbumCreateDto request) {
        if (!"private".equals(Text.trim(request.visibility()))) {
            return null;
        }
        return passwordEncoder.encode(Text.trim(request.privatePassword()));
    }

    private static void validatePhotoMetadata(AlbumPhotoMetadataDto metadata) {
        if (metadata.takenAt() == null || metadata.width() == null || metadata.height() == null
                || metadata.width() < 1 || metadata.height() < 1) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确");
        }
    }

    private static String captionOrUntitled(String value) {
        String cleaned = Text.trim(value);
        return cleaned.isBlank() ? "未命名照片" : cleaned;
    }

    private static ApplicationFailure photoLimitExceeded() {
        return ApplicationFailure.invalidInput("ALBUM_PHOTO_LIMIT_EXCEEDED", "每本相册最多 300 张照片");
    }
}
