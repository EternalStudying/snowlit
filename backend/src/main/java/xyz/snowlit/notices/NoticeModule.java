package xyz.snowlit.notices;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.notices.NoticeVos.UpdateNoticeMuteVo;
import xyz.snowlit.notices.NoticeVos.UpdateNoticeResponseVo;
import xyz.snowlit.notices.NoticeVos.UpdateNoticeVo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
public final class NoticeModule {

    private static final String CLIENT_WEB = "web";
    private static final String CLIENT_MINIPROGRAM = "miniprogram";

    private final NoticeMapper noticeMapper;
    private final Clock clock;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public NoticeModule(NoticeMapper noticeMapper) {
        this(noticeMapper, Clock.systemDefaultZone());
    }

    public NoticeModule(NoticeMapper noticeMapper, Clock clock) {
        this.noticeMapper = noticeMapper;
        this.clock = clock;
    }

    public UpdateNoticeResponseVo current(AuthenticatedActor actor, String client) {
        String clientType = normalizeClientType(client);
        LocalDateTime now = now();
        Notice notice = noticeMapper.findLatestEnabled(clientType);
        if (notice == null) {
            return new UpdateNoticeResponseVo(false, null);
        }

        LocalDateTime mutedUntil = noticeMapper.findMutedUntilByUserId(actor.userId(), clientType);
        if (mutedUntil != null && !mutedUntil.isBefore(now)) {
            return new UpdateNoticeResponseVo(false, toVo(notice));
        }
        return new UpdateNoticeResponseVo(true, toVo(notice));
    }

    public UpdateNoticeMuteVo muteToday(AuthenticatedActor actor, String client) {
        String clientType = normalizeClientType(client);
        LocalDateTime mutedUntil = now().toLocalDate().atTime(LocalTime.of(23, 59, 59));
        noticeMapper.upsertMute(actor.userId(), clientType, mutedUntil);
        return new UpdateNoticeMuteVo(mutedUntil);
    }

    private UpdateNoticeVo toVo(Notice notice) {
        return new UpdateNoticeVo(
                notice.getId(),
                clean(notice.getTitle()),
                clean(notice.getVersion()),
                notice.getPublishedAt(),
                parseItems(notice.getItemsJson())
        );
    }

    private List<String> parseItems(String itemsJson) {
        try {
            List<String> items = objectMapper.readValue(clean(itemsJson), new TypeReference<>() {
            });
            return items.stream()
                    .map(this::clean)
                    .filter(item -> !item.isBlank())
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private String normalizeClientType(String client) {
        return CLIENT_MINIPROGRAM.equalsIgnoreCase(clean(client)) ? CLIENT_MINIPROGRAM : CLIENT_WEB;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
