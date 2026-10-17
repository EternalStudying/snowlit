package xyz.snowlit.story;

import java.time.LocalDateTime;
import java.util.List;

public final class StoryDtos {

    private StoryDtos() {
    }

    public record StoryMomentUpsertDto(
            String title,
            String content,
            LocalDateTime eventTime,
            LocalDateTime endTime,
            String locationName,
            String address,
            Double longitude,
            Double latitude,
            String category,
            List<String> images
    ) {
    }
}
