package xyz.snowlit.album;

import xyz.snowlit.support.InMemoryObjectStore;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.support.TestImages;
import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.album.AlbumDtos.AlbumUnlockDto;
import xyz.snowlit.album.AlbumDtos.AlbumCreateDto;
import xyz.snowlit.album.AlbumDtos.AlbumPhotoMetadataDto;
import xyz.snowlit.album.AlbumVos.AlbumDetailVo;
import xyz.snowlit.album.AlbumVos.AlbumLikeVo;
import xyz.snowlit.album.AlbumVos.AlbumPageVo;
import xyz.snowlit.album.AlbumVos.AlbumPhotoVo;
import xyz.snowlit.album.AlbumVos.AlbumUnlockVo;
import xyz.snowlit.album.AlbumVos.AlbumViewVo;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;

class AlbumModuleTests {

    private static final AuthenticatedActor MANAGER =
            new AuthenticatedActor(1L, "demo_a", "伴侣 B", null, null, null, null, true);
    private static final AuthenticatedActor GUEST =
            new AuthenticatedActor(3L, "guest", "游客", null, null, null, null, false);
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-16T12:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final AlbumMapper albumMapper = mock(AlbumMapper.class);
    private final InMemoryObjectStore objects = new InMemoryObjectStore();
    private final FakeTokenStore tokenStore = new FakeTokenStore();
    private final AlbumPrivateAccess privateAccess =
            new AlbumPrivateAccess(albumMapper, new BCryptPasswordEncoder(), tokenStore, CLOCK);
    private final AlbumModule albumService = new AlbumModule(albumMapper, privateAccess, CLOCK, new AlbumPublisher(albumMapper, new BCryptPasswordEncoder(), CLOCK));

    @Test
    void listAlbumsReturnsPagedItemsAndMasksLockedPrivateAlbum() {
        when(albumMapper.countPublishedAlbums()).thenReturn(2L);
        when(albumMapper.findPublishedAlbums(0, 5)).thenReturn(List.of(publicAlbum(), privateAlbum()));
        when(albumMapper.findActiveDailyLikeAlbumIds(1L, LocalDate.of(2026, 5, 16), List.of(1L, 2L))).thenReturn(List.of(2L));
        when(albumMapper.findPreviewPhotos(1L, 3)).thenReturn(List.of(photo(101L, 1L), photo(102L, 1L)));

        AlbumPageVo page = albumService.listAlbums(MANAGER, 1, 5, 3);

        assertThat(page.total()).isEqualTo(2);
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.size()).isEqualTo(5);
        assertThat(page.hasMore()).isFalse();
        assertThat(page.canManage()).isTrue();
        assertThat(page.items()).hasSize(2);
        assertThat(page.items().get(0).title()).isEqualTo("见面出游");
        assertThat(page.items().get(0).previewPhotos()).hasSize(2);
        assertThat(page.items().get(0).likedToday()).isFalse();
        assertThat(page.items().get(1).title()).isEqualTo("锁定专辑");
        assertThat(page.items().get(1).description()).isEqualTo("已锁定");
        assertThat(page.items().get(1).location()).isEqualTo("地球");
        assertThat(page.items().get(1).coverPhotoUrl()).isEqualTo("/album-assets/private-locked-cover.png");
        assertThat(page.items().get(1).viewCount()).isEqualTo(7);
        assertThat(page.items().get(1).likeCount()).isEqualTo(3);
        assertThat(page.items().get(1).likedToday()).isTrue();
        assertThat(page.items().get(1).previewPhotos()).isEmpty();

