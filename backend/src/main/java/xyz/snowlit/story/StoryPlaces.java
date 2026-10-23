package xyz.snowlit.story;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.story.StoryVos.StoryPlaceListVo;
import xyz.snowlit.story.StoryVos.StoryPlaceVo;
import xyz.snowlit.text.Text;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Place search for choosing where a moment happened, in China or abroad. Results come back in the
 * datum moments are stored in: GCJ-02 inside mainland China, WGS84 (identical to GCJ-02) elsewhere.
 */
@Service
public final class StoryPlaces {

    static final int MAX_QUERY_LENGTH = 50;

    private final PlaceSearch search;

    public StoryPlaces(PlaceSearch search) {
        this.search = search;
    }

    public StoryPlaceListVo search(AuthenticatedActor actor, String query) {
        actor.requireManager("STORY_FORBIDDEN", "只有站点主人可以管理点滴");
        String text = Text.trim(query);
        if (text.isEmpty() || text.codePointCount(0, text.length()) > MAX_QUERY_LENGTH) {
            throw ApplicationFailure.invalidInput("STORY_PLACE_QUERY_INVALID", "请输入要搜索的地点");
        }
        List<PlaceSearch.FoundPlace> found = search.search(text).orElseThrow(() ->
                ApplicationFailure.dependencyFailure("STORY_PLACE_SEARCH_UNAVAILABLE", "地点搜索暂时不可用，可以在地图上选点", null));
        return new StoryPlaceListVo(found.stream().map(StoryPlaces::toVo).toList());
    }

    private static StoryPlaceVo toVo(PlaceSearch.FoundPlace place) {
        boolean mainlandChina = "cn".equalsIgnoreCase(place.countryCode());
        double[] point = mainlandChina
                ? ChinaMapOffset.toGcj02(place.latitude(), place.longitude())
                : new double[]{place.latitude(), place.longitude()};
        return new StoryPlaceVo(place.name(), place.address(), round(point[0]), round(point[1]),
                Text.trim(place.countryCode()).toLowerCase());
    }

    private static double round(double value) {
        return Math.round(value * 1_000_000d) / 1_000_000d;
    }
}
