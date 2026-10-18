package xyz.snowlit.feedback;

import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.feedback.FeedbackDtos.FeedbackCreateDto;
import xyz.snowlit.feedback.FeedbackVos.FeedbackImageUploadVo;
import xyz.snowlit.feedback.FeedbackVos.FeedbackSubmitVo;
import xyz.snowlit.feedback.FeedbackImages;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedbackModuleTests {

    private static final AuthenticatedActor ACTOR =
            new AuthenticatedActor(1L, "member_a", "伴侣 A", null, null, null, null);
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-17T04:30:00Z"), ZoneId.of("Asia/Singapore"));
    private static final String IMAGE_URL = "https://cdn.example.com/feedback/2026/05/one.webp";

    private final FeedbackMapper feedbackMapper = mock(FeedbackMapper.class);
    private final FeedbackImages imageStorage = mock(FeedbackImages.class);
    private final FeedbackModule feedback = new FeedbackModule(feedbackMapper, imageStorage, CLOCK);

    @Test
    void uploadImageRejectsUnsupportedTypeAndOversizeFile() {
        MockMultipartFile text =
                new MockMultipartFile("file", "note.txt", MediaType.TEXT_PLAIN_VALUE, "bad".getBytes());

        assertThatThrownBy(() -> feedback.uploadImage(ACTOR, text))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("截图只支持 jpg、jpeg、png、webp");

        byte[] bytes = new byte[10 * 1024 * 1024 + 1];
        MockMultipartFile huge =
                new MockMultipartFile("file", "huge.png", MediaType.IMAGE_PNG_VALUE, bytes);
        assertThatThrownBy(() -> feedback.uploadImage(ACTOR, huge))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("截图不能超过 10MB");

        verify(imageStorage, never()).upload(any(), any());
    }

    @Test
    void uploadImageStoresRegisteredSystemUrlForAuthenticatedActor() {
        MockMultipartFile file = new MockMultipartFile("file", "shot.webp", "image/webp", "webp".getBytes());
        when(imageStorage.upload(file, 1L)).thenReturn(new ObjectStore.StoredObject(
                "feedback/2026/05/one.webp",
                IMAGE_URL,
                "image/webp",
                4L
        ));

        FeedbackImageUploadVo response = feedback.uploadImage(ACTOR, file);

        assertThat(response.url()).isEqualTo(IMAGE_URL);
        ArgumentCaptor<FeedbackImage> imageCaptor = ArgumentCaptor.forClass(FeedbackImage.class);
        verify(feedbackMapper).insertImage(imageCaptor.capture());
        assertThat(imageCaptor.getValue().getUserId()).isEqualTo(1L);
        assertThat(imageCaptor.getValue().getUrl()).isEqualTo(IMAGE_URL);
    }

    @Test
    void submitValidatesRequiredFieldsAndImageLimit() {
        assertThatThrownBy(() -> feedback.submit(ACTOR, request("wrong", "标题", "内容", List.of())))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("反馈类型不正确");
        assertThatThrownBy(() -> feedback.submit(ACTOR, request("bug", " ", "内容", List.of())))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("反馈标题不能为空");
        assertThatThrownBy(() -> feedback.submit(ACTOR, request("bug", "标题", " ", List.of())))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("反馈内容不能为空");
        assertThatThrownBy(() -> feedback.submit(
                ACTOR,
                request("bug", "标题", "内容", List.of("1", "2", "3", "4"))
        )).isInstanceOf(ApplicationFailure.class)
                .hasMessage("最多只能上传 3 张截图");
    }

    @Test
    void submitRejectsUnregisteredOrForeignImages() {
        when(feedbackMapper.findImagesByUrls(List.of("https://evil.example.com/outside.png")))
                .thenReturn(List.of());
        assertThatThrownBy(() -> feedback.submit(
                ACTOR,
                request("bug", "标题", "内容", List.of("https://evil.example.com/outside.png"))
        )).isInstanceOf(ApplicationFailure.class)
                .hasMessage("只能提交本系统上传的截图");

        when(feedbackMapper.findImagesByUrls(List.of(IMAGE_URL))).thenReturn(List.of(image(2L, IMAGE_URL)));
        assertThatThrownBy(() -> feedback.submit(
                ACTOR,
                request("bug", "标题", "内容", List.of(IMAGE_URL))
        )).isInstanceOf(ApplicationFailure.class)
                .hasMessage("只能提交本系统上传的截图");

        verify(feedbackMapper, never()).insertFeedback(any(Feedback.class));
    }

    @Test
    void submitStoresPendingFeedbackForAuthenticatedActor() {
        when(feedbackMapper.findImagesByUrls(List.of(IMAGE_URL))).thenReturn(List.of(image(1L, IMAGE_URL)));
        doAnswer(invocation -> {
            Feedback saved = invocation.getArgument(0);
            saved.setId(88L);
            return 1;
        }).when(feedbackMapper).insertFeedback(any(Feedback.class));

        FeedbackSubmitVo response = feedback.submit(ACTOR, new FeedbackCreateDto(
                "experience",
                "相册体验",
                "按钮反馈有点慢",
                "微信：abc",
                List.of(IMAGE_URL),
                "http://127.0.0.1:5173/albums",
                "Edge"
        ));

        assertThat(response.id()).isEqualTo(88L);
        assertThat(response.status()).isEqualTo("pending");
        assertThat(response.createdAt()).isEqualTo(LocalDateTime.of(2026, 5, 17, 12, 30));
        ArgumentCaptor<Feedback> feedbackCaptor = ArgumentCaptor.forClass(Feedback.class);
        verify(feedbackMapper).insertFeedback(feedbackCaptor.capture());
        assertThat(feedbackCaptor.getValue().getUserId()).isEqualTo(1L);
        assertThat(feedbackCaptor.getValue().getType()).isEqualTo("experience");
        assertThat(feedbackCaptor.getValue().getStatus()).isEqualTo("pending");
        assertThat(feedbackCaptor.getValue().getImageUrlsJson()).contains(IMAGE_URL);
    }

    private FeedbackCreateDto request(String type, String title, String content, List<String> imageUrls) {
        return new FeedbackCreateDto(type, title, content, null, imageUrls, "/", "ua");
    }

    private FeedbackImage image(Long userId, String url) {
        FeedbackImage image = new FeedbackImage();
        image.setId(7L);
        image.setUserId(userId);
        image.setObjectName("feedback/2026/05/one.webp");
        image.setUrl(url);
        image.setContentType("image/webp");
        image.setSizeBytes(4L);
        image.setCreatedAt(LocalDateTime.of(2026, 5, 17, 12, 0));
        return image;
    }
}
