package xyz.snowlit.story;

import org.junit.jupiter.api.Test;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.story.PlaceSearch.FoundPlace;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StoryPlacesTests {

    private static final AuthenticatedActor MANAGER =
            new AuthenticatedActor(1L, "member_a", "伴侣 A", null, null, null, "boyfriend", true);
    private static final AuthenticatedActor GUEST =
            new AuthenticatedActor(3L, "guest", "游客", null, null, null, null, false);

    @Test
    void placesInMainlandChinaMoveToTheChineseMapDatumAndOthersStayPut() {
        var places = new StoryPlaces(text -> Optional.of(List.of(
                new FoundPlace("天安门", "北京市东城区", 39.9075, 116.39125, "CN"),
                new FoundPlace("埃菲尔铁塔", "巴黎, 法国", 48.8582602, 2.2944991, "fr"),
                new FoundPlace("台北101", "台北市信义区", 25.033964, 121.564468, "tw"))));

        var items = places.search(MANAGER, "  某地  ").items();

        var beijing = items.get(0);
        assertThat(beijing.countryCode()).isEqualTo("cn");
        // GCJ-02 sits a few hundred metres from WGS84 in Beijing, mostly to the east.
        double northMetres = (beijing.latitude() - 39.9075) * 111_000;
        double eastMetres = (beijing.longitude() - 116.39125) * 111_000 * Math.cos(Math.toRadians(39.9075));
        assertThat(Math.hypot(northMetres, eastMetres)).isBetween(300.0, 800.0);
        assertThat(eastMetres).isGreaterThan(300.0);

        assertThat(items.get(1).latitude()).isEqualTo(48.85826);
        assertThat(items.get(1).longitude()).isEqualTo(2.294499);
        assertThat(items.get(2).latitude()).isEqualTo(25.033964);
        assertThat(items.get(2).longitude()).isEqualTo(121.564468);
    }

    @Test
    void offsetMatchesTheStandardTransform() {
        // Tiananmen: GPS (WGS84) 39.90750, 116.39125 is drawn by Tencent and Amap at about 39.90882, 116.39747.
        double[] gcj = ChinaMapOffset.toGcj02(39.9075, 116.39125);
        assertThat(gcj[0]).isCloseTo(39.90882, org.assertj.core.data.Offset.offset(0.0002));
        assertThat(gcj[1]).isCloseTo(116.39747, org.assertj.core.data.Offset.offset(0.0002));
    }

    @Test
    void searchTextIsTrimmedAndBounded() {
        var sent = new AtomicReference<String>();
        var places = new StoryPlaces(text -> {
            sent.set(text);
            return Optional.of(List.of());
        });

        assertThat(places.search(MANAGER, "  West Lake ").items()).isEmpty();
        assertThat(sent.get()).isEqualTo("West Lake");
        assertThat(places.search(MANAGER, "地".repeat(StoryPlaces.MAX_QUERY_LENGTH)).items()).isEmpty();

        for (String bad : new String[]{null, "", "   ", "地".repeat(StoryPlaces.MAX_QUERY_LENGTH + 1)}) {
            assertThatThrownBy(() -> places.search(MANAGER, bad))
                    .isInstanceOfSatisfying(ApplicationFailure.class, failure -> {
                        assertThat(failure.kind()).isEqualTo(ApplicationFailure.Kind.INVALID_INPUT);
                        assertThat(failure.code()).isEqualTo("STORY_PLACE_QUERY_INVALID");
                    });
        }
    }

    @Test
    void onlyManagersSearchAndAnUnavailableProviderIsReported() {
        var unavailable = new StoryPlaces(text -> Optional.empty());

        assertThatThrownBy(() -> unavailable.search(GUEST, "西湖"))
                .isInstanceOfSatisfying(ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("STORY_FORBIDDEN"));
        assertThatThrownBy(() -> unavailable.search(MANAGER, "西湖"))
                .isInstanceOfSatisfying(ApplicationFailure.class, failure -> {
                    assertThat(failure.kind()).isEqualTo(ApplicationFailure.Kind.DEPENDENCY_FAILURE);
                    assertThat(failure.code()).isEqualTo("STORY_PLACE_SEARCH_UNAVAILABLE");
                });
    }
}
