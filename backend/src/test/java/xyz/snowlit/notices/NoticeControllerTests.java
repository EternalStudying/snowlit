package xyz.snowlit.notices;

import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NoticeControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-17T04:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final NoticeMapper noticeMapper = mock(NoticeMapper.class);
    private final NoticeModule notices = new NoticeModule(noticeMapper, CLOCK);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new NoticeController(notices))
            .setCustomArgumentResolvers(requests.actorResolver())
            .setControllerAdvice(new ApiExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(
                    Jackson2ObjectMapperBuilder.json()
                            .modules(new JavaTimeModule())
                            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                            .build()
            ))
            .build();

    @Test
    void noticeRequiresAuthenticatedActor() throws Exception {
        mockMvc.perform(get("/api/update-notice"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void currentNoticePreservesWebContract() throws Exception {
        when(noticeMapper.findLatestEnabled("web")).thenReturn(notice("更新小纸条", "2026.05.17"));

        mockMvc.perform(get("/api/update-notice")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shouldShow").value(true))
                .andExpect(jsonPath("$.notice.title").value("更新小纸条"))
                .andExpect(jsonPath("$.notice.items[1]").value("清单页支持完成与撤回"));
    }

    @Test
    void miniprogramClientRemainsIsolated() throws Exception {
        when(noticeMapper.findLatestEnabled("miniprogram")).thenReturn(notice("小程序更新公告", "1.0.1"));

        mockMvc.perform(get("/api/update-notice")
                        .queryParam("client", "miniprogram")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notice.title").value("小程序更新公告"));

        verify(noticeMapper).findLatestEnabled("miniprogram");
        verify(noticeMapper).findMutedUntilByUserId(1L, "miniprogram");
    }

    @Test
    void muteTodayUsesAuthenticatedActor() throws Exception {
        mockMvc.perform(post("/api/update-notice/mute-today")
                        .queryParam("client", "miniprogram")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mutedUntil").value("2026-05-17T23:59:59"));

        verify(noticeMapper).upsertMute(1L, "miniprogram", LocalDateTime.of(2026, 5, 17, 23, 59, 59));
    }

    private Notice notice(String title, String version) {
        Notice notice = new Notice();
        notice.setId(8L);
        notice.setTitle(title);
        notice.setVersion(version);
        notice.setItemsJson("[\"首页已接入真实数据\",\"清单页支持完成与撤回\"]");
        notice.setEnabled(true);
        notice.setPublishedAt(LocalDateTime.of(2026, 5, 17, 20, 0));
        return notice;
    }
}
