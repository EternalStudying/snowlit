package xyz.snowlit.album;

import xyz.snowlit.album.AlbumVos.AlbumDetailVo;
import xyz.snowlit.album.AlbumVos.AlbumLikeVo;
import xyz.snowlit.album.AlbumVos.AlbumPageVo;
import xyz.snowlit.album.AlbumVos.AlbumPhotoVo;
import xyz.snowlit.album.AlbumVos.AlbumViewVo;
import xyz.snowlit.album.AlbumVos.AlbumVo;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.paging.PageWindow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * The published album catalog: listing, details, and each member's daily likes and views.
 */
@Service
public class AlbumModule {

    private static final int DEFAULT_PAGE_SIZE = 5;
    private static final int MAX_PAGE_SIZE = 20;
    private static final int MAX_PREVIEW_LIMIT = 9;
    private static final ZoneOffset ACTIVITY_ZONE = ZoneOffset.UTC;

    private final AlbumMapper albumMapper;
    private final AlbumPrivateAccess privateAccess;
    private final Clock clock;
    private final AlbumPublisher publisher;

    public AlbumModule(AlbumMapper albumMapper, AlbumPrivateAccess privateAccess, Clock clock, AlbumPublisher publisher) {
        this.albumMapper = albumMapper;
        this.privateAccess = privateAccess;
        this.clock = clock;
        this.publisher = publisher;
    }

    public AlbumDetailVo createFromDraft(AuthenticatedActor actor, AlbumDtos.AlbumCreateDto request, List<AlbumPhoto> photos) {
        return publisher.create(actor, request, photos);
    }

    public AlbumPageVo listAlbums(AuthenticatedActor actor, Integer page, Integer size, Integer previewLimit) {
        PageWindow window = PageWindow.of(page, size, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        int previewCount = previewLimit == null || previewLimit < 1 ? MAX_PREVIEW_LIMIT : Math.min(previewLimit, MAX_PREVIEW_LIMIT);
        long total = albumMapper.countPublishedAlbums();
        List<Album> albums = albumMapper.findPublishedAlbums(window.offset(), window.size());
        Set<Long> likedAlbumIds = likedToday(actor.userId(), albums.stream().map(Album::getId).toList());
        List<AlbumVo> items = albums.stream()
                .map(album -> Albums.toAlbumVo(
                        album,
                        Albums.isPrivate(album),
                        previewPhotos(album, previewCount),
                        likedAlbumIds.contains(album.getId())
                ))
                .toList();
        return new AlbumPageVo(items, total, window.page(), window.size(), window.hasMore(total), actor.manager());
    }

    public AlbumDetailVo getAlbumDetail(AuthenticatedActor actor, Long albumId, String privateAccessToken) {
        Album album = requireVisible(actor, albumId, privateAccessToken);
        List<AlbumPhotoVo> photos = albumMapper.findPhotosByAlbumId(album.getId()).stream()
                .map(Albums::toPhotoVo)
                .toList();
        boolean likedToday = Boolean.TRUE.equals(albumMapper.findDailyLikeActive(album.getId(), actor.userId(), today()));
        return new AlbumDetailVo(Albums.toAlbumVo(album, false, List.of(), likedToday), photos, actor.manager());
    }

    /**
     * Toggles today's like. Liking a private album does not require unlocking it.
     */
    @Transactional
    public AlbumLikeVo likeAlbum(AuthenticatedActor actor, Long albumId) {
        Albums.requirePublished(albumMapper, albumId);
        LocalDate today = today();
        albumMapper.toggleDailyLike(albumId, actor.userId(), today, now());
        boolean likedToday = albumMapper.findDailyLikeActive(albumId, actor.userId(), today);
        if (likedToday) {
            albumMapper.incrementLike(albumId);
        } else {
            albumMapper.decrementLike(albumId);
        }
        return new AlbumLikeVo(albumId, Albums.requirePublished(albumMapper, albumId).getLikeCount(), likedToday);
    }

    @Transactional
    public AlbumViewVo recordAlbumView(AuthenticatedActor actor, Long albumId, String privateAccessToken) {
        requireVisible(actor, albumId, privateAccessToken);
        LocalDate today = today();
        LocalDateTime now = now();
        boolean counted = albumMapper.insertDailyView(albumId, actor.userId(), today, now) == 1
                || albumMapper.markDailyViewed(albumId, actor.userId(), today, now) == 1;
        if (counted) {
            albumMapper.incrementView(albumId);
        }
        return new AlbumViewVo(albumId, Albums.requirePublished(albumMapper, albumId).getViewCount(), counted);
    }

    public Optional<PhotoHighlight> latestPublicPhoto() {
        return Optional.ofNullable(albumMapper.findLatestPublicPhoto())
                .map(photo -> new PhotoHighlight(photo.getId(), photo.getPreviewUrl(), photo.getCaption(), photo.getTakenAt()));
    }

    public long photoCount() {
        return albumMapper.countAllPhotos();
    }

    private Album requireVisible(AuthenticatedActor actor, Long albumId, String privateAccessToken) {
        Album album = Albums.requirePublished(albumMapper, albumId);
        if (Albums.isPrivate(album)) {
            privateAccess.require(album, actor.userId(), privateAccessToken);
        }
        return album;
    }

    private List<AlbumPhotoVo> previewPhotos(Album album, int previewCount) {
        if (Albums.isPrivate(album)) {
            return List.of();
        }
        return albumMapper.findPreviewPhotos(album.getId(), previewCount).stream()
                .map(Albums::toPhotoVo)
                .toList();
    }

    private Set<Long> likedToday(Long userId, List<Long> albumIds) {
        if (albumIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(albumMapper.findActiveDailyLikeAlbumIds(userId, today(), albumIds));
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(ACTIVITY_ZONE));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock.withZone(ACTIVITY_ZONE));
    }
}
