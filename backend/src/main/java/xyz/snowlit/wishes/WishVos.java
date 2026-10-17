package xyz.snowlit.wishes;

import java.time.LocalDateTime;
import java.util.List;

public final class WishVos {

    private WishVos() {
    }

    public record WishDetailVo(
            Long id,
            String title,
            String description,
            String category,
            boolean completed,
            String imageUrl,
            String locationName,
            Double latitude,
            Double longitude,
            String note,
            LocalDateTime expectedCompletedAt,
            LocalDateTime completedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            Long lastOperatedByUserId,
            LocalDateTime lastOperatedAt
    ) {
    }

    public record WishItemVo(Long id, String title, boolean done) {
    }

    public record WishPageVo(
            List<WishSummaryVo> items,
            long total,
            int page,
            int size,
            boolean hasMore,
            boolean canManage
    ) {
    }

    public record WishStatsVo(
            long wantGoCount,
            long wantDoCount,
            long completedCount,
            boolean canManage
    ) {
    }

    public record WishSummaryVo(
            Long id,
            String title,
            String category,
            boolean completed,
            String imageUrl,
            LocalDateTime createdAt,
            LocalDateTime completedAt
    ) {
    }
}
