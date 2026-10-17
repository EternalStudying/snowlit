package xyz.snowlit.feedback;

import java.time.LocalDateTime;

public final class FeedbackVos {

    private FeedbackVos() {
    }

    public record FeedbackImageUploadVo(String url) {
    }

    public record FeedbackSubmitVo(Long id, String status, LocalDateTime createdAt) {
    }
}
