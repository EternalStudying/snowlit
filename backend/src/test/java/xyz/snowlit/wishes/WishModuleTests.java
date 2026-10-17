package xyz.snowlit.wishes;

import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.wishes.WishImages;
import xyz.snowlit.wishes.WishDtos.WishCreateDto;
import xyz.snowlit.wishes.WishDtos.WishUpdateDto;
import xyz.snowlit.wishes.WishVos.WishDetailVo;
import xyz.snowlit.wishes.WishVos.WishPageVo;
import xyz.snowlit.wishes.WishVos.WishStatsVo;
import xyz.snowlit.wishes.WishVos.WishSummaryVo;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WishModuleTests {

    private static final AuthenticatedActor MANAGER =
            new AuthenticatedActor(1L, "owner", "Owner", null, null, null);
    private static final AuthenticatedActor GUEST =
            new AuthenticatedActor(3L, "guest", "Guest", null, null, null);
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-16T12:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final WishMapper wishMapper = mock(WishMapper.class);
    private final WishImages imageStorage = mock(WishImages.class);
    private final WishModule wishes = new WishModule(wishMapper, imageStorage, CLOCK);

    @Test
    void listReturnsPagedSummaryAndManagerCapability() {
        when(wishMapper.countWishes("want_go", false)).thenReturn(12L);
        when(wishMapper.findWishes("want_go", false, 0, 8))
                .thenReturn(List.of(wish(1L, "想去海边", "want_go", false)));

        WishPageVo page = wishes.listWishes(MANAGER, "want_go", false, 1, 8);

        assertThat(page.total()).isEqualTo(12);
        assertThat(page.hasMore()).isTrue();
        assertThat(page.canManage()).isTrue();
        assertThat(page.items()).extracting(WishSummaryVo::title).containsExactly("想去海边");
        assertThat(Arrays.stream(WishSummaryVo.class.getRecordComponents()).map(component -> component.getName()))
                .containsExactly("id", "title", "category", "completed", "imageUrl", "createdAt", "completedAt");

        when(wishMapper.countWishes("want_do", false)).thenReturn(0L);
        when(wishMapper.findWishes("want_do", false, 0, 8)).thenReturn(List.of());
        assertThat(wishes.listWishes(GUEST, "want_do", false, 1, 8).canManage()).isFalse();
    }

    @Test
    void summaryAggregatesCounts() {
        when(wishMapper.countWishes("want_go", false)).thenReturn(6L);
        when(wishMapper.countWishes("want_do", false)).thenReturn(4L);
        when(wishMapper.countWishes(null, true)).thenReturn(12L);

        WishStatsVo summary = wishes.getWishSummary(MANAGER);

        assertThat(summary).isEqualTo(new WishStatsVo(6, 4, 12, true));
    }

    @Test
    void listValidatesCategoryAndCompletedSemantics() {
        assertFailure(
                () -> wishes.listWishes(MANAGER, null, false, 1, 8),
                "WISH_CATEGORY_REQUIRED"
        );
        assertFailure(
                () -> wishes.listWishes(MANAGER, "want_go", true, 1, 8),
                "WISH_COMPLETED_CATEGORY_NOT_ALLOWED"
        );
        assertFailure(
                () -> wishes.listWishes(MANAGER, "travel", false, 1, 8),
                "WISH_CATEGORY_INVALID"
        );
    }

    @Test
    void createRequiresManagerAndStoresOptionalImage() {
        assertFailure(
                () -> wishes.createWish(GUEST, createRequest("want_go"), null),
                "WISH_FORBIDDEN"
        );
        verify(wishMapper, never()).insertWish(any());

        MockMultipartFile image =
                new MockMultipartFile("image", "wish.jpg", MediaType.IMAGE_JPEG_VALUE, "image".getBytes());
        when(imageStorage.upload(image, 1L)).thenReturn(new ObjectStore.StoredObject(
                "wish/1/wish.jpg",
                "https://cdn.example.com/wish/wish.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                5L
        ));
        doAnswer(invocation -> {
            Wish created = invocation.getArgument(0);
            created.setId(88L);
            return 1;
        }).when(wishMapper).insertWish(any());
        when(wishMapper.findWishById(88L))
                .thenReturn(wish(88L, "一起去海边", "want_go", false));

        WishSummaryVo created = wishes.createWish(MANAGER, createRequest("want_go"), image);

        assertThat(created.id()).isEqualTo(88L);
        verify(wishMapper).insertWish(argThat(wish ->
                "一起去海边".equals(wish.getTitle())
                        && !wish.isCompleted()
                        && "https://cdn.example.com/wish/wish.jpg".equals(wish.getImageUrl())
                        && wish.getLastOperatedByUserId().equals(1L)
                        && wish.getCreatedAt().equals(LocalDateTime.of(2026, 5, 16, 20, 0))
        ));
    }

    @Test
    void createValidatesPayloadAndImage() {
        assertFailure(
                () -> wishes.createWish(MANAGER, createRequest("done"), null),
                "WISH_CATEGORY_INVALID"
        );
        assertFailure(
                () -> wishes.createWish(
                        MANAGER,
                        new WishCreateDto(" ", "want_do", "", "", null, ""),
                        null
                ),
                "WISH_TITLE_REQUIRED"
        );

        MockMultipartFile text =
                new MockMultipartFile("image", "wish.txt", MediaType.TEXT_PLAIN_VALUE, "text".getBytes());
        assertFailure(
                () -> wishes.createWish(MANAGER, createRequest("want_do"), text),
                "WISH_IMAGE_TYPE_INVALID"
        );
    }

    @Test
    void detailReturnsFullFieldsAndNotFoundIsTyped() {
        when(wishMapper.findWishById(1L)).thenReturn(wish(1L, "想去海边", "want_go", false));

        WishDetailVo detail = wishes.getWishDetail(MANAGER, 1L);

        assertThat(detail.title()).isEqualTo("想去海边");
        assertThat(detail.locationName()).isEqualTo("尼斯海滨大道");
        assertThat(detail.note()).isEqualTo("带相机。");

        assertFailure(() -> wishes.getWishDetail(MANAGER, 404L), "WISH_NOT_FOUND");
    }

    @Test
    void completeAndReopenUseActorAndServerTime() {
        MockMultipartFile image =
                new MockMultipartFile("image", "done.jpg", MediaType.IMAGE_JPEG_VALUE, "image".getBytes());
        Wish pending = wish(1L, "想去海边", "want_go", false);
        Wish completed = wish(1L, "想去海边", "want_go", true);
        completed.setCompletedAt(LocalDateTime.of(2026, 5, 16, 20, 0));
        completed.setImageUrl("https://cdn.example.com/wish/done.jpg");
        when(imageStorage.upload(image, 1L)).thenReturn(new ObjectStore.StoredObject(
                "wish/1/done.jpg",
                "https://cdn.example.com/wish/done.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                5L
        ));
        when(wishMapper.findWishById(1L)).thenReturn(pending, completed, completed, pending);

        assertThat(wishes.completeWish(MANAGER, 1L, image).completed()).isTrue();
        verify(wishMapper).completeWish(
                1L,
                1L,
                LocalDateTime.of(2026, 5, 16, 20, 0),
                "https://cdn.example.com/wish/done.jpg"
        );

        assertThat(wishes.reopenWish(MANAGER, 1L).completed()).isFalse();
        verify(wishMapper).reopenWish(1L, 1L, LocalDateTime.of(2026, 5, 16, 20, 0));
    }

    @Test
    void completeAndReopenValidateImageAndState() {
        MockMultipartFile image =
                new MockMultipartFile("image", "done.jpg", MediaType.IMAGE_JPEG_VALUE, "image".getBytes());
        when(wishMapper.findWishById(1L)).thenReturn(wish(1L, "已完成", "want_do", true));
        assertFailure(() -> wishes.completeWish(MANAGER, 1L, image), "WISH_ALREADY_COMPLETED");

        when(wishMapper.findWishById(2L)).thenReturn(wish(2L, "未完成", "want_do", false));
        assertFailure(() -> wishes.reopenWish(MANAGER, 2L), "WISH_NOT_COMPLETED");

        when(wishMapper.findWishById(3L)).thenReturn(wish(3L, "未完成", "want_do", false));
        assertFailure(() -> wishes.completeWish(MANAGER, 3L, null), "WISH_COMPLETION_IMAGE_REQUIRED");
        verify(imageStorage, never()).upload(any(), any());
    }

    @Test
    void updateAndDeleteRequireManagerAndPersistActor() {
        Wish current = wish(1L, "旧标题", "want_go", false);
        Wish updated = wish(1L, "一起去植物园", "want_do", false);
        when(wishMapper.findWishById(1L)).thenReturn(current, updated, updated);

        WishSummaryVo summary = wishes.updateWish(MANAGER, 1L, updateRequest("want_do"));

        assertThat(summary.title()).isEqualTo("一起去植物园");
        verify(wishMapper).updateWish(argThat(wish ->
                wish.getId().equals(1L)
                        && "want_do".equals(wish.getCategory())
                        && wish.getLastOperatedByUserId().equals(1L)
        ));

        wishes.deleteWish(MANAGER, 1L);
        verify(wishMapper).deleteWish(1L);

        assertFailure(() -> wishes.updateWish(GUEST, 1L, updateRequest("want_go")), "WISH_FORBIDDEN");
        assertFailure(() -> wishes.deleteWish(GUEST, 1L), "WISH_FORBIDDEN");
    }

    private void assertFailure(Runnable action, String code) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo(code)
                );
    }

    private Wish wish(Long id, String title, String category, boolean completed) {
        Wish wish = new Wish();
        wish.setId(id);
        wish.setTitle(title);
        wish.setDescription("一起看日落。");
        wish.setCategory(category);
        wish.setCompleted(completed);
        wish.setImageUrl("/wish-assets/sea-sunset.jpg");
        wish.setLocationName("尼斯海滨大道");
        wish.setLatitude(24.435);
        wish.setLongitude(118.125);
        wish.setNote("带相机。");
        wish.setExpectedCompletedAt(LocalDateTime.of(2026, 6, 1, 18, 0));
        wish.setCreatedAt(LocalDateTime.of(2026, 5, 16, 10, 0));
        wish.setUpdatedAt(LocalDateTime.of(2026, 5, 16, 10, 0));
        wish.setLastOperatedByUserId(1L);
        wish.setLastOperatedAt(LocalDateTime.of(2026, 5, 16, 10, 0));
        if (completed) {
            wish.setCompletedAt(LocalDateTime.of(2026, 5, 15, 20, 0));
        }
        return wish;
    }

    private WishCreateDto createRequest(String category) {
        return new WishCreateDto(
                " 一起去海边 ",
                category,
                " 找一个傍晚慢慢走 ",
                " 尼斯海滨大道 ",
                LocalDateTime.of(2026, 6, 1, 18, 0),
                " 带相机 "
        );
    }

    private WishUpdateDto updateRequest(String category) {
        return new WishUpdateDto(
                " 一起去植物园 ",
                category,
                " 记下来 ",
                " ",
                LocalDateTime.of(2026, 6, 14, 0, 0),
                " "
        );
    }
}
