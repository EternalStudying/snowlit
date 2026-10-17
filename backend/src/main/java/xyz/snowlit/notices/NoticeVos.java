package xyz.snowlit.notices;

import java.time.LocalDateTime;
import java.util.List;

public final class NoticeVos {

    private NoticeVos() {
    }

    public record UpdateNoticeMuteVo(LocalDateTime mutedUntil) {
    }

    public record UpdateNoticeResponseVo(
            boolean shouldShow,
            UpdateNoticeVo notice
    ) {
    }

    public record UpdateNoticeVo(
            Long id,
            String title,
            String version,
            LocalDateTime publishedAt,
            List<String> items
    ) {
    }
}
