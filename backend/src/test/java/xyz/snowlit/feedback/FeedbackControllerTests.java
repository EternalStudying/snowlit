package xyz.snowlit.feedback;

import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.support.InMemoryObjectStore;
import xyz.snowlit.support.TestImages;

import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FeedbackControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-17T12:30:00Z"), ZoneId.of("Asia/Singapore"));

    private final FeedbackMapper feedbackMapper = mock(FeedbackMapper.class);
    private final InMemoryObjectStore objects = new InMemoryObjectStore();
    private final FeedbackModule feedback = new FeedbackModule(feedbackMapper, new ImageIntake(objects, CLOCK), CLOCK);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new FeedbackController(feedback))
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
    void feedbackRequiresAuthenticatedActor() throws Exception {
        mockMvc.perform(post("/api/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void uploadScreenshotProductEntryReturnsSystemUrl() throws Exception {
        MockMultipartFile file = TestImages.png("file", "shot.png");

        mockMvc.perform(multipart("/api/feedback/screenshots")
                        .file(file)
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(objects.onlyStored().url()));
    }

    @Test
    void submitFeedbackReturnsPendingStatus() throws Exception {
        doAnswer(invocation -> {
            Feedback saved = invocation.getArgument(0);
            saved.setId(88L);
            return 1;
        }).when(feedbackMapper).insertFeedback(any());

        mockMvc.perform(post("/api/feedback")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type":"bug",
                                  "title":"相册问题",
                                  "content":"私密按钮没有反应",
                                  "contact":"微信：abc",
                                  "imageUrls":[],
                                  "pageUrl":"http://127.0.0.1:5173/albums",
                                  "userAgent":"Edge"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(88))
                .andExpect(jsonPath("$.status").value("pending"))
                .andExpect(jsonPath("$.createdAt").value("2026-05-17T20:30:00"));
    }

    @Test
    void typedFeedbackFailuresKeepStableCodeAndChineseMessage() throws Exception {
        mockMvc.perform(post("/api/feedback")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("FEEDBACK_TYPE_INVALID"))
                .andExpect(jsonPath("$.message").value("反馈类型不正确"));
    }
}
