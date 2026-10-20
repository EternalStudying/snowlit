package xyz.snowlit.draft;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.web.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/drafts/{kind}")
public final class DraftController {
    private final DraftModule drafts;
    private final ObjectMapper json;
    public DraftController(DraftModule drafts, ObjectMapper json) { this.drafts = drafts; this.json = json; }

    @GetMapping
    public DraftVos.CurrentDraftVo current(@CurrentActor AuthenticatedActor actor, @PathVariable String kind) {
        return drafts.current(actor, DraftKind.fromPath(kind));
    }
    @PutMapping
    public DraftVos.DraftVo save(@CurrentActor AuthenticatedActor actor, @PathVariable String kind, @RequestBody DraftDtos.SaveDto request) {
        return drafts.save(actor, DraftKind.fromPath(kind), request.fields());
    }
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void discard(@CurrentActor AuthenticatedActor actor, @PathVariable String kind) {
        drafts.discard(actor, DraftKind.fromPath(kind));
    }
    @PostMapping("/images")
    public DraftVos.DraftImageVo upload(@CurrentActor AuthenticatedActor actor, @PathVariable String kind,
                                        @RequestParam(required = false) MultipartFile file,
                                        @RequestParam(required = false) MultipartFile original,
                                        @RequestParam(required = false) MultipartFile preview,
                                        @RequestParam(required = false) String metadata) {
        DraftKind resolved = DraftKind.fromPath(kind);
        JsonNode node = null;
        if (metadata != null) {
            try { node = json.readTree(metadata); }
            catch (Exception exception) { throw ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确"); }
        }
        return drafts.upload(actor, resolved, file, original, preview, node);
    }
    @DeleteMapping("/images/{imageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@CurrentActor AuthenticatedActor actor, @PathVariable String kind, @PathVariable String imageId) {
        drafts.removeImage(actor, DraftKind.fromPath(kind), imageId);
    }
    @PostMapping("/publish")
    public Object publish(@CurrentActor AuthenticatedActor actor, @PathVariable String kind, @RequestBody DraftDtos.PublishDto request) {
        return drafts.publish(actor, DraftKind.fromPath(kind), request);
    }
}
