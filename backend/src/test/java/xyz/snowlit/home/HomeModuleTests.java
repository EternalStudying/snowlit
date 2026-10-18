package xyz.snowlit.home;

import xyz.snowlit.album.AlbumModule;
import xyz.snowlit.album.PhotoHighlight;
import xyz.snowlit.diary.DiaryHighlight;
import xyz.snowlit.diary.DiaryModule;
import xyz.snowlit.messages.MessageHighlight;
import xyz.snowlit.messages.MessageModule;
import xyz.snowlit.wishes.WishModule;
import xyz.snowlit.wishes.WishTotals;
import xyz.snowlit.wishes.WishVos.WishItemVo;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.home.HomeDtos.HomeLocationUpdateDto;
import xyz.snowlit.home.HomeVos.HomeVo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HomeModuleTests {

    private static final AuthenticatedActor ACTOR =
            new AuthenticatedActor(1L, "demo_a", "伴侣 B", null, null, null, "girlfriend", true);
    private final HomeMapper homeMapper = mock(HomeMapper.class);
    private final DiaryModule diaries = mock(DiaryModule.class);
    private final AlbumModule albums = mock(AlbumModule.class);
    private final WishModule wishes = mock(WishModule.class);
    private final MessageModule messages = mock(MessageModule.class);
    private HomeModule home;

    @BeforeEach
    void setUp() {
        setClock("2026-05-16T12:00:00Z");
        when(homeMapper.findCouple()).thenReturn(new Couple(
                1L,
                "伴侣 A",
                "伴侣 B",
                LocalDate.of(2023, 2, 14),
                LocalDate.of(2023, 2, 14),
                "把普通日子过成喜欢的样子"
        ));
        stubLatestContent();
        when(albums.photoCount()).thenReturn(2L);
        when(wishes.totals()).thenReturn(new WishTotals(3L, 1L));
    }

    @Test
    void homeUsesRealCoupleLatestSingleAndStatsWithoutFullLists() {
        HomeVo response = home.getHome(ACTOR);

        assertThat(response.couple().boyfriendName()).isEqualTo("伴侣 A");
        assertThat(response.couple().girlfriendName()).isEqualTo("伴侣 B");
        assertThat(response.couple().startedOn()).isEqualTo(LocalDate.of(2023, 2, 14));
        assertThat(response.couple().togetherDays()).isEqualTo(1188);
        assertThat(response.latest().diary().title()).isEqualTo("第一次看海");
        assertThat(response.latest().diary().entryDate()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(response.latest().photo().previewUrl()).isEqualTo("https://example.com/photo.jpg");
        assertThat(response.latest().photo().takenAt()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(response.latest().photo().caption()).isEqualTo("周末约会");
        assertThat(response.latest().wish().title()).isEqualTo("一起去看海");
        assertThat(response.latest().message().authorName()).isEqualTo("伴侣 B");
        assertThat(response.latest().message().content()).isEqualTo("晚点一起看相册。");
        assertThat(response.stats().photoCount()).isEqualTo(2);
        assertThat(response.stats().messageCount()).isEqualTo(4);
        assertThat(response.stats().completedWishCount()).isEqualTo(1);
        assertThat(Arrays.stream(HomeVo.class.getRecordComponents()).map(component -> component.getName()))
                .doesNotContain("memories", "photos", "wishes", "messages");
    }

    @Test
    void nextAnniversaryChoosesNearestCandidateAndPriority() {
        assertThat(home.getHome(ACTOR).couple().nextAnniversary())
                .extracting("name", "date", "daysUntil", "type")
                .containsExactly("520", LocalDate.of(2026, 5, 20), 4L, "romanticDay");

        setClock("2026-05-21T12:00:00Z");
        assertThat(home.getHome(ACTOR).couple().nextAnniversary())
                .extracting("name", "date", "type")
                .containsExactly("七夕", LocalDate.of(2026, 8, 19), "qixi");

        setClock("2026-09-01T12:00:00Z");
        assertThat(home.getHome(ACTOR).couple().nextAnniversary())
                .extracting("name", "date", "type")
                .containsExactly("恋爱 1314 天", LocalDate.of(2026, 9, 19), "dayMilestone");

        setClock("2027-02-14T12:00:00Z");
        assertThat(home.getHome(ACTOR).couple().nextAnniversary())
                .extracting("name", "date", "daysUntil", "type")
                .containsExactly("恋爱 4 周年", LocalDate.of(2027, 2, 14), 0L, "anniversary");
    }

    @Test
    void dailyNoteAndStatusesAreStableForSameUserAndDayButChangeNextDay() {
        HomeVo first = home.getHome(ACTOR);
        HomeVo second = home.getHome(ACTOR);

        assertThat(second.dailyNote()).isEqualTo(first.dailyNote());
        assertThat(second.personStatuses()).isEqualTo(first.personStatuses());

        setClock("2026-05-17T12:00:00Z");
        HomeVo nextDay = home.getHome(ACTOR);
        assertThat(nextDay.dailyNote()).isNotEqualTo(first.dailyNote());
        assertThat(nextDay.personStatuses()).isNotEqualTo(first.personStatuses());
    }

    @Test
    void distanceUsesHaversineRoundedToOneDecimalAndFallsBackWhenMissing() {
        when(homeMapper.findLocationByRole("boyfriend")).thenReturn(location("boyfriend", 0.0, 0.0));
        when(homeMapper.findLocationByRole("girlfriend")).thenReturn(location("girlfriend", 0.0, 1.0));

        HomeVo ready = home.getHome(ACTOR);
        assertThat(ready.distance().kilometers()).isEqualTo(111.2);
        assertThat(ready.distance().label()).isEqualTo("相距 111.2 公里");
        assertThat(ready.distance().status()).isEqualTo("ready");

        when(homeMapper.findLocationByRole("girlfriend")).thenReturn(null);
        HomeVo missing = home.getHome(ACTOR);
        assertThat(missing.distance().kilometers()).isNull();
        assertThat(missing.distance().label()).isEqualTo("距离正在更新");
        assertThat(missing.distance().status()).isEqualTo("missingLocation");
    }

    @Test
    void updateLocationMapsCurrentUserToCoupleRole() {
        HomeLocationUpdateDto request = new HomeLocationUpdateDto(
                52.52,
                13.41,
                "示例城市 B",
                "示例街区 B",
                "示例地区 B",
                "德国",
                "多云",
                18.0
        );

        home.updateLocation(ACTOR, request);

        verify(homeMapper).upsertLocation(any(HomeLocation.class));
    }

    private void setClock(String instant) {
        home = new HomeModule(
                homeMapper,
                new MemberLocations(homeMapper),
                diaries,
                albums,
                wishes,
                messages,
                Clock.fixed(Instant.parse(instant), ZoneId.of("Asia/Singapore"))
        );
    }

    private void stubLatestContent() {
        when(diaries.latestShared()).thenReturn(Optional.of(new DiaryHighlight(
                1L, "第一次看海", LocalDate.of(2026, 5, 1), "傍晚的海风很温柔，我们走了很久。", "happy")));
        when(albums.latestPublicPhoto()).thenReturn(Optional.of(new PhotoHighlight(
                1L, "https://example.com/photo.jpg", "周末约会", LocalDate.of(2026, 5, 1))));
        when(wishes.latest()).thenReturn(Optional.of(new WishItemVo(1L, "一起去看海", false)));
        when(messages.latest()).thenReturn(Optional.of(new MessageHighlight(
                1L, "伴侣 B", "晚点一起看相册。", LocalDateTime.of(2026, 5, 16, 10, 30))));
        when(messages.count()).thenReturn(4L);
    }

    private HomeLocation location(String role, double latitude, double longitude) {
        HomeLocation location = new HomeLocation();
        location.setUserId("boyfriend".equals(role) ? 2L : 1L);
        location.setRole(role);
        location.setLatitude(latitude);
        location.setLongitude(longitude);
        location.setCity("示例城市 B");
        location.setWeather("多云");
        location.setTemperature(18.0);
        location.setLastOnlineAt(LocalDateTime.of(2026, 5, 16, 12, 0));
        return location;
    }
}
