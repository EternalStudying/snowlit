package xyz.snowlit.notices;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.notices.NoticeVos.UpdateNoticeMuteVo;
import xyz.snowlit.notices.NoticeVos.UpdateNoticeResponseVo;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NoticeModuleTests {

    private static final AuthenticatedActor ACTOR =
            new AuthenticatedActor(1L, "member_a", "伴侣 A", null, null, null);
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-17T04:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final NoticeMapper noticeMapper = mock(NoticeMapper.class);
    private final NoticeModule notices = new NoticeModule(noticeMapper, CLOCK);

    @Test
    void currentNoticeReturnsLatestEnabledNoticeWhenActorIsNotMuted() {
        when(noticeMapper.findMutedUntilByUserId(1L, "web")).thenReturn(null);
        when(noticeMapper.findLatestEnabled("web")).thenReturn(notice());

        UpdateNoticeResponseVo response = notices.current(ACTOR, null);

        assertThat(response.shouldShow()).isTrue();
        assertThat(response.notice()).isNotNull();
        assertThat(response.notice().title()).isEqualTo("更新小纸条");
        assertThat(response.notice().version()).isEqualTo("2026.05.17");
        assertThat(response.notice().items()).containsExactly("首页已接入真实数据", "日记页支持图片上传");
    }

    @Test
    void currentNoticeReturnsHiddenWhenNoEnabledNoticeExists() {
        when(noticeMapper.findLatestEnabled("web")).thenReturn(null);

        UpdateNoticeResponseVo response = notices.current(ACTOR, null);

        assertThat(response.shouldShow()).isFalse();
        assertThat(response.notice()).isNull();
    }

    @Test
    void currentNoticeReturnsLatestNoticeButDoesNotPromptWhileMuted() {
        when(noticeMapper.findMutedUntilByUserId(1L, "web"))
                .thenReturn(LocalDateTime.of(2026, 5, 17, 23, 59, 59));
        when(noticeMapper.findLatestEnabled("web")).thenReturn(notice());

        UpdateNoticeResponseVo response = notices.current(ACTOR, "web");

        assertThat(response.shouldShow()).isFalse();
        assertThat(response.notice()).isNotNull();
    }

    @Test
    void clientSpecificNoticeAndMuteRemainIsolated() {
        when(noticeMapper.findLatestEnabled("miniprogram")).thenReturn(miniprogramNotice());

        UpdateNoticeResponseVo response = notices.current(ACTOR, "miniprogram");
        UpdateNoticeMuteVo mute = notices.muteToday(ACTOR, "miniprogram");

        assertThat(response.notice().title()).isEqualTo("小程序更新公告");
        assertThat(mute.mutedUntil()).isEqualTo(LocalDateTime.of(2026, 5, 17, 23, 59, 59));
        verify(noticeMapper).findLatestEnabled("miniprogram");
        verify(noticeMapper).findMutedUntilByUserId(1L, "miniprogram");
        verify(noticeMapper).upsertMute(1L, "miniprogram", LocalDateTime.of(2026, 5, 17, 23, 59, 59));
    }

    private Notice notice() {
        Notice notice = new Notice();
        notice.setId(8L);
        notice.setTitle("更新小纸条");
        notice.setVersion("2026.05.17");
        notice.setItemsJson("[\"首页已接入真实数据\",\"日记页支持图片上传\"]");
        notice.setEnabled(true);
        notice.setPublishedAt(LocalDateTime.of(2026, 5, 17, 20, 0));
        return notice;
    }

    private Notice miniprogramNotice() {
        Notice notice = notice();
        notice.setId(9L);
        notice.setTitle("小程序更新公告");
        notice.setVersion("mini-1.0.1");
        notice.setClientType("miniprogram");
        return notice;
    }
}
