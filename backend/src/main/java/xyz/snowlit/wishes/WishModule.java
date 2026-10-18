package xyz.snowlit.wishes;

import xyz.snowlit.paging.PageWindow;
import xyz.snowlit.text.Text;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.auth.SiteManagerPolicy;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ImagePolicy;
import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.wishes.WishDtos.WishCreateDto;
import xyz.snowlit.wishes.WishDtos.WishUpdateDto;
import xyz.snowlit.wishes.WishVos.WishDetailVo;
import xyz.snowlit.wishes.WishVos.WishPageVo;
import xyz.snowlit.wishes.WishVos.WishStatsVo;
import xyz.snowlit.wishes.WishVos.WishSummaryVo;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
public final class WishModule {

    private static final int DEFAULT_PAGE_SIZE = 8;
    private static final int MAX_PAGE_SIZE = 30;
    private static final Set<String> CATEGORIES = Set.of("want_go", "want_do");
    private static final ImagePolicy IMAGE = ImagePolicy.standard("WISH", "wish", true, "清单图片上传失败，请稍后重试");

    private final WishMapper wishMapper;
    private final ImageIntake images;
    private final Clock clock;

    public WishModule(WishMapper wishMapper, ImageIntake images, Clock clock) {
        this.wishMapper = wishMapper;
        this.images = images;
        this.clock = clock;
    }

