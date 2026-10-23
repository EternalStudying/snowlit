package xyz.snowlit.story;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.story.StoryVos.StoryPlaceListVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/story/places")
public final class StoryPlaceController {

    private final StoryPlaces places;

    public StoryPlaceController(StoryPlaces places) {
        this.places = places;
    }

    @GetMapping
    public StoryPlaceListVo search(@CurrentActor AuthenticatedActor actor,
                                   @RequestParam(required = false) String q) {
        return places.search(actor, q);
    }
}