        verify(albumMapper).findPublishedAlbums(0, 5);
        verify(albumMapper).findPreviewPhotos(1L, 3);
    }

    @Test
    void listAlbumsOnlyReadsPublishedAlbumsAndExposesCanManage() {
        when(albumMapper.countPublishedAlbums()).thenReturn(1L);
        when(albumMapper.findPublishedAlbums(0, 5)).thenReturn(List.of(publicAlbum()));
        when(albumMapper.findActiveDailyLikeAlbumIds(1L, LocalDate.of(2026, 5, 16), List.of(1L))).thenReturn(List.of());

        AlbumPageVo page = albumService.listAlbums(MANAGER, 1, 5, 9);

        assertThat(page.items()).hasSize(1);
        assertThat(page.canManage()).isTrue();
        verify(albumMapper).countPublishedAlbums();
        verify(albumMapper).findPublishedAlbums(0, 5);
    }

    @Test
    void privateDetailRequiresAlbumScopedToken() {
        when(albumMapper.findAlbumById(2L)).thenReturn(privateAlbum());

        assertThatThrownBy(() -> albumService.getAlbumDetail(MANAGER, 2L, ""))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("PRIVATE_ALBUM_LOCKED")
                );

        tokenStore.status = AlbumPrivateAccessTokenStore.ValidationStatus.INVALID;
        assertThatThrownBy(() -> albumService.getAlbumDetail(MANAGER, 2L, "bad-token"))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("PRIVATE_ALBUM_TOKEN_INVALID")
                );

        tokenStore.status = AlbumPrivateAccessTokenStore.ValidationStatus.VALID;
        when(albumMapper.findPhotosByAlbumId(2L)).thenReturn(List.of(photo(201L, 2L)));
        when(albumMapper.findDailyLikeActive(2L, 1L, LocalDate.of(2026, 5, 16))).thenReturn(true);

        AlbumDetailVo detail = albumService.getAlbumDetail(MANAGER, 2L, "private-token");

        assertThat(detail.album().title()).isEqualTo("私密时光");
        assertThat(detail.album().locked()).isFalse();
        assertThat(detail.album().likedToday()).isTrue();
        assertThat(detail.photos()).extracting("location").containsExactly("法国·尼斯");
        assertThat(detail.photos()).extracting("previewUrl").containsExactly("https://example.com/photo-201.jpg");
        assertThat(detail.photos()).extracting("originalUrl").containsExactly("https://example.com/photo-201-original.jpg");
    }

    @Test
    void unlockCreatesOneHourTokenAndClearsFailureCount() {
        when(albumMapper.findAlbumById(2L)).thenReturn(privateAlbum());

        AlbumUnlockVo unlocked = privateAccess.unlock(MANAGER, 2L, new AlbumUnlockDto("5201314"));

        assertThat(unlocked.privateAccessToken()).isEqualTo("issued-private-token");
        assertThat(unlocked.expiresAt()).isEqualTo(LocalDateTime.of(2026, 5, 16, 21, 0));
        assertThat(tokenStore.ttl).isEqualTo(Duration.ofHours(1));
        verify(albumMapper).clearUnlockFailure(2L, 1L);
    }

    @Test
    void wrongPrivatePasswordLocksAfterFiveConsecutiveFailures() {
        when(albumMapper.findAlbumById(2L)).thenReturn(privateAlbum());
        when(albumMapper.findUnlockFailure(2L, 1L)).thenReturn(failure(4, null));

        assertThatThrownBy(() -> privateAccess.unlock(MANAGER, 2L, new AlbumUnlockDto("wrong")))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("PRIVATE_ALBUM_UNLOCK_LOCKED")
                );

        verify(albumMapper).recordUnlockFailure(
                eq(2L),
                eq(1L),
                eq(5),
                eq(LocalDateTime.of(2026, 5, 16, 20, 10)),
                eq(LocalDateTime.of(2026, 5, 16, 20, 0)),
                eq(LocalDateTime.of(2026, 5, 16, 20, 0))
        );
    }

    @Test
    void likeTogglesTodayBetweenActiveAndInactive() {
        LocalDate today = LocalDate.of(2026, 5, 16);
        LocalDateTime now = LocalDateTime.of(2026, 5, 16, 12, 0);
        when(albumMapper.findAlbumById(1L)).thenReturn(
                publicAlbum(),
                publicAlbumWithLikes(1),
                publicAlbumWithLikes(1),
                publicAlbumWithLikes(0),
                publicAlbumWithLikes(0),
                publicAlbumWithLikes(1)
        );
        when(albumMapper.findDailyLikeActive(1L, 1L, today)).thenReturn(true, false, true);

        AlbumLikeVo first = albumService.likeAlbum(MANAGER, 1L);
        AlbumLikeVo second = albumService.likeAlbum(MANAGER, 1L);
        AlbumLikeVo third = albumService.likeAlbum(MANAGER, 1L);

        assertThat(first.likeCount()).isEqualTo(1);
        assertThat(first.likedToday()).isTrue();
        assertThat(second.likeCount()).isEqualTo(0);
        assertThat(second.likedToday()).isFalse();
        assertThat(third.likeCount()).isEqualTo(1);
        assertThat(third.likedToday()).isTrue();
        verify(albumMapper, times(3)).toggleDailyLike(1L, 1L, today, now);
        verify(albumMapper, times(2)).incrementLike(1L);
        verify(albumMapper).decrementLike(1L);
    }

    @Test
    void likeUsesUtcDateWhenClockZoneHasAlreadyCrossedMidnight() {
        AlbumModule albumsAtMidnight = new AlbumModule(albumMapper, privateAccess, Clock.fixed(Instant.parse("2026-05-16T16:30:00Z"), ZoneId.of("Asia/Singapore")), new AlbumPublisher(albumMapper, new BCryptPasswordEncoder(), CLOCK));
        LocalDate utcDate = LocalDate.of(2026, 5, 16);
        LocalDateTime utcNow = LocalDateTime.of(2026, 5, 16, 16, 30);
        when(albumMapper.findAlbumById(1L)).thenReturn(publicAlbum(), publicAlbumWithLikes(1));
        when(albumMapper.findDailyLikeActive(1L, 1L, utcDate)).thenReturn(true);

        AlbumLikeVo liked = albumsAtMidnight.likeAlbum(MANAGER, 1L);

        assertThat(liked.likeCount()).isEqualTo(1);
        assertThat(liked.likedToday()).isTrue();
        verify(albumMapper).toggleDailyLike(1L, 1L, utcDate, utcNow);
        verify(albumMapper).incrementLike(1L);
    }

    @Test
    void activityReadsAndViewsUseUtcDayWhenClockZoneIsOnPreviousDay() {
        AlbumModule albumsAtMidnight = new AlbumModule(albumMapper, privateAccess, Clock.fixed(Instant.parse("2026-05-17T00:30:00Z"), ZoneId.of("America/Los_Angeles")), new AlbumPublisher(albumMapper, new BCryptPasswordEncoder(), CLOCK));
        LocalDate utcDate = LocalDate.of(2026, 5, 17);
        LocalDateTime utcNow = LocalDateTime.of(2026, 5, 17, 0, 30);
        when(albumMapper.countPublishedAlbums()).thenReturn(1L);
        when(albumMapper.findPublishedAlbums(0, 5)).thenReturn(List.of(publicAlbum()));
        when(albumMapper.findActiveDailyLikeAlbumIds(1L, utcDate, List.of(1L))).thenReturn(List.of(1L));
        when(albumMapper.findAlbumById(1L)).thenReturn(publicAlbum());
        when(albumMapper.findDailyLikeActive(1L, 1L, utcDate)).thenReturn(true);
        when(albumMapper.insertDailyView(1L, 1L, utcDate, utcNow)).thenReturn(1);

        assertThat(albumsAtMidnight.listAlbums(MANAGER, 1, 5, 9).items().get(0).likedToday()).isTrue();
        assertThat(albumsAtMidnight.getAlbumDetail(MANAGER, 1L, null).album().likedToday()).isTrue();
        assertThat(albumsAtMidnight.recordAlbumView(MANAGER, 1L, null).counted()).isTrue();
        verify(albumMapper).insertDailyView(1L, 1L, utcDate, utcNow);
        verify(albumMapper).incrementView(1L);
    }

    @Test
    void likeAllowsLockedPrivateAlbumWithoutUnlockingIt() {
        LocalDate today = LocalDate.of(2026, 5, 16);
        when(albumMapper.findAlbumById(2L)).thenReturn(privateAlbum(), privateAlbumWithCounts(7, 4));
        when(albumMapper.findDailyLikeActive(2L, 1L, today)).thenReturn(true);

        AlbumLikeVo liked = albumService.likeAlbum(MANAGER, 2L);

        assertThat(liked.likeCount()).isEqualTo(4);
        assertThat(liked.likedToday()).isTrue();
        verify(albumMapper).incrementLike(2L);
        verify(albumMapper, never()).findUnlockFailure(any(), any());
    }

    @Test
    void viewCountsOncePerUserPerDayAndRequiresPrivateToken() {
        LocalDate today = LocalDate.of(2026, 5, 16);
        LocalDateTime now = LocalDateTime.of(2026, 5, 16, 12, 0);
        when(albumMapper.findAlbumById(1L)).thenReturn(publicAlbum(), publicAlbumWithViews(22));
        when(albumMapper.insertDailyView(1L, 1L, today, now)).thenReturn(1);

        AlbumViewVo first = albumService.recordAlbumView(MANAGER, 1L, null);
        assertThat(first.counted()).isTrue();
        assertThat(first.viewCount()).isEqualTo(22);
        verify(albumMapper).incrementView(1L);

        when(albumMapper.findAlbumById(1L)).thenReturn(publicAlbumWithViews(22));
        when(albumMapper.insertDailyView(1L, 1L, today, now)).thenReturn(0);
        when(albumMapper.markDailyViewed(1L, 1L, today, now)).thenReturn(0);
        AlbumViewVo repeated = albumService.recordAlbumView(MANAGER, 1L, null);
        assertThat(repeated.counted()).isFalse();
        assertThat(repeated.viewCount()).isEqualTo(22);
        verify(albumMapper, times(1)).incrementView(1L);

        when(albumMapper.findAlbumById(2L)).thenReturn(privateAlbum());
        assertThatThrownBy(() -> albumService.recordAlbumView(MANAGER, 2L, null))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("PRIVATE_ALBUM_LOCKED")
                );
    }

    @Test
    void viewAfterLikingTheSameDayMarksTheExistingActivityAsViewed() {
        LocalDate today = LocalDate.of(2026, 5, 16);
        LocalDateTime now = LocalDateTime.of(2026, 5, 16, 12, 0);
        when(albumMapper.findAlbumById(1L)).thenReturn(publicAlbum(), publicAlbumWithViews(23));
        when(albumMapper.insertDailyView(1L, 1L, today, now)).thenReturn(0);
        when(albumMapper.markDailyViewed(1L, 1L, today, now)).thenReturn(1);

        assertThat(albumService.recordAlbumView(MANAGER, 1L, null).counted()).isTrue();
        verify(albumMapper).incrementView(1L);
    }

    private Album publicAlbum() {
        Album album = new Album();
        album.setId(1L);
        album.setTitle("见面出游");
        album.setDescription("把见面那几天的光都收好。");
        album.setCoverPhotoUrl("/album-assets/meeting-cover.jpg");
        album.setAuthorName("伴侣 B");
        album.setCreatedAt(LocalDateTime.of(2026, 5, 16, 20, 0));
        album.setEventDate(LocalDate.of(2026, 4, 16));
        album.setLocation("法国·尼斯");
        album.setPhotoCount(14);
        album.setViewCount(21);
        album.setLikeCount(0);
        album.setVisibility("public");
        album.setPinned(true);
        album.setSortOrder(10);
        album.setStatus("published");
        return album;
    }

    private Album publicAlbumWithViews(long viewCount) {
        Album album = publicAlbum();
        album.setViewCount(viewCount);
        return album;
    }

    private Album publicAlbumWithLikes(long likeCount) {
        Album album = publicAlbum();
        album.setLikeCount(likeCount);
        return album;
    }

    private Album privateAlbum() {
        Album album = privateAlbumWithCounts(7, 3);
        album.setPrivatePasswordHash(new BCryptPasswordEncoder().encode("5201314"));
        return album;
    }

    private Album privateAlbumWithCounts(long viewCount, long likeCount) {
        Album album = new Album();
        album.setId(2L);
        album.setTitle("私密时光");
        album.setDescription("只属于我们。");
        album.setCoverPhotoUrl("/album-assets/private-cover.jpg");
        album.setAuthorName("伴侣 A");
        album.setCreatedAt(LocalDateTime.of(2026, 5, 10, 20, 0));
        album.setEventDate(LocalDate.of(2026, 5, 10));
        album.setLocation("只属于我们");
        album.setPhotoCount(8);
        album.setViewCount(viewCount);
        album.setLikeCount(likeCount);
        album.setVisibility("private");
        album.setPinned(false);
        album.setSortOrder(100);
        album.setStatus("published");
        return album;
    }

    private AlbumPhoto photo(Long id, Long albumId) {
        AlbumPhoto photo = new AlbumPhoto();
        photo.setId(id);
        photo.setAlbumId(albumId);
        photo.setPreviewUrl("https://example.com/photo-" + id + ".jpg");
        photo.setOriginalUrl("https://example.com/photo-" + id + "-original.jpg");
        photo.setCaption("海边日落");
        photo.setDescription("傍晚的风很轻。");
        photo.setTakenAt(LocalDate.of(2026, 4, 16));
        photo.setLocation("法国·尼斯");
        photo.setSortOrder(10);
        photo.setWidth(1600);
        photo.setHeight(1067);
        return photo;
    }

    private Album draftAlbum() {
        Album album = publicAlbum();
        album.setId(9L);
        album.setTitle("草稿相册");
        album.setCoverPhotoUrl("");
        album.setStatus("draft");
        album.setCreatedByUserId(1L);
        album.setPhotoCount(1);
        return album;
    }

    private Album publishedAlbum() {
        Album album = draftAlbum();
        album.setStatus("published");
        album.setCoverPhotoUrl("https://cdn.example.com/album/preview.webp");
        return album;
    }

    private AlbumPhoto storedPhoto(Long id, Long albumId) {
        AlbumPhoto photo = photo(id, albumId);
        photo.setOriginalUrl("https://cdn.example.com/album/original.jpg");
        photo.setOriginalObjectName("album/9/original/original.jpg");
        photo.setOriginalContentType(MediaType.IMAGE_JPEG_VALUE);
        photo.setOriginalSizeBytes(8L);
        photo.setPreviewUrl("https://cdn.example.com/album/preview.webp");
        photo.setPreviewObjectName("album/9/preview/preview.webp");
        photo.setPreviewContentType("image/webp");
        photo.setPreviewSizeBytes(7L);
        return photo;
    }

    private AlbumCreateDto publicDraftRequest() {
        return new AlbumCreateDto("新相册", "", LocalDate.of(2026, 6, 1), "尼斯", "public", null, false);
    }

    private CapturedAlbum capturedAlbum = new CapturedAlbum("");

    private record CapturedAlbum(String privatePasswordHash) {
    }

    private AlbumUnlockFailure failure(int count, LocalDateTime lockedUntil) {
        AlbumUnlockFailure failure = new AlbumUnlockFailure();
        failure.setAlbumId(2L);
        failure.setUserId(1L);
        failure.setFailureCount(count);
        failure.setLockedUntil(lockedUntil);
        return failure;
    }

    private static class FakeTokenStore implements AlbumPrivateAccessTokenStore {
        ValidationStatus status = ValidationStatus.VALID;
        Duration ttl;

        @Override
        public CreatedToken create(Long albumId, Long userId, Duration ttl, LocalDateTime expiresAt) {
            this.ttl = ttl;
            return new CreatedToken("issued-private-token", expiresAt);
        }

        @Override
        public ValidationStatus validate(String token, Long albumId, Long userId) {
            return status;
        }
    }
}