    public WishPageVo listWishes(
            AuthenticatedActor actor,
            String category,
            Boolean completed,
            Integer page,
            Integer size
    ) {
        boolean resolvedCompleted = requireCompleted(completed);
        String resolvedCategory = normalizeCategory(category);
        validateListParams(resolvedCategory, resolvedCompleted);

        PageWindow window = PageWindow.of(page, size, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        long total = wishMapper.countWishes(resolvedCategory, resolvedCompleted);
        List<WishSummaryVo> items = wishMapper.findWishes(resolvedCategory, resolvedCompleted, window.offset(), window.size()).stream()
                .map(this::toSummary)
                .toList();
        return new WishPageVo(
                items,
                total,
                window.page(),
                window.size(),
                window.hasMore(total),
                SiteManagerPolicy.canManage(actor.userId())
        );
    }

    public WishStatsVo getWishSummary(AuthenticatedActor actor) {
        return new WishStatsVo(
                wishMapper.countWishes("want_go", false),
                wishMapper.countWishes("want_do", false),
                wishMapper.countWishes(null, true),
                SiteManagerPolicy.canManage(actor.userId())
        );
    }

    public WishDetailVo getWishDetail(AuthenticatedActor actor, Long id) {
        return toDetail(requireWish(id));
    }

    public WishSummaryVo completeWish(AuthenticatedActor actor, Long id, MultipartFile image) {
        Wish wish = requireWish(id);
        if (wish.isCompleted()) {
            throw ApplicationFailure.conflict("WISH_ALREADY_COMPLETED", "这个清单已经完成了");
        }
        String imageUrl = images.store(image, IMAGE, actor.userId()).url();
        wishMapper.completeWish(id, actor.userId(), now(), imageUrl);
        return toSummary(requireWish(id));
    }

    public WishSummaryVo reopenWish(AuthenticatedActor actor, Long id) {
        Wish wish = requireWish(id);
        if (!wish.isCompleted()) {
            throw ApplicationFailure.conflict("WISH_NOT_COMPLETED", "这个清单还没有完成");
        }

        wishMapper.reopenWish(id, actor.userId(), now());
        return toSummary(requireWish(id));
    }

    public WishSummaryVo createWish(AuthenticatedActor actor, WishCreateDto request, MultipartFile image) {
        requireManager(actor);
        validateCreateRequest(request);
        String imageUrl = null;
        if (image != null && !image.isEmpty()) {
            imageUrl = images.store(image, IMAGE, actor.userId()).url();
        }

        LocalDateTime now = now();
        Wish wish = new Wish();
        wish.setTitle(Text.trim(request.title()));
        wish.setDescription(Text.trim(request.description()));
        wish.setCategory(Text.trim(request.category()));
        wish.setCompleted(false);
        wish.setImageUrl(imageUrl);
        wish.setLocationName(Text.trimToNull(request.locationName()));
        wish.setLatitude(null);
        wish.setLongitude(null);
        wish.setNote(Text.trimToNull(request.note()));
        wish.setExpectedCompletedAt(request.expectedCompletedAt());
        wish.setCompletedAt(null);
        wish.setCreatedAt(now);
        wish.setUpdatedAt(now);
        wish.setLastOperatedByUserId(actor.userId());
        wish.setLastOperatedAt(now);
        wishMapper.insertWish(wish);
        return toSummary(wish);
    }

    public WishSummaryVo updateWish(AuthenticatedActor actor, Long id, WishUpdateDto request) {
        requireManager(actor);
        validateUpdateRequest(request);
        requireWish(id);

        LocalDateTime now = now();
        Wish wish = new Wish();
        wish.setId(id);
        wish.setTitle(Text.trim(request.title()));
        wish.setDescription(Text.trim(request.description()));
        wish.setCategory(Text.trim(request.category()));
        wish.setLocationName(Text.trimToNull(request.locationName()));
        wish.setNote(Text.trimToNull(request.note()));
        wish.setExpectedCompletedAt(request.expectedCompletedAt());
        wish.setUpdatedAt(now);
        wish.setLastOperatedByUserId(actor.userId());
        wish.setLastOperatedAt(now);
        wishMapper.updateWish(wish);
        return toSummary(requireWish(id));
    }

    public void deleteWish(AuthenticatedActor actor, Long id) {
        requireManager(actor);
        requireWish(id);
        wishMapper.deleteWish(id);
    }

    private void requireManager(AuthenticatedActor actor) {
        if (!SiteManagerPolicy.canManage(actor.userId())) {
            throw ApplicationFailure.forbidden("WISH_FORBIDDEN", "只有站点主人可以新增清单");
        }
    }

    private Wish requireWish(Long id) {
        Wish wish = wishMapper.findWishById(id);
        if (wish == null) {
            throw ApplicationFailure.notFound("WISH_NOT_FOUND", "清单项不存在");
        }
        return wish;
    }

    private boolean requireCompleted(Boolean completed) {
        if (completed == null) {
            throw ApplicationFailure.invalidInput("WISH_COMPLETED_REQUIRED", "清单完成状态不能为空");
        }
        return completed;
    }

    private void validateListParams(String category, boolean completed) {
        if (completed) {
            if (category != null) {
                throw ApplicationFailure.invalidInput("WISH_COMPLETED_CATEGORY_NOT_ALLOWED", "已完成清单不需要指定分类");
            }
            return;
        }

        if (category == null) {
            throw ApplicationFailure.invalidInput("WISH_CATEGORY_REQUIRED", "未完成清单需要指定分类");
        }
        if (!CATEGORIES.contains(category)) {
            throw ApplicationFailure.invalidInput("WISH_CATEGORY_INVALID", "清单分类不正确");
        }
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        return category.trim();
    }

    private void validateCreateRequest(WishCreateDto request) {
        if (Text.trim(request.title()).isBlank()) {
            throw ApplicationFailure.invalidInput("WISH_TITLE_REQUIRED", "清单标题不能为空");
        }
        if (!CATEGORIES.contains(Text.trim(request.category()))) {
            throw ApplicationFailure.invalidInput("WISH_CATEGORY_INVALID", "清单分类不正确");
        }
    }

    private void validateUpdateRequest(WishUpdateDto request) {
        if (Text.trim(request.title()).isBlank()) {
            throw ApplicationFailure.invalidInput("WISH_TITLE_REQUIRED", "清单标题不能为空");
        }
        if (!CATEGORIES.contains(Text.trim(request.category()))) {
            throw ApplicationFailure.invalidInput("WISH_CATEGORY_INVALID", "清单分类不正确");
        }
    }

    private WishSummaryVo toSummary(Wish wish) {
        return new WishSummaryVo(
                wish.getId(),
                wish.getTitle(),
                wish.getCategory(),
                wish.isCompleted(),
                wish.getImageUrl(),
                wish.getCreatedAt(),
                wish.getCompletedAt()
        );
    }

    private WishDetailVo toDetail(Wish wish) {
        return new WishDetailVo(
                wish.getId(),
                wish.getTitle(),
                wish.getDescription(),
                wish.getCategory(),
                wish.isCompleted(),
                wish.getImageUrl(),
                wish.getLocationName(),
                wish.getLatitude(),
                wish.getLongitude(),
                wish.getNote(),
                wish.getExpectedCompletedAt(),
                wish.getCompletedAt(),
                wish.getCreatedAt(),
                wish.getUpdatedAt(),
                wish.getLastOperatedByUserId(),
                wish.getLastOperatedAt()
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

}
