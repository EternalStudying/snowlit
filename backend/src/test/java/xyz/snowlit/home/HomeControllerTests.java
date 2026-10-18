package xyz.snowlit.home;

import xyz.snowlit.album.AlbumPhoto;
import xyz.snowlit.diary.DiaryEntry;
import xyz.snowlit.wishes.Wish;
import xyz.snowlit.messages.Message;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HomeControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-16T12:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final HomeMapper homeMapper = mock(HomeMapper.class);
    private final HomeModule home = new HomeModule(homeMapper, CLOCK);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new HomeController(home))
            .setCustomArgumentResolvers(requests.actorResolver())
            .setControllerAdvice(new ApiExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(
                    Jackson2ObjectMapperBuilder.json()
                            .modules(new JavaTimeModule())
                            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                            .build()
            ))
            .build();

    @BeforeEach
    void setUp() {
        when(homeMapper.findCouple()).thenReturn(new Couple(
                1L,
                "伴侣 A",
                "伴侣 B",
                LocalDate.of(2023, 2, 14),
                LocalDate.of(2023, 2, 14),
                "把普通日子过成喜欢的样子"
        ));

        DiaryEntry diary = new DiaryEntry();
        diary.setId(1L);
        diary.setTitle("第一次看海");
        diary.setEntryDate(LocalDate.of(2026, 5, 1));
        diary.setSummary("傍晚的海风很温柔，我们走了很久。");
        diary.setMoodKey("旅行");
        when(homeMapper.findLatestDiary()).thenReturn(diary);

        AlbumPhoto photo = new AlbumPhoto();
        photo.setId(1L);
        photo.setPreviewUrl("https://example.com/photo.jpg");
        photo.setCaption("周末约会");
        photo.setTakenAt(LocalDate.of(2026, 5, 1));
        when(homeMapper.findLatestPhoto()).thenReturn(photo);

        Wish wish = new Wish();
        wish.setId(1L);
        wish.setTitle("一起去看海");
        when(homeMapper.findLatestWish()).thenReturn(wish);

        Message message = new Message();
        message.setId(1L);
        message.setAuthorUserId(2L);
        message.setAuthorName("伴侣 B");
        message.setContent("晚点一起看相册。");
        message.setCreatedAt(LocalDateTime.of(2026, 5, 16, 10, 30));
        when(homeMapper.findLatestMessage()).thenReturn(message);
        when(homeMapper.countPhotos()).thenReturn(1L);
        when(homeMapper.countMessages()).thenReturn(4L);
        when(homeMapper.countWishes()).thenReturn(1L);
    }

    @Test
    void homeRequiresAuthenticatedActor() throws Exception {
        mockMvc.perform(get("/api/home"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getHomeReturnsHomepageOnlyPayloadWithoutFullLists() throws Exception {
        mockMvc.perform(get("/api/home")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.couple.boyfriendName").value("伴侣 A"))
                .andExpect(jsonPath("$.couple.girlfriendName").value("伴侣 B"))
                .andExpect(jsonPath("$.couple.startedOn").value("2023-02-14"))
                .andExpect(jsonPath("$.couple.startedAt").doesNotExist())
                .andExpect(jsonPath("$.latest.diary.title").value("第一次看海"))
                .andExpect(jsonPath("$.latest.diary.entryDate").value("2026-05-01"))
                .andExpect(jsonPath("$.latest.diary.date").doesNotExist())
                .andExpect(jsonPath("$.latest.memory").doesNotExist())
                .andExpect(jsonPath("$.latest.photo.caption").value("周末约会"))
                .andExpect(jsonPath("$.latest.photo.previewUrl").value("https://example.com/photo.jpg"))
                .andExpect(jsonPath("$.latest.photo.takenAt").value("2026-05-01"))
                .andExpect(jsonPath("$.latest.photo.url").doesNotExist())
                .andExpect(jsonPath("$.latest.wish.title").value("一起去看海"))
                .andExpect(jsonPath("$.latest.message.authorName").value("伴侣 B"))
                .andExpect(jsonPath("$.latest.message.content").value("晚点一起看相册。"))
                .andExpect(jsonPath("$.latest.message.imageUrl").doesNotExist())
                .andExpect(jsonPath("$.stats.messageCount").value(4))
                .andExpect(jsonPath("$.memories").doesNotExist())
                .andExpect(jsonPath("$.photos").doesNotExist())
                .andExpect(jsonPath("$.wishes").doesNotExist())
                .andExpect(jsonPath("$.messages").doesNotExist());
    }

    @Test
    void postHomeLocationUsesAuthenticatedActor() throws Exception {
        mockMvc.perform(post("/api/home/location")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "latitude":52.52,
                                  "longitude":13.41,
                                  "city":"示例城市 B",
                                  "district":"示例街区 B",
                                  "province":"示例地区 B",
                                  "country":"德国",
                                  "weather":"多云",
                                  "temperature":18
                                }
                                """))
                .andExpect(status().isNoContent());

        verify(homeMapper).upsertLocation(any(HomeLocation.class));
    }
}
