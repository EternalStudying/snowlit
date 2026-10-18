package xyz.snowlit.story;

import xyz.snowlit.support.InMemoryObjectStore;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.support.TestImages;
import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.auth.User;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StoryControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-21T10:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final StoryMapper storyMapper = mock(StoryMapper.class);
    private final InMemoryObjectStore objects = new InMemoryObjectStore();
    private final StoryModule story = new StoryModule(storyMapper, new ImageIntake(objects), CLOCK);
    private final AuthenticatedRequestFixture manager = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = mockMvc(manager);

    @BeforeEach
    void setUp() {
        when(storyMapper.findAvailableYears()).thenReturn(List.of(2026, 2025));
    }

    @Test
    void listAndDetailArePublicAndExposeStoryContract() throws Exception {
        when(storyMapper.findMoments("travel", 2026)).thenReturn(List.of(moment()));
        when(storyMapper.findMomentById(10L)).thenReturn(moment());

        mockMvc.perform(get("/api/story/moments?category=travel&year=2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("第一次看海"))
                .andExpect(jsonPath("$.items[0].eventTime").value("2026-05-01T20:00:00"))
                .andExpect(jsonPath("$.items[0].endTime").value("2026-05-02T20:00:00"))
                .andExpect(jsonPath("$.items[0].images[0]").value("https://cdn.example.com/story/one.webp"))
                .andExpect(jsonPath("$.items[0].createdByUserId").value(1))
                .andExpect(jsonPath("$.items[0].createdBy").doesNotExist())
                .andExpect(jsonPath("$.items[0].mood").doesNotExist())
                .andExpect(jsonPath("$.items[0].weather").doesNotExist())
                .andExpect(jsonPath("$.items[0].coverImageUrl").doesNotExist())
                .andExpect(jsonPath("$.years[0]").value(2026))
                .andExpect(jsonPath("$.canManage").value(false));

        mockMvc.perform(get("/api/story/moments/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locationName").value("海边"))
                .andExpect(jsonPath("$.endTime").value("2026-05-02T20:00:00"))
                .andExpect(jsonPath("$.createdByUserId").value(1))
                .andExpect(jsonPath("$.createdBy").doesNotExist())
                .andExpect(jsonPath("$.deletedAt").doesNotExist());

        verify(storyMapper).findMoments("travel", 2026);
        verify(storyMapper).findMomentById(10L);
    }

    @Test
    void writeEndpointsUseAuthenticatedManagerAndReturnExpectedStatuses() throws Exception {
        doAnswer(invocation -> {
            StoryMoment created = invocation.getArgument(0);
            created.setId(10L);
            return 1;
        }).when(storyMapper).insertMoment(any());
        when(storyMapper.findMomentById(10L)).thenReturn(moment());

        mockMvc.perform(post("/api/story/moments")
                        .header("Authorization", manager.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10));

        mockMvc.perform(put("/api/story/moments/10")
                        .header("Authorization", manager.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10));

        mockMvc.perform(delete("/api/story/moments/10")
                        .header("Authorization", manager.authorization()))
                .andExpect(status().isNoContent());

        MockMultipartFile file =
                TestImages.png("file", "story.png");
        mockMvc.perform(multipart("/api/story/moments/images")
                        .file(file)
                        .header("Authorization", manager.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(objects.onlyStored().url()));
    }

    @Test
    void guestWriteUsesTypedForbiddenErrorContract() throws Exception {
        AuthenticatedRequestFixture guest = new AuthenticatedRequestFixture(
                new User(3L, "guest", "Guest", "hash")
        );

        mockMvc(guest).perform(post("/api/story/moments")
                        .header("Authorization", guest.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("STORY_FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("只有站点主人可以管理点滴"));
    }

    private MockMvc mockMvc(AuthenticatedRequestFixture requests) {
        return MockMvcBuilders.standaloneSetup(new StoryController(story))
                .setCustomArgumentResolvers(requests.actorResolver())
                .setControllerAdvice(new ApiExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(
                        Jackson2ObjectMapperBuilder.json()
                                .modules(new JavaTimeModule())
                                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                                .build()
                ))
                .build();
    }

    private StoryMoment moment() {
        StoryMoment moment = new StoryMoment();
        moment.setId(10L);
        moment.setTitle("第一次看海");
        moment.setContent("晚风很好。");
        moment.setEventTime(LocalDateTime.of(2026, 5, 1, 20, 0));
        moment.setEndTime(LocalDateTime.of(2026, 5, 2, 20, 0));
        moment.setLocationName("海边");
        moment.setAddress("示例地区 B示例城市 B示例街区 B");
        moment.setLongitude(18.6759);
        moment.setLatitude(-15.1259);
        moment.setCategory("travel");
        moment.setImagesJson("[\"https://cdn.example.com/story/one.webp\"]");
        moment.setCreatedByUserId(1L);
        moment.setCreatedAt(LocalDateTime.of(2026, 5, 1, 20, 0));
        moment.setUpdatedAt(LocalDateTime.of(2026, 5, 1, 20, 0));
        return moment;
    }

    private String body() {
        return """
                {
                  "title":"第一次看海",
                  "content":"",
                  "eventTime":"2026-05-01T20:00:00",
                  "endTime":"2026-05-02T20:00:00",
                  "locationName":"海边",
                  "address":"示例地区 B示例城市 B示例街区 B",
                  "longitude":18.6759,
                  "latitude":-15.1259,
                  "category":"travel",
                  "images":["https://cdn.example.com/story/one.webp"]
                }
                """;
    }
}
