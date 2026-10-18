package xyz.snowlit.feedback;

import xyz.snowlit.text.Text;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.feedback.FeedbackDtos.FeedbackCreateDto;
import xyz.snowlit.feedback.FeedbackVos.FeedbackImageUploadVo;
import xyz.snowlit.feedback.FeedbackVos.FeedbackSubmitVo;
import xyz.snowlit.storage.ImageFormat;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ImagePolicy;
import xyz.snowlit.storage.ObjectStore;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public final class FeedbackModule {

    private static final Set<String> TYPES = Set.of("bug", "feature", "experience", "other");
    private static final ImagePolicy.Rejection SCREENSHOT_TYPE_NOT_ALLOWED =
            new ImagePolicy.Rejection("FEEDBACK_SCREENSHOT_TYPE_NOT_ALLOWED", "截图只支持 jpg、png、webp、gif");
    private static final ImagePolicy SCREENSHOT = new ImagePolicy(
            "feedback",
            true,
            Set.of(ImageFormat.values()),
            ImagePolicy.TEN_MEGABYTES,
            new ImagePolicy.Rejection("FEEDBACK_SCREENSHOT_REQUIRED", "请选择截图"),
            SCREENSHOT_TYPE_NOT_ALLOWED,
            new ImagePolicy.Rejection("FEEDBACK_SCREENSHOT_TOO_LARGE", "截图不能超过 10MB"),
            new ImagePolicy.Rejection("FEEDBACK_SCREENSHOT_UPLOAD_FAILED", "截图上传失败，请稍后重试")
    );
    private static final int MAX_SCREENSHOTS = 3;

    private final FeedbackMapper feedbackMapper;
    private final ImageIntake images;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    public FeedbackModule(FeedbackMapper feedbackMapper, ImageIntake images, Clock clock) {
        this.feedbackMapper = feedbackMapper;
        this.images = images;
        this.clock = clock;
        this.objectMapper = new ObjectMapper();
    }

    public FeedbackImageUploadVo uploadImage(AuthenticatedActor actor, MultipartFile file) {
        ObjectStore.StoredObject stored = images.store(file, SCREENSHOT, actor.userId());
        FeedbackImage image = new FeedbackImage();
        image.setUserId(actor.userId());
        image.setObjectName(stored.objectName());
        image.setUrl(stored.url());
        image.setContentType(stored.contentType());
        image.setSizeBytes(stored.sizeBytes());
        image.setCreatedAt(now());
        feedbackMapper.insertImage(image);
        return new FeedbackImageUploadVo(image.getUrl());
    }

    public FeedbackSubmitVo submit(AuthenticatedActor actor, FeedbackCreateDto request) {
        String type = Text.trim(request.type());
        String title = Text.trim(request.title());
        String content = Text.trim(request.content());
        List<String> imageUrls = sanitizeUrls(request.imageUrls());

        validateFeedback(type, title, content, imageUrls);
        ensureImagesBelongToActor(actor.userId(), imageUrls);

        LocalDateTime now = now();
        Feedback feedback = new Feedback();
        feedback.setUserId(actor.userId());
        feedback.setType(type);
        feedback.setTitle(title);
        feedback.setContent(content);
        feedback.setContact(Text.trimToNull(request.contact()));
        feedback.setImageUrlsJson(toJson(imageUrls));
        feedback.setPageUrl(Text.trimToNull(request.pageUrl()));
        feedback.setUserAgent(Text.trimToNull(request.userAgent()));
        feedback.setStatus("pending");
        feedback.setCreatedAt(now);
        feedback.setUpdatedAt(now);
        feedbackMapper.insertFeedback(feedback);
        return new FeedbackSubmitVo(feedback.getId(), feedback.getStatus(), feedback.getCreatedAt());
    }

    private void validateFeedback(String type, String title, String content, List<String> imageUrls) {
        if (!TYPES.contains(type)) {
            throw ApplicationFailure.invalidInput("FEEDBACK_TYPE_INVALID", "反馈类型不正确");
        }
        if (title.isBlank()) {
            throw ApplicationFailure.invalidInput("FEEDBACK_TITLE_REQUIRED", "反馈标题不能为空");
        }
        if (content.isBlank()) {
            throw ApplicationFailure.invalidInput("FEEDBACK_CONTENT_REQUIRED", "反馈内容不能为空");
        }
        if (imageUrls.size() > MAX_SCREENSHOTS) {
            throw ApplicationFailure.invalidInput(
                    "FEEDBACK_SCREENSHOT_LIMIT_EXCEEDED",
                    "最多只能上传 3 张截图"
            );
        }
    }

    private void ensureImagesBelongToActor(Long actorId, List<String> imageUrls) {
        if (imageUrls.isEmpty()) {
            return;
        }
        List<FeedbackImage> images = feedbackMapper.findImagesByUrls(imageUrls);
        Set<String> ownedUrls = new HashSet<>();
        for (FeedbackImage image : images) {
            if (actorId.equals(image.getUserId())) {
                ownedUrls.add(image.getUrl());
            }
        }
        if (!ownedUrls.containsAll(imageUrls)) {
            throw ApplicationFailure.forbidden(
                    "FEEDBACK_SCREENSHOT_FORBIDDEN",
                    "只能提交本系统上传的截图"
            );
        }
    }

    private List<String> sanitizeUrls(List<String> urls) {
        if (urls == null) {
            return List.of();
        }
        return urls.stream()
                .map(Text::trim)
                .filter(url -> !url.isBlank())
                .distinct()
                .toList();
    }

    private String toJson(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Feedback image URLs cannot be serialized", ex);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

}
