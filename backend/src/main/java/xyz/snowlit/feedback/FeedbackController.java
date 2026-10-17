package xyz.snowlit.feedback;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.feedback.FeedbackDtos.FeedbackCreateDto;
import xyz.snowlit.feedback.FeedbackVos.FeedbackImageUploadVo;
import xyz.snowlit.feedback.FeedbackVos.FeedbackSubmitVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/feedback")
public final class FeedbackController {

    private final FeedbackModule feedback;

    public FeedbackController(FeedbackModule feedback) {
        this.feedback = feedback;
    }

    @PostMapping("/screenshots")
    public FeedbackImageUploadVo uploadImage(@CurrentActor AuthenticatedActor actor,
                                             @RequestParam("file") MultipartFile file) {
        return feedback.uploadImage(actor, file);
    }

    @PostMapping
    public FeedbackSubmitVo submit(@CurrentActor AuthenticatedActor actor,
                                   @RequestBody FeedbackCreateDto request) {
        return feedback.submit(actor, request);
    }
}
