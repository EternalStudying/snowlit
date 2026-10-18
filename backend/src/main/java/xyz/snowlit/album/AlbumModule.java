package xyz.snowlit.album;

import xyz.snowlit.album.AlbumDtos.AlbumCreateDto;
import xyz.snowlit.album.AlbumDtos.AlbumPhotoMetadataDto;
import xyz.snowlit.album.AlbumDtos.AlbumUnlockDto;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.auth.SiteManagerPolicy;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ImageFormat;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ImagePolicy;
import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.text.Text;
import xyz.snowlit.album.AlbumVos.AlbumCurrentDraftVo;
import xyz.snowlit.album.AlbumVos.AlbumDetailVo;
import xyz.snowlit.album.AlbumVos.AlbumDraftVo;
import xyz.snowlit.album.AlbumVos.AlbumLikeVo;
import xyz.snowlit.album.AlbumVos.AlbumPageVo;
import xyz.snowlit.album.AlbumVos.AlbumPhotoVo;
import xyz.snowlit.album.AlbumVos.AlbumUnlockVo;
import xyz.snowlit.album.AlbumVos.AlbumViewVo;
import xyz.snowlit.album.AlbumVos.AlbumVo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class AlbumModule {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlbumModule.class);
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_SIZE = 5;
    private static final int MAX_SIZE = 20;
    private static final int DEFAULT_PREVIEW_LIMIT = 9;
    private static final int MAX_PREVIEW_LIMIT = 9;
    private static final int MAX_UNLOCK_FAILURES = 5;
    private static final int MAX_PHOTOS = 300;
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
    private static final Duration PRIVATE_TOKEN_TTL = Duration.ofHours(1);
    private static final Duration UNLOCK_LOCK_DURATION = Duration.ofMinutes(10);
    private static final ZoneOffset ACTIVITY_ZONE = ZoneOffset.UTC;
    private static final Set<String> VISIBILITIES = Set.of("public", "private");

    private final AlbumMapper albumMapper;
    private final PasswordEncoder passwordEncoder;
    private final AlbumPrivateAccessTokenStore tokenStore;
    private final ImageIntake images;
    private final Clock clock;

    @Autowired
    public AlbumModule(
            AlbumMapper albumMapper,
            PasswordEncoder passwordEncoder,
            AlbumPrivateAccessTokenStore tokenStore,
            ImageIntake images
    ) {
        this(albumMapper, passwordEncoder, tokenStore, images, Clock.systemDefaultZone());
    }

    AlbumModule(
            AlbumMapper albumMapper,
            PasswordEncoder passwordEncoder,
            AlbumPrivateAccessTokenStore tokenStore,
            ImageIntake images,
            Clock clock
    ) {
        this.albumMapper = albumMapper;
        this.passwordEncoder = passwordEncoder;
        this.tokenStore = tokenStore;
        this.images = images;
        this.clock = clock;
    }

    public AlbumPageVo listAlbums(AuthenticatedActor actor, Integer page, Integer size, Integer previewLimit) {
        int resolvedPage = clampPage(page);
        int resolvedSize = clampSize(size);
        int resolvedPreviewLimit = clampPreviewLimit(previewLimit);
        int offset = (resolvedPage - 1) * resolvedSize;
        long total = albumMapper.countPublishedAlbums();
        List<Album> albums = albumMapper.findPublishedAlbums(offset, resolvedSize);
        List<Long> albumIds = albums.stream().map(Album::getId).toList();
        Set<Long> likedAlbumIds = findActiveLikedAlbumIds(actor.userId(), albumIds);
        List<AlbumVo> items = albums.stream()
                .map(album -> toAlbumVo(album, isPrivate(album), previewPhotos(album, resolvedPreviewLimit), likedAlbumIds.contains(album.getId())))
                .toList();
        boolean hasMore = (long) resolvedPage * resolvedSize < total;
        return new AlbumPageVo(items, total, resolvedPage, resolvedSize, hasMore, SiteManagerPolicy.canManage(actor.userId()));
    }

    public AlbumDetailVo getAlbumDetail(AuthenticatedActor actor, Long albumId, String privateAccessToken) {
        Album album = requirePublishedAlbum(albumId);
        if (isPrivate(album)) {
            requirePrivateAccess(album, actor.userId(), privateAccessToken);
        }
        List<AlbumPhotoVo> photos = albumMapper.findPhotosByAlbumId(album.getId()).stream()
                .map(this::toPhotoVo)
                .toList();
        return new AlbumDetailVo(toAlbumVo(album, false, List.of(), isLikedToday(album.getId(), actor.userId())), photos);
    }

    public AlbumUnlockVo unlockAlbum(AuthenticatedActor actor, Long albumId, AlbumUnlockDto request) {
        Album album = requireAlbum(albumId);
        if (!isPrivate(album)) {
            throw ApplicationFailure.invalidInput("ALBUM_NOT_PRIVATE", "相册不是私密相册");
        }

        LocalDateTime now = now();
        AlbumUnlockFailure failure = albumMapper.findUnlockFailure(album.getId(), actor.userId());
        if (failure != null && failure.getLockedUntil() != null && failure.getLockedUntil().isAfter(now)) {
            LOGGER.warn("Private album unlock blocked: userId={}, albumId={}, lockedUntil={}",
                    actor.userId(), album.getId(), failure.getLockedUntil());
            throw ApplicationFailure.locked("PRIVATE_ALBUM_UNLOCK_LOCKED", "密码错误次数过多，请 10 分钟后再试");
        }

        String password = Objects.requireNonNullElse(request.password(), "");
        if (!passwordEncoder.matches(password, album.getPrivatePasswordHash())) {
            int previousFailures = failure == null || failure.getLockedUntil() != null && !failure.getLockedUntil().isAfter(now)
                    ? 0
                    : failure.getFailureCount();
            int nextFailures = previousFailures + 1;
            LocalDateTime lockedUntil = nextFailures >= MAX_UNLOCK_FAILURES ? now.plus(UNLOCK_LOCK_DURATION) : null;
            albumMapper.recordUnlockFailure(album.getId(), actor.userId(), nextFailures, lockedUntil, now, now);
            LOGGER.warn("Private album unlock failed: userId={}, albumId={}, failureCount={}, locked={}",
                    actor.userId(), album.getId(), nextFailures, lockedUntil != null);
            if (lockedUntil != null) {
                throw ApplicationFailure.locked("PRIVATE_ALBUM_UNLOCK_LOCKED", "密码错误次数过多，请 10 分钟后再试");
            }
            throw ApplicationFailure.invalidInput("PRIVATE_ALBUM_PASSWORD_INVALID", "私密相册密码不正确");
        }

        albumMapper.clearUnlockFailure(album.getId(), actor.userId());
        LocalDateTime expiresAt = now.plus(PRIVATE_TOKEN_TTL);
        AlbumPrivateAccessTokenStore.CreatedToken created =
                tokenStore.create(album.getId(), actor.userId(), PRIVATE_TOKEN_TTL, expiresAt);
        return new AlbumUnlockVo(created.token(), created.expiresAt());
    }

    @Transactional
    public AlbumLikeVo likeAlbum(AuthenticatedActor actor, Long albumId) {
        requirePublishedAlbum(albumId);
        LocalDate today = todayForActivity();
        albumMapper.toggleDailyLike(albumId, actor.userId(), today, nowForActivity());
        boolean likedToday = albumMapper.findDailyLikeActive(albumId, actor.userId(), today);
        if (likedToday) {
            albumMapper.incrementLike(albumId);
        } else {
            albumMapper.decrementLike(albumId);
        }
        return new AlbumLikeVo(albumId, requirePublishedAlbum(albumId).getLikeCount(), likedToday);
    }

    @Transactional
    public AlbumViewVo recordAlbumView(AuthenticatedActor actor, Long albumId, String privateAccessToken) {
        Album album = requirePublishedAlbum(albumId);
        if (isPrivate(album)) {
            requirePrivateAccess(album, actor.userId(), privateAccessToken);
        }

        LocalDate today = todayForActivity();
        LocalDateTime now = nowForActivity();
        boolean counted = albumMapper.insertDailyView(albumId, actor.userId(), today, now) == 1
                || albumMapper.markDailyViewed(albumId, actor.userId(), today, now) == 1;
        if (counted) {
            albumMapper.incrementView(albumId);
        }
        return new AlbumViewVo(albumId, requirePublishedAlbum(albumId).getViewCount(), counted);
    }

    public AlbumCurrentDraftVo currentDraft(AuthenticatedActor actor) {
        requireManager(actor);
        Album draft = albumMapper.findLatestDraftByUserId(actor.userId());
        if (draft == null) {
            return new AlbumCurrentDraftVo(null);
        }
        return new AlbumCurrentDraftVo(toDraftVo(draft));
    }

    public AlbumDraftVo createDraft(AuthenticatedActor actor, AlbumCreateDto request) {
        requireManager(actor);
        validateCreateRequest(request);
        if (albumMapper.findLatestDraftByUserId(actor.userId()) != null) {
            throw ApplicationFailure.conflict("ALBUM_DRAFT_EXISTS", "已有未发布相册草稿，请继续上传或取消草稿");
        }

        LocalDateTime now = now();
        Album album = new Album();
        album.setTitle(Text.trim(request.title()));
        album.setDescription(Text.trim(request.description()));
        album.setCoverPhotoUrl("");
        album.setAuthorName(actor.displayName());
        album.setCreatedAt(now);
        album.setEventDate(request.eventDate());
        album.setLocation(defaultLocation(request.location()));
        album.setViewCount(0);
        album.setLikeCount(0);
        album.setVisibility(Text.trim(request.visibility()));
        album.setPrivatePasswordHash(privatePasswordHash(request));
        album.setPinned(Boolean.TRUE.equals(request.pinned()));
        album.setSortOrder(Boolean.TRUE.equals(request.pinned()) ? 10 : 100);
        album.setStatus("draft");
        album.setPublishedAt(null);
        album.setCreatedByUserId(actor.userId());
        albumMapper.insertAlbum(album);
        return toDraftVo(album);
    }

    public AlbumPhotoVo uploadDraftPhoto(
            AuthenticatedActor actor,
            Long albumId,
            MultipartFile original,
            MultipartFile preview,
            AlbumPhotoMetadataDto metadata
    ) {
        return uploadPhoto(actor, albumId, original, preview, PREVIEW_IMAGE, metadata);
    }

    public AlbumPhotoVo uploadDraftPhotoFromMobile(
            AuthenticatedActor actor,
            Long albumId,
            MultipartFile file,
            AlbumPhotoMetadataDto metadata
    ) {
        return uploadPhoto(actor, albumId, file, file, ORIGINAL_IMAGE, metadata);
    }

    private AlbumPhotoVo uploadPhoto(
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
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_LIMIT_EXCEEDED", "每本相册最多 300 张照片");
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

        return storeUploadedPhoto(album, metadata, originalAsset, previewAsset);
    }

    private AlbumPhotoVo storeUploadedPhoto(
            Album album,
            AlbumPhotoMetadataDto metadata,
            ObjectStore.StoredObject originalAsset,
            ObjectStore.StoredObject previewAsset
    ) {
        AlbumPhoto photo = new AlbumPhoto();
        photo.setAlbumId(album.getId());
        photo.setCaption(defaultCaption(metadata.caption()));
        photo.setDescription("");
        photo.setTakenAt(metadata.takenAt());
        photo.setLocation(defaultLocation(metadata.location()));
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
        return toPhotoVo(albumMapper.findPhotoById(photo.getId()));
    }

    public AlbumDraftVo publishDraft(AuthenticatedActor actor, Long albumId) {
        requireManager(actor);
        Album draft = requireOwnedDraft(albumId, actor.userId());
        int photoCount = albumMapper.countPhotosByAlbumId(draft.getId());
        if (photoCount < 1) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_REQUIRED", "发布相册前至少上传 1 张照片");
        }
        if (photoCount > MAX_PHOTOS) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_LIMIT_EXCEEDED", "每本相册最多 300 张照片");
        }
        AlbumPhoto firstPhoto = albumMapper.findFirstPhotoByAlbumId(draft.getId());
        String coverPhotoUrl = draft.getCoverPhotoUrl().isBlank()
                ? firstPhoto.getPreviewUrl()
                : draft.getCoverPhotoUrl();
        albumMapper.publishAlbum(draft.getId(), coverPhotoUrl, now());
        Album published = requireAlbum(draft.getId());
        return toDraftVo(published);
    }

    public void cancelDraft(AuthenticatedActor actor, Long albumId) {
        requireManager(actor);
        Album draft = requireOwnedDraft(albumId, actor.userId());
        albumMapper.findPhotosByAlbumId(draft.getId()).forEach(photo -> {
            images.deleteBestEffort(photo.getOriginalObjectName());
            images.deleteBestEffort(photo.getPreviewObjectName());
        });
        albumMapper.deleteAlbumById(draft.getId());
    }

    private Album requireAlbum(Long albumId) {
        Album album = albumMapper.findAlbumById(albumId);
        if (album == null) {
            throw ApplicationFailure.notFound("ALBUM_NOT_FOUND", "相册不存在");
        }
        return album;
    }

    private Album requirePublishedAlbum(Long albumId) {
        Album album = requireAlbum(albumId);
        if (!"published".equals(album.getStatus())) {
            throw ApplicationFailure.notFound("ALBUM_NOT_FOUND", "相册不存在");
        }
        return album;
    }

    private void requireManager(AuthenticatedActor actor) {
        if (!SiteManagerPolicy.canManage(actor.userId())) {
            throw ApplicationFailure.forbidden("ALBUM_FORBIDDEN", "只有站点主人可以管理相册");
        }
    }

    private Album requireOwnedDraft(Long albumId, Long userId) {
        Album album = requireAlbum(albumId);
        if (!"draft".equals(album.getStatus()) || !userId.equals(album.getCreatedByUserId())) {
            throw ApplicationFailure.notFound("ALBUM_DRAFT_NOT_FOUND", "相册草稿不存在");
        }
        return album;
    }

    private void requirePrivateAccess(Album album, Long userId, String token) {
        if (token == null || token.isBlank()) {
            throw ApplicationFailure.forbidden("PRIVATE_ALBUM_LOCKED", "请输入私密相册密码");
        }
        AlbumPrivateAccessTokenStore.ValidationStatus status = tokenStore.validate(token, album.getId(), userId);
        if (status == AlbumPrivateAccessTokenStore.ValidationStatus.VALID) {
            return;
        }
        if (status == AlbumPrivateAccessTokenStore.ValidationStatus.EXPIRED) {
            throw ApplicationFailure.forbidden("PRIVATE_ALBUM_TOKEN_EXPIRED", "私密相册访问已过期，请重新输入密码");
        }
        throw ApplicationFailure.forbidden("PRIVATE_ALBUM_TOKEN_INVALID", "私密相册访问无效，请重新输入密码");
    }

    private AlbumVo toAlbumVo(Album album, boolean locked, List<AlbumPhotoVo> previewPhotos, boolean likedToday) {
        if (locked) {
            return new AlbumVo(
                    album.getId(),
                    "锁定专辑",
                    "已锁定",
                    "/album-assets/private-locked-cover.png",
                    "",
                    album.getCreatedAt(),
                    album.getEventDate(),
                    "地球",
                    album.getPhotoCount(),
                    album.getViewCount(),
                    album.getLikeCount(),
                    likedToday,
                    album.getVisibility(),
                    true,
                    album.isPinned(),
                    album.getSortOrder(),
                    List.of()
            );
        }
        return new AlbumVo(
                album.getId(),
                album.getTitle(),
                album.getDescription(),
                album.getCoverPhotoUrl(),
                album.getAuthorName(),
                album.getCreatedAt(),
                album.getEventDate(),
                album.getLocation(),
                album.getPhotoCount(),
                album.getViewCount(),
                album.getLikeCount(),
                likedToday,
                album.getVisibility(),
                false,
                album.isPinned(),
                album.getSortOrder(),
                previewPhotos
        );
    }

    private List<AlbumPhotoVo> previewPhotos(Album album, int previewLimit) {
        if (isPrivate(album)) {
            return List.of();
        }
        return albumMapper.findPreviewPhotos(album.getId(), previewLimit).stream()
                .map(this::toPhotoVo)
                .toList();
    }

    private AlbumPhotoVo toPhotoVo(AlbumPhoto photo) {
        return new AlbumPhotoVo(
                photo.getId(),
                photo.getAlbumId(),
                photo.getPreviewUrl(),
                Text.trim(photo.getOriginalUrl()),
                photo.getCaption(),
                photo.getDescription(),
                photo.getTakenAt(),
                photo.getLocation(),
                photo.getSortOrder(),
                photo.getWidth(),
                photo.getHeight()
        );
    }

    private AlbumDraftVo toDraftVo(Album album) {
        List<AlbumPhotoVo> photos = albumMapper.findPhotosByAlbumId(album.getId()).stream()
                .map(this::toPhotoVo)
                .toList();
        return new AlbumDraftVo(toAlbumVo(album, false, photos.stream().limit(MAX_PREVIEW_LIMIT).toList(), false), photos);
    }

    private Set<Long> findActiveLikedAlbumIds(Long userId, List<Long> albumIds) {
        if (albumIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(albumMapper.findActiveDailyLikeAlbumIds(userId, todayForActivity(), albumIds));
    }

    private boolean isLikedToday(Long albumId, Long userId) {
        return Boolean.TRUE.equals(albumMapper.findDailyLikeActive(albumId, userId, todayForActivity()));
    }

    private boolean isPrivate(Album album) {
        return "private".equals(album.getVisibility());
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

    private void validatePhotoMetadata(AlbumPhotoMetadataDto metadata) {
        if (metadata.takenAt() == null || metadata.width() == null || metadata.height() == null
                || metadata.width() < 1 || metadata.height() < 1) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确");
        }
    }


    private String defaultLocation(String value) {
        String cleaned = Text.trim(value);
        return cleaned.isBlank() ? "地球" : cleaned;
    }

    private String defaultCaption(String value) {
        String cleaned = Text.trim(value);
        return cleaned.isBlank() ? "未命名照片" : cleaned;
    }

    private int clampPage(Integer page) {
        return page == null || page < 1 ? DEFAULT_PAGE : page;
    }

    private int clampSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    private int clampPreviewLimit(Integer previewLimit) {
        if (previewLimit == null || previewLimit < 1) {
            return DEFAULT_PREVIEW_LIMIT;
        }
        return Math.min(previewLimit, MAX_PREVIEW_LIMIT);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private LocalDate todayForActivity() {
        return LocalDate.now(clock.withZone(ACTIVITY_ZONE));
    }

    private LocalDateTime nowForActivity() {
        return LocalDateTime.now(clock.withZone(ACTIVITY_ZONE));
    }
}
