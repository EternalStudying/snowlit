package xyz.snowlit.feedback;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.feedback.FeedbackDtos.FeedbackCreateDto;
import xyz.snowlit.feedback.FeedbackVos.FeedbackImageUploadVo;
import xyz.snowlit.feedback.FeedbackVos.FeedbackSubmitVo;
import xyz.snowlit.storage.ObjectStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public final class FeedbackModule {

    private static final Set<String> TYPES = Set.of("bug", "feature", "experience", "other");
    private static final Set<String> SCREENSHOT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_SCREENSHOT_SIZE = 10L * 1024L * 1024L;
    private static final int MAX_SCREENSHOTS = 3;

    private final FeedbackMapper feedbackMapper;
    private final FeedbackImages imageStorage;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    @Autowired
    public FeedbackModule(FeedbackMapper feedbackMapper, FeedbackImages imageStorage) {
        this(feedbackMapper, imageStorage, Clock.systemDefaultZone());
    }

    FeedbackModule(FeedbackMapper feedbackMapper, FeedbackImages imageStorage, Clock clock) {
        this.feedbackMapper = feedbackMapper;
        this.imageStorage = imageStorage;
        this.clock = clock;
        this.objectMapper = new ObjectMapper();
    }

    public FeedbackImageUploadVo uploadImage(AuthenticatedActor actor, MultipartFile file) {
        validateScreenshot(file);
        ObjectStore.StoredObject stored = imageStorage.upload(file, actor.userId());
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
        String type = clean(request == null ? null : request.type());
        String title = clean(request == null ? null : request.title());
        String content = clean(request == null ? null : request.content());
        List<String> imageUrls = sanitizeUrls(request == null ? null : request.imageUrls());

        validateFeedback(type, title, content, imageUrls);
        ensureImagesBelongToActor(actor.userId(), imageUrls);

        LocalDateTime now = now();
        Feedback feedback = new Feedback();
        feedback.setUserId(actor.userId());
        feedback.setType(type);
        feedback.setTitle(title);
        feedback.setContent(content);
        feedback.setContact(cleanNullable(request.contact()));
        feedback.setImageUrlsJson(toJson(imageUrls));
        feedback.setPageUrl(cleanNullable(request.pageUrl()));
        feedback.setUserAgent(cleanNullable(request.userAgent()));
        feedback.setStatus("pending");
        feedback.setCreatedAt(now);
        feedback.setUpdatedAt(now);
        feedbackMapper.insertFeedback(feedback);
        return new FeedbackSubmitVo(feedback.getId(), feedback.getStatus(), feedback.getCreatedAt());
    }

    private void validateScreenshot(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApplicationFailure.invalidInput("FEEDBACK_SCREENSHOT_REQUIRED", "请选择截图");
        }
        String contentType = clean(file.getContentType()).toLowerCase();
        String filename = clean(file.getOriginalFilename()).toLowerCase();
        boolean typeAllowed = SCREENSHOT_TYPES.contains(contentType);
        boolean extensionAllowed = filename.endsWith(".jpg")
                || filename.endsWith(".jpeg")
                || filename.endsWith(".png")
                || filename.endsWith(".webp");
        if (!typeAllowed || !extensionAllowed) {
            throw ApplicationFailure.invalidInput(
                    "FEEDBACK_SCREENSHOT_TYPE_NOT_ALLOWED",
                    "截图只支持 jpg、jpeg、png、webp"
            );
        }
        if (file.getSize() > MAX_SCREENSHOT_SIZE) {
            // Keep the established API contract: this validation error is HTTP 400, not 413.
            throw ApplicationFailure.invalidInput("FEEDBACK_SCREENSHOT_TOO_LARGE", "截图不能超过 10MB");
        }
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
            if (image != null && actorId.equals(image.getUserId())) {
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
                .map(this::clean)
                .filter(url -> !url.isBlank())
                .distinct()
                .toList();
    }

    private String toJson(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (Exception ex) {
            throw ApplicationFailure.internal("FEEDBACK_SERIALIZATION_FAILED", "反馈图片信息处理失败");
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private String cleanNullable(String value) {
        String cleaned = clean(value);
        return cleaned.isBlank() ? null : cleaned;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
