package xyz.snowlit.album;

import xyz.snowlit.album.AlbumDtos.AlbumCreateDto;
import xyz.snowlit.album.AlbumDtos.AlbumPhotoMetadataDto;
import xyz.snowlit.album.AlbumDtos.AlbumUnlockDto;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.auth.SiteManagerPolicy;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectStore;
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

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
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
    private static final long MAX_ORIGINAL_SIZE = 10L * 1024L * 1024L;
    private static final Duration PRIVATE_TOKEN_TTL = Duration.ofHours(1);
    private static final Duration UNLOCK_LOCK_DURATION = Duration.ofMinutes(10);
    private static final ZoneOffset ACTIVITY_ZONE = ZoneOffset.UTC;
    private static final Set<String> VISIBILITIES = Set.of("public", "private");
    private static final Set<String> ORIGINAL_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> IMAGE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");

    private final AlbumMapper albumMapper;
    private final PasswordEncoder passwordEncoder;
    private final AlbumPrivateAccessTokenStore tokenStore;
    private final AlbumAssets albumAssetStorageService;
    private final Clock clock;

    @Autowired
    public AlbumModule(
            AlbumMapper albumMapper,
            PasswordEncoder passwordEncoder,
            AlbumPrivateAccessTokenStore tokenStore,
            AlbumAssets albumAssetStorageService
    ) {
        this(albumMapper, passwordEncoder, tokenStore, albumAssetStorageService, Clock.systemDefaultZone());
    }

    AlbumModule(
            AlbumMapper albumMapper,
            PasswordEncoder passwordEncoder,
            AlbumPrivateAccessTokenStore tokenStore,
            AlbumAssets albumAssetStorageService,
            Clock clock
    ) {
        this.albumMapper = albumMapper;
        this.passwordEncoder = passwordEncoder;
        this.tokenStore = tokenStore;
        this.albumAssetStorageService = albumAssetStorageService;
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

        String password = request == null || request.password() == null ? "" : request.password();
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
        LocalDate likeDate = todayForActivity();
        LocalDateTime timestamp = nowForActivity();
        Boolean active = albumMapper.findDailyLikeActive(albumId, actor.userId(), likeDate);
        boolean likedToday;
        if (active == null) {
            int inserted = albumMapper.insertDailyLike(albumId, actor.userId(), likeDate, timestamp, timestamp);
            if (inserted > 0) {
                albumMapper.incrementLike(albumId);
                likedToday = true;
            } else {
                likedToday = Boolean.TRUE.equals(albumMapper.findDailyLikeActive(albumId, actor.userId(), likeDate));
            }
        } else if (Boolean.TRUE.equals(active)) {
            int updated = albumMapper.updateDailyLikeActive(albumId, actor.userId(), likeDate, false, timestamp);
            if (updated > 0) {
                albumMapper.decrementLike(albumId);
                likedToday = false;
            } else {
                likedToday = Boolean.TRUE.equals(albumMapper.findDailyLikeActive(albumId, actor.userId(), likeDate));
            }
        } else {
            int updated = albumMapper.updateDailyLikeActive(albumId, actor.userId(), likeDate, true, timestamp);
            if (updated > 0) {
                albumMapper.incrementLike(albumId);
                likedToday = true;
            } else {
                likedToday = Boolean.TRUE.equals(albumMapper.findDailyLikeActive(albumId, actor.userId(), likeDate));
            }
        }
        Album updated = requirePublishedAlbum(albumId);
        return new AlbumLikeVo(albumId, updated.getLikeCount(), likedToday);
    }

    public AlbumViewVo recordAlbumView(AuthenticatedActor actor, Long albumId, String privateAccessToken) {
        Album album = requirePublishedAlbum(albumId);
        if (isPrivate(album)) {
            requirePrivateAccess(album, actor.userId(), privateAccessToken);
        }

        LocalDate viewDate = todayForActivity();
        boolean counted = false;
        if (albumMapper.findDailyViewId(albumId, actor.userId(), viewDate) == null) {
            int inserted = albumMapper.insertDailyView(albumId, actor.userId(), viewDate, nowForActivity());
            if (inserted > 0) {
                albumMapper.incrementView(albumId);
                counted = true;
            }
        }
        Album updated = requirePublishedAlbum(albumId);
        return new AlbumViewVo(albumId, updated.getViewCount(), counted);
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
        album.setTitle(clean(request.title()));
        album.setDescription(clean(request.description()));
        album.setCoverPhotoUrl("");
        album.setAuthorName(actor.displayName());
        album.setCreatedAt(now);
        album.setEventDate(request.eventDate());
        album.setLocation(defaultLocation(request.location()));
        album.setViewCount(0);
        album.setLikeCount(0);
        album.setVisibility(clean(request.visibility()));
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
        requireManager(actor);
        Album album = requireOwnedDraft(albumId, actor.userId());
        validatePhotoUpload(original, preview, metadata);
        if (albumMapper.countPhotosByAlbumId(album.getId()) >= MAX_PHOTOS) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_LIMIT_EXCEEDED", "每本相册最多 300 张照片");
        }

        ObjectStore.StoredObject originalAsset =
                albumAssetStorageService.uploadOriginal(original, album.getId(), actor.userId());
        ObjectStore.StoredObject previewAsset;
        try {
            previewAsset = albumAssetStorageService.uploadPreview(preview, album.getId(), actor.userId());
        } catch (RuntimeException ex) {
            albumAssetStorageService.deleteBestEffort(originalAsset.objectName());
            throw ex;
        }

        return storeUploadedPhoto(album, metadata, originalAsset, previewAsset);
    }

    public AlbumPhotoVo uploadDraftPhotoFromMobile(
            AuthenticatedActor actor,
            Long albumId,
            MultipartFile file,
            AlbumPhotoMetadataDto metadata
    ) {
        requireManager(actor);
        Album album = requireOwnedDraft(albumId, actor.userId());
        validateMobilePhotoUpload(file, metadata);
        if (albumMapper.countPhotosByAlbumId(album.getId()) >= MAX_PHOTOS) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_LIMIT_EXCEEDED", "每本相册最多 300 张照片");
        }

        ObjectStore.StoredObject originalAsset =
                albumAssetStorageService.uploadOriginal(file, album.getId(), actor.userId());
        ObjectStore.StoredObject previewAsset;
        try {
            previewAsset = albumAssetStorageService.uploadPreview(file, album.getId(), actor.userId());
        } catch (RuntimeException ex) {
            albumAssetStorageService.deleteBestEffort(originalAsset.objectName());
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
        AlbumPhoto saved = photo.getId() == null ? photo : albumMapper.findPhotoById(photo.getId());
        return toPhotoVo(saved == null ? photo : saved);
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
        String coverPhotoUrl = clean(draft.getCoverPhotoUrl()).isBlank() && firstPhoto != null
                ? photoPreviewUrl(firstPhoto)
                : draft.getCoverPhotoUrl();
        albumMapper.publishAlbum(draft.getId(), coverPhotoUrl, now());
        Album published = requireAlbum(draft.getId());
        return toDraftVo(published);
    }

    public void cancelDraft(AuthenticatedActor actor, Long albumId) {
        requireManager(actor);
        Album draft = requireOwnedDraft(albumId, actor.userId());
        albumMapper.findPhotosByAlbumId(draft.getId()).forEach(photo -> {
            albumAssetStorageService.deleteBestEffort(photo.getOriginalObjectName());
            albumAssetStorageService.deleteBestEffort(photo.getPreviewObjectName());
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
                photoPreviewUrl(photo),
                clean(photo.getOriginalUrl()),
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
        List<AlbumPhotoVo> photos = album.getId() == null
                ? List.of()
                : albumMapper.findPhotosByAlbumId(album.getId()).stream().map(this::toPhotoVo).toList();
        return new AlbumDraftVo(toAlbumVo(album, false, photos.stream().limit(MAX_PREVIEW_LIMIT).toList(), false), photos);
    }

    private Set<Long> findActiveLikedAlbumIds(Long userId, List<Long> albumIds) {
        if (albumIds.isEmpty()) {
            return Set.of();
        }
        List<Long> likedAlbumIds = albumMapper.findActiveDailyLikeAlbumIds(userId, todayForActivity(), albumIds);
        if (likedAlbumIds == null || likedAlbumIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(likedAlbumIds);
    }

    private boolean isLikedToday(Long albumId, Long userId) {
        return Boolean.TRUE.equals(albumMapper.findDailyLikeActive(albumId, userId, todayForActivity()));
    }

    private boolean isPrivate(Album album) {
        return "private".equals(album.getVisibility());
    }

    private void validateCreateRequest(AlbumCreateDto request) {
        if (request == null) {
            throw ApplicationFailure.invalidInput("ALBUM_REQUEST_INVALID", "相册内容不正确");
        }
        if (clean(request.title()).isBlank()) {
            throw ApplicationFailure.invalidInput("ALBUM_TITLE_REQUIRED", "相册标题不能为空");
        }
        if (request.eventDate() == null) {
            throw ApplicationFailure.invalidInput("ALBUM_EVENT_DATE_REQUIRED", "相册日期不能为空");
        }
        String visibility = clean(request.visibility());
        if (!VISIBILITIES.contains(visibility)) {
            throw ApplicationFailure.invalidInput("ALBUM_VISIBILITY_INVALID", "相册可见性不正确");
        }
        if ("private".equals(visibility) && clean(request.privatePassword()).isBlank()) {
            throw ApplicationFailure.invalidInput("ALBUM_PRIVATE_PASSWORD_REQUIRED", "私密相册密码不能为空");
        }
    }

    private String privatePasswordHash(AlbumCreateDto request) {
        if (!"private".equals(clean(request.visibility()))) {
            return null;
        }
        return passwordEncoder.encode(clean(request.privatePassword()));
    }

    private void validatePhotoUpload(MultipartFile original, MultipartFile preview, AlbumPhotoMetadataDto metadata) {
        validatePhotoMetadata(metadata);
        validateOriginalImage(original);
        validatePreviewImage(preview);
    }

    private void validateMobilePhotoUpload(MultipartFile file, AlbumPhotoMetadataDto metadata) {
        validatePhotoMetadata(metadata);
        validateOriginalImage(file);
    }

    private void validatePhotoMetadata(AlbumPhotoMetadataDto metadata) {
        if (metadata == null || metadata.takenAt() == null || metadata.width() == null || metadata.height() == null
                || metadata.width() < 1 || metadata.height() < 1) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确");
        }
    }

    private void validateOriginalImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApplicationFailure.invalidInput("ALBUM_IMAGE_TYPE_INVALID", "只支持 jpg、png、webp、gif 图片");
        }
        String contentType = clean(file.getContentType()).toLowerCase();
        if (!ORIGINAL_IMAGE_TYPES.contains(contentType) && !hasAllowedExtension(file) && !hasImageSignature(file)) {
            throw ApplicationFailure.invalidInput("ALBUM_IMAGE_TYPE_INVALID", "只支持 jpg、png、webp、gif 图片");
        }
        if (file.getSize() > MAX_ORIGINAL_SIZE) {
            throw ApplicationFailure.payloadTooLarge("ALBUM_IMAGE_TOO_LARGE", "单张原图不能超过 10MB");
        }
    }

    private void validatePreviewImage(MultipartFile file) {
        if (file == null || file.isEmpty() || !"image/webp".equals(clean(file.getContentType()).toLowerCase())) {
            throw ApplicationFailure.invalidInput("ALBUM_PREVIEW_TYPE_INVALID", "预览图必须是 WebP");
        }
        String filename = clean(file.getOriginalFilename()).toLowerCase();
        if (!filename.endsWith(".webp")) {
            throw ApplicationFailure.invalidInput("ALBUM_PREVIEW_TYPE_INVALID", "预览图必须是 WebP");
        }
    }

    private boolean hasAllowedExtension(MultipartFile file) {
        String filename = clean(file.getOriginalFilename()).toLowerCase();
        return IMAGE_EXTENSIONS.stream().anyMatch(filename::endsWith);
    }

    private boolean hasImageSignature(MultipartFile file) {
        byte[] header = new byte[12];
        int length;
        try (InputStream input = file.getInputStream()) {
            length = input.read(header);
        } catch (IOException ex) {
            return false;
        }
        if (length < 4) {
            return false;
        }
        boolean jpeg = unsigned(header[0]) == 0xff && unsigned(header[1]) == 0xd8 && unsigned(header[2]) == 0xff;
        boolean png = unsigned(header[0]) == 0x89 && header[1] == 0x50 && header[2] == 0x4e && header[3] == 0x47;
        boolean gif = header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46;
        boolean webp = length >= 12
                && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
                && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50;
        return jpeg || png || gif || webp;
    }

    private int unsigned(byte value) {
        return value & 0xff;
    }

    private String photoPreviewUrl(AlbumPhoto photo) {
        return clean(photo.getPreviewUrl());
    }

    private String defaultLocation(String value) {
        String cleaned = clean(value);
        return cleaned.isBlank() ? "地球" : cleaned;
    }

    private String defaultCaption(String value) {
        String cleaned = clean(value);
        return cleaned.isBlank() ? "未命名照片" : cleaned;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
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
