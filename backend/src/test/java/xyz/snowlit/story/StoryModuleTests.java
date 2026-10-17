package xyz.snowlit.story;

import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.story.StoryDtos.StoryMomentUpsertDto;
import xyz.snowlit.story.StoryImages;
import xyz.snowlit.story.StoryVos.StoryImageUploadVo;
import xyz.snowlit.story.StoryVos.StoryMomentListVo;
import xyz.snowlit.story.StoryVos.StoryMomentVo;
import org.junit.jupiter.api.Test;
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
import static org.mockito.Mockito.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StoryModuleTests {

    private static final AuthenticatedActor MANAGER =
            new AuthenticatedActor(1L, "owner", "Owner", null, null, null);
    private static final AuthenticatedActor OTHER =
            new AuthenticatedActor(3L, "guest", "Guest", null, null, null);
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-21T10:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final StoryMapper storyMapper = mock(StoryMapper.class);
    private final StoryImages imageStorageService = mock(StoryImages.class);
    private final StoryModule story = new StoryModule(storyMapper, imageStorageService, CLOCK);

    @Test
    void listMomentsIsPublicAndReturnsFiltersYearsAndCanManage() {
        StoryMoment first = moment(10L, "daily", LocalDateTime.of(2026, 5, 1, 20, 0), null);
        first.setImagesJson("[\"https://cdn.example.com/story/one.webp\"]");
        when(storyMapper.findMoments("daily", 2026)).thenReturn(List.of(first));
        when(storyMapper.findAvailableYears()).thenReturn(List.of(2026, 2025));

        StoryMomentListVo publicList = story.listMoments(null, "daily", 2026);

        assertThat(publicList.canManage()).isFalse();
        assertThat(publicList.years()).containsExactly(2026, 2025);
        assertThat(publicList.items()).hasSize(1);
        assertThat(publicList.items().get(0).category()).isEqualTo("daily");
        assertThat(publicList.items().get(0).images()).containsExactly("https://cdn.example.com/story/one.webp");
        verify(storyMapper).findMoments("daily", 2026);

        when(storyMapper.findMoments(null, null)).thenReturn(List.of());
        StoryMomentListVo managerList = story.listMoments(MANAGER, null, null);

        assertThat(managerList.canManage()).isTrue();
    }

    @Test
    void detailDoesNotReturnSoftDeletedMoment() {
        StoryMoment deleted = moment(11L, "date", LocalDateTime.of(2026, 5, 2, 20, 0), null);
        deleted.setDeletedAt(LocalDateTime.of(2026, 5, 21, 18, 0));
        when(storyMapper.findMomentById(11L)).thenReturn(deleted);

        assertThatThrownBy(() -> story.getMoment(11L))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("点滴不存在");
    }

    @Test
    void createRequiresManagerUserIdOneOrTwo() {
        assertThatThrownBy(() -> story.create(OTHER, request(List.of())))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("只有站点主人可以管理点滴");

        verify(storyMapper, never()).insertMoment(any());
    }

    @Test
    void createRejectsMoreThanThreeImages() {
        StoryMomentUpsertDto request = request(List.of(
                "https://cdn.example.com/story/1.webp",
                "https://cdn.example.com/story/2.webp",
                "https://cdn.example.com/story/3.webp",
                "https://cdn.example.com/story/4.webp"
        ));

        assertThatThrownBy(() -> story.create(MANAGER, request))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("每条点滴最多 3 张图片");

        verify(storyMapper, never()).insertMoment(any());
    }

    @Test
    void createStoresSanitizedMomentAndImagesJson() {
        StoryMomentVo created = story.create(MANAGER, request("", List.of(
                "https://cdn.example.com/story/1.webp",
                "https://cdn.example.com/story/1.webp",
                "https://cdn.example.com/story/2.webp"
        )));

        assertThat(created.createdByUserId()).isEqualTo(1L);
        assertThat(created.content()).isEmpty();
        assertThat(created.endTime()).isEqualTo(LocalDateTime.of(2026, 5, 2, 20, 0));
        assertThat(created.images()).containsExactly(
                "https://cdn.example.com/story/1.webp",
                "https://cdn.example.com/story/2.webp"
        );
        verify(storyMapper).insertMoment(argThat(moment ->
                moment.getContent().isEmpty()
                        && moment.getEndTime().equals(LocalDateTime.of(2026, 5, 2, 20, 0))
                        && moment.getImagesJson().equals("[\"https://cdn.example.com/story/1.webp\",\"https://cdn.example.com/story/2.webp\"]")
        ));
    }

    @Test
    void updateAndDeleteRequireManagerAndUseSoftDelete() {
        when(storyMapper.findMomentById(20L)).thenReturn(moment(20L, "travel", LocalDateTime.of(2026, 4, 1, 10, 0), null));

        assertThatThrownBy(() -> story.update(OTHER, 20L, request(List.of())))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("只有站点主人可以管理点滴");

        story.delete(MANAGER, 20L);

        verify(storyMapper).softDeleteMoment(20L, LocalDateTime.of(2026, 5, 21, 18, 0));
    }

    @Test
    void uploadImageRequiresManagerAndValidatesImageFile() {
        MockMultipartFile file = new MockMultipartFile("file", "story.png", MediaType.IMAGE_PNG_VALUE, "png".getBytes());
        when(imageStorageService.upload(file, 1L)).thenReturn(new ObjectStore.StoredObject(
                "story/2026/05/1/one.png",
                "https://cdn.example.com/story/one.png",
                MediaType.IMAGE_PNG_VALUE,
                3L
        ));

        StoryImageUploadVo uploaded = story.uploadImage(MANAGER, file);

        assertThat(uploaded.url()).isEqualTo("https://cdn.example.com/story/one.png");

        MockMultipartFile text = new MockMultipartFile("file", "story.txt", MediaType.TEXT_PLAIN_VALUE, "text".getBytes());
        assertThatThrownBy(() -> story.uploadImage(MANAGER, text))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("只支持 jpg、png、webp、gif 图片");

        assertThatThrownBy(() -> story.uploadImage(OTHER, file))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("只有站点主人可以管理点滴");
    }

    private StoryMomentUpsertDto request(List<String> images) {
        return request("  晚风很好。  ", images);
    }

    private StoryMomentUpsertDto request(String content, List<String> images) {
        return new StoryMomentUpsertDto(
                "  第一次看海  ",
                content,
                LocalDateTime.of(2026, 5, 1, 20, 0),
                LocalDateTime.of(2026, 5, 2, 20, 0),
                "海边",
                "示例地区 B示例城市 B示例街区 B",
                18.6759,
                -15.1259,
                "travel",
                images
        );
    }

    private StoryMoment moment(Long id, String category, LocalDateTime eventTime, String imagesJson) {
        StoryMoment moment = new StoryMoment();
        moment.setId(id);
        moment.setTitle("第一次看海");
        moment.setContent("晚风很好。");
        moment.setEventTime(eventTime);
        moment.setEndTime(LocalDateTime.of(2026, 5, 2, 20, 0));
        moment.setLocationName("海边");
        moment.setAddress("示例地区 B示例城市 B示例街区 B");
        moment.setLongitude(18.6759);
        moment.setLatitude(-15.1259);
        moment.setCategory(category);
        moment.setImagesJson(imagesJson == null ? "[]" : imagesJson);
        moment.setCreatedByUserId(1L);
        moment.setCreatedAt(LocalDateTime.of(2026, 5, 1, 20, 0));
        moment.setUpdatedAt(LocalDateTime.of(2026, 5, 1, 20, 0));
        return moment;
    }
}
