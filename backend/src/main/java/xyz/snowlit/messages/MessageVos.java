package xyz.snowlit.messages;

import java.time.LocalDateTime;
import java.util.List;

public final class MessageVos {

    private MessageVos() {
    }

    public record MessagePageVo(
            List<MessageVo> items,
            long total,
            int page,
            int size,
            boolean hasMore
    ) {
    }

    public record MessageVo(
            Long id,
            Long authorUserId,
            String authorName,
            String content,
            String imageUrl,
            LocalDateTime createdAt,
            boolean canDelete
    ) {
    }
}
