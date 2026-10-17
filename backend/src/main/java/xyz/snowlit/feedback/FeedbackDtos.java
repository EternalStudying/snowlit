package xyz.snowlit.feedback;

import java.util.List;

public final class FeedbackDtos {

    private FeedbackDtos() {
    }

    public record FeedbackCreateDto(
            String type,
            String title,
            String content,
            String contact,
            List<String> imageUrls,
            String pageUrl,
            String userAgent
    ) {
    }
}
