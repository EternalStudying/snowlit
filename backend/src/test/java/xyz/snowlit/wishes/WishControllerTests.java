package xyz.snowlit.wishes;

import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.wishes.WishImages;
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

class WishControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-16T12:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final WishMapper wishMapper = mock(WishMapper.class);
    private final WishImages imageStorage = mock(WishImages.class);
    private final WishModule wishes = new WishModule(wishMapper, imageStorage, CLOCK);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new WishController(wishes))
            .addInterceptors(requests.actorResolver(), requests.authenticationRequired())
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
    void wishesRequireAuthenticatedActor() throws Exception {
        mockMvc.perform(get("/api/wishes?category=want_go&completed=false&page=1&size=8"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void listSummaryAndDetailKeepExistingResponseContracts() throws Exception {
        when(wishMapper.countWishes("want_go", false)).thenReturn(12L);
        when(wishMapper.findWishes("want_go", false, 0, 8))
                .thenReturn(List.of(wish(false)));

        mockMvc.perform(get("/api/wishes?category=want_go&completed=false&page=1&size=8")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("一起去海边看日落"))
                .andExpect(jsonPath("$.items[0].category").value("want_go"))
                .andExpect(jsonPath("$.items[0].completed").value(false))
                .andExpect(jsonPath("$.items[0].description").doesNotExist())
                .andExpect(jsonPath("$.total").value(12))
                .andExpect(jsonPath("$.canManage").value(true));

        when(wishMapper.countWishes("want_go", false)).thenReturn(6L);
        when(wishMapper.countWishes("want_do", false)).thenReturn(4L);
        when(wishMapper.countWishes(null, true)).thenReturn(12L);
        mockMvc.perform(get("/api/wishes/summary")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wantGoCount").value(6))
                .andExpect(jsonPath("$.wantDoCount").value(4))
                .andExpect(jsonPath("$.completedCount").value(12));

        when(wishMapper.findWishById(1L)).thenReturn(wish(false));
        mockMvc.perform(get("/api/wishes/1")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("找一个傍晚慢慢走到海边。"))
                .andExpect(jsonPath("$.locationName").value("尼斯海滨大道"))
                .andExpect(jsonPath("$.lastOperatedByUserId").value(1))
                .andExpect(jsonPath("$.lastOperatedBy").doesNotExist());
    }

    @Test
    void completeAndReopenUseSingleImageContract() throws Exception {
        Wish pending = wish(false);
        Wish completed = wish(true);
        when(wishMapper.findWishById(1L)).thenReturn(pending, completed, completed, pending);
        when(imageStorage.upload(any(), any())).thenReturn(new ObjectStore.StoredObject(
                "wish/done.jpg",
                "/wish-assets/sea-sunset.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                5L
        ));

        mockMvc.perform(multipart("/api/wishes/1/complete")
                        .file(new MockMultipartFile("image", "done.jpg", MediaType.IMAGE_JPEG_VALUE, "image".getBytes()))
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true));

        mockMvc.perform(post("/api/wishes/1/reopen")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(false));
    }

    @Test
    void completionRequiresExactlyOneImage() throws Exception {
        mockMvc.perform(multipart("/api/wishes/1/complete")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WISH_COMPLETION_IMAGE_REQUIRED"));

        mockMvc.perform(multipart("/api/wishes/1/complete")
                        .file(new MockMultipartFile("image", "first.webp", "image/webp", "first".getBytes()))
                        .file(new MockMultipartFile("image", "second.webp", "image/webp", "second".getBytes()))
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WISH_IMAGE_LIMIT_EXCEEDED"));
    }

    @Test
    void createAcceptsMultipartPayloadAndOptionalImage() throws Exception {
        doAnswer(invocation -> {
            Wish created = invocation.getArgument(0);
            created.setId(1L);
            return 1;
        }).when(wishMapper).insertWish(any());
        when(wishMapper.findWishById(1L)).thenReturn(wish(false));
        when(imageStorage.upload(any(), any())).thenReturn(new ObjectStore.StoredObject(
                "wish/create.jpg",
                "/wish-assets/sea-sunset.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                5L
        ));

        mockMvc.perform(multipart("/api/wishes")
                        .file(new MockMultipartFile("payload", "", MediaType.APPLICATION_JSON_VALUE, """
                                {
                                  "title":"一起去海边",
                                  "category":"want_go",
                                  "description":"看日落",
                                  "locationName":"尼斯",
                                  "expectedCompletedAt":"2026-06-01T18:00:00",
                                  "note":"带相机"
                                }
                                """.getBytes()))
                        .file(new MockMultipartFile("image", "wish.jpg", MediaType.IMAGE_JPEG_VALUE, "image".getBytes()))
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("一起去海边看日落"));
    }

    @Test
    void updateAndDeleteUseJsonContracts() throws Exception {
        Wish before = wish(false);
        Wish after = wish(false);
        after.setTitle("一起去植物园");
        when(wishMapper.findWishById(1L)).thenReturn(before, after, after);

        mockMvc.perform(put("/api/wishes/1")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"一起去植物园",
                                  "category":"want_go",
                                  "description":"慢慢拍照",
                                  "locationName":"",
                                  "expectedCompletedAt":"2026-06-14T00:00:00",
                                  "note":""
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("一起去植物园"));

        mockMvc.perform(delete("/api/wishes/1")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isNoContent());

        verify(wishMapper).deleteWish(1L);
    }

    @Test
    void typedWishValidationKeepsStableErrorContract() throws Exception {
        mockMvc.perform(get("/api/wishes?completed=false&page=1&size=8")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WISH_CATEGORY_REQUIRED"))
                .andExpect(jsonPath("$.message").value("未完成清单需要指定分类"));
    }

    private Wish wish(boolean completed) {
        Wish wish = new Wish();
        wish.setId(1L);
        wish.setTitle("一起去海边看日落");
        wish.setDescription("找一个傍晚慢慢走到海边。");
        wish.setCategory("want_go");
        wish.setCompleted(completed);
        wish.setImageUrl("/wish-assets/sea-sunset.jpg");
        wish.setLocationName("尼斯海滨大道");
        wish.setLatitude(24.435);
        wish.setLongitude(118.125);
        wish.setNote("记得带相机和薄外套。");
        wish.setExpectedCompletedAt(LocalDateTime.of(2026, 6, 1, 18, 0));
        wish.setCompletedAt(completed ? LocalDateTime.of(2026, 5, 16, 20, 0) : null);
        wish.setCreatedAt(LocalDateTime.of(2026, 5, 16, 10, 0));
        wish.setUpdatedAt(LocalDateTime.of(2026, 5, 16, 10, 0));
        wish.setLastOperatedByUserId(1L);
        wish.setLastOperatedAt(LocalDateTime.of(2026, 5, 16, 10, 0));
        return wish;
    }
}
