package xyz.snowlit.diary;

import xyz.snowlit.support.InMemoryObjectStore;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.support.TestImages;
import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.home.HomeMapper;
import xyz.snowlit.home.MemberLocations;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
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

class DiaryControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-17T12:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final DiaryMapper diaryMapper = mock(DiaryMapper.class);
    private final HomeMapper homeMapper = mock(HomeMapper.class);
    private final InMemoryObjectStore objects = new InMemoryObjectStore();
    private final DiaryModule diaries = new DiaryModule(diaryMapper, new MemberLocations(homeMapper), new ImageIntake(objects, CLOCK), CLOCK);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new DiaryController(diaries))
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
    void configureRole() {
    }

    @Test
    void diaryRequiresJwt() throws Exception {
        mockMvc.perform(get("/api/diary?month=2026-05"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("登录已过期，请重新登录"));
    }

    @Test
    void monthsReturnYearAndTwelveMonthStats() throws Exception {
        when(diaryMapper.findVisibleMonthCounts(1L, "boyfriend", 2026))
                .thenReturn(List.of(new DiaryMonthCount(2026, 5, 2)));

        mockMvc.perform(get("/api/diary/months?year=2026")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.years[0].year").value(2026))
                .andExpect(jsonPath("$.years[0].months[4].month").value("2026-05"))
                .andExpect(jsonPath("$.years[0].months[4].count").value(2))
                .andExpect(jsonPath("$.years[0].months[4].hasEntries").value(true));
    }

    @Test
    void monthListReturnsSummariesWithoutMarkdownBody() throws Exception {
        when(diaryMapper.findVisibleEntriesByMonth(
                1L,
                "boyfriend",
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 6, 1)
        )).thenReturn(List.of(entry()));
        when(diaryMapper.findImageUrlsByDiaryIds(List.of(10L)))
                .thenReturn(List.of(imageReference("https://cdn.example.com/one.webp")));

        mockMvc.perform(get("/api/diary?month=2026-05")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-05"))
                .andExpect(jsonPath("$.items[0].title").value("今天的光"))
                .andExpect(jsonPath("$.items[0].entryDate").value("2026-05-17"))
                .andExpect(jsonPath("$.items[0].date").doesNotExist())
                .andExpect(jsonPath("$.items[0].moodKey").value("happy"))
                .andExpect(jsonPath("$.items[0].imageUrls[0]").value("https://cdn.example.com/one.webp"))
                .andExpect(jsonPath("$.items[0].contentMarkdown").doesNotExist());
    }

    @Test
    void detailReturnsMarkdownAndSnapshotFields() throws Exception {
        when(diaryMapper.findDiaryById(10L)).thenReturn(entry());
        when(diaryMapper.findImageUrlsByDiaryId(10L))
                .thenReturn(List.of("https://cdn.example.com/one.webp"));

        mockMvc.perform(get("/api/diary/10")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentMarkdown").value("# 今天的光\n\n正文"))
                .andExpect(jsonPath("$.entryDate").value("2026-05-17"))
                .andExpect(jsonPath("$.date").doesNotExist())
                .andExpect(jsonPath("$.weather").value("晴"))
                .andExpect(jsonPath("$.locationName").value("示例街区 A"))
                .andExpect(jsonPath("$.latitude").value(52.52));
    }

    @Test
    void createUpdateDeleteAndImageUploadUseCurrentActor() throws Exception {
        doAnswer(invocation -> {
            DiaryEntry created = invocation.getArgument(0);
            created.setId(99L);
            return 1;
        }).when(diaryMapper).insertDiary(any());
        DiaryEntry existing = entry();
        when(diaryMapper.findDiaryById(10L)).thenReturn(existing);
        when(diaryMapper.findImagesReferencedByDiary(10L)).thenReturn(List.of());
        doAnswer(invocation -> {
            DiaryImage image = invocation.getArgument(0);
            image.setId(99L);
            return 1;
        }).when(diaryMapper).insertImage(any());

        mockMvc.perform(post("/api/diary")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "contentMarkdown":"# 今天的光\\n\\n正文",
                                  "date":"2026-05-17",
                                  "moodKey":"happy",
                                  "visibility":"shared"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("今天的光"));

        mockMvc.perform(put("/api/diary/10")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "contentMarkdown":"# 改过标题\\n\\n正文",
                                  "moodKey":"sweet",
                                  "visibility":"private"
                                }
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentMarkdown").value("# 改过标题\n\n正文"));

        mockMvc.perform(delete("/api/diary/10")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isNoContent());

        MockMultipartFile file = TestImages.png("file", "note.png");
        mockMvc.perform(multipart("/api/diary/images")
                        .file(file)
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadId").value(99))
                .andExpect(jsonPath("$.imageId").doesNotExist())
                .andExpect(jsonPath("$.url").value(objects.onlyStored().url()));

        verify(diaryMapper).softDeleteDiary(argThat(id -> id.equals(10L)), any());
    }

    @Test
    void diaryErrorsReturnCodeAndChineseMessage() throws Exception {
        mockMvc.perform(get("/api/diary?month=bad")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DIARY_MONTH_INVALID"))
                .andExpect(jsonPath("$.message").value("日记月份不正确"));
    }

    private DiaryEntry entry() {
        DiaryEntry diary = new DiaryEntry();
        diary.setId(10L);
        diary.setRole("girlfriend");
        diary.setAuthorUserId(1L);
        diary.setAuthorName("伴侣 B");
        diary.setContentMarkdown("# 今天的光\n\n正文");
        diary.setTitle("今天的光");
        diary.setSummary("正文");
        diary.setVisibility("shared");
        diary.setMoodKey("happy");
        diary.setEntryDate(LocalDate.of(2026, 5, 17));
        diary.setWeather("晴");
        diary.setRawWeather("晴");
        diary.setTemperature(22.0);
        diary.setWindDirection("东风");
        diary.setWindPower("≤3");
        diary.setHumidity("60");
        diary.setProvince("示例地区 A");
        diary.setCity("示例城市 A");
        diary.setDistrict("示例街区 A");
        diary.setLocationName("示例街区 A");
        diary.setLatitude(52.52);
        diary.setLongitude(13.41);
        diary.setCreatedAt(LocalDateTime.of(2026, 5, 17, 18, 0));
        diary.setUpdatedAt(LocalDateTime.of(2026, 5, 17, 18, 0));
        return diary;
    }

    private DiaryImageReference imageReference(String url) {
        DiaryImageReference reference = new DiaryImageReference();
        reference.setDiaryId(10L);
        reference.setImageUrl(url);
        return reference;
    }
}
