package xyz.snowlit.story;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.story.StoryDtos.StoryMomentUpsertDto;
import xyz.snowlit.story.StoryVos.StoryImageUploadVo;
import xyz.snowlit.story.StoryVos.StoryMomentListVo;
import xyz.snowlit.story.StoryVos.StoryMomentVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/story/moments")
public final class StoryController {

    private final StoryModule story;

    public StoryController(StoryModule story) {
        this.story = story;
    }

    @GetMapping
    public StoryMomentListVo moments(@CurrentActor(required = false) AuthenticatedActor actor,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) Integer year) {
        return story.listMoments(actor, category, year);
    }

    @GetMapping("/{id}")
    public StoryMomentVo moment(@PathVariable Long id) {
        return story.getMoment(id);
    }

    @PostMapping
    public StoryMomentVo create(@CurrentActor AuthenticatedActor actor,
                                @RequestBody StoryMomentUpsertDto request) {
        return story.create(actor, request);
    }

    @PutMapping("/{id}")
    public StoryMomentVo update(@CurrentActor AuthenticatedActor actor,
                                @PathVariable Long id,
                                @RequestBody StoryMomentUpsertDto request) {
        return story.update(actor, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentActor AuthenticatedActor actor, @PathVariable Long id) {
        story.delete(actor, id);
    }

    @PostMapping("/images")
    public StoryImageUploadVo uploadImage(@CurrentActor AuthenticatedActor actor,
                                          @RequestParam("file") MultipartFile file) {
        return story.uploadImage(actor, file);
    }
}
