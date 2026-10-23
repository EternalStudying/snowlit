package xyz.snowlit.story;

import java.time.LocalDateTime;
import java.util.List;

public final class StoryVos {

    private StoryVos() {
    }

    public record StoryImageUploadVo(
            String url
    ) {
    }

    public record StoryMomentListVo(
            List<StoryMomentVo> items,
            List<Integer> years,
            boolean canManage
    ) {
    }

    public record StoryMomentVo(
            Long id,
            String title,
            String content,
            LocalDateTime eventTime,
            LocalDateTime endTime,
            String locationName,
            String address,
            Double longitude,
            Double latitude,
            String category,
            List<String> images,
            Long createdByUserId,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record StoryPlaceVo(
            String name,
            String address,
            double latitude,
            double longitude,
            String countryCode
    ) {
    }

    public record StoryPlaceListVo(
            List<StoryPlaceVo> items
    ) {
    }
}
