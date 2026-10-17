package xyz.snowlit.wishes;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.web.CurrentActor;
import xyz.snowlit.wishes.WishDtos.WishCreateDto;
import xyz.snowlit.wishes.WishDtos.WishUpdateDto;
import xyz.snowlit.wishes.WishVos.WishDetailVo;
import xyz.snowlit.wishes.WishVos.WishPageVo;
import xyz.snowlit.wishes.WishVos.WishStatsVo;
import xyz.snowlit.wishes.WishVos.WishSummaryVo;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/wishes")
public final class WishController {

    private final WishModule wishes;

    public WishController(WishModule wishes) {
        this.wishes = wishes;
    }

    @GetMapping
    public WishPageVo wishes(@CurrentActor AuthenticatedActor actor,
                             @RequestParam(required = false) String category,
                             @RequestParam(required = false) Boolean completed,
                             @RequestParam(required = false) Integer page,
                             @RequestParam(required = false) Integer size) {
        return wishes.listWishes(actor, category, completed, page, size);
    }

    @GetMapping("/summary")
    public WishStatsVo summary(@CurrentActor AuthenticatedActor actor) {
        return wishes.getWishSummary(actor);
    }

    @GetMapping("/{id}")
    public WishDetailVo wish(@CurrentActor AuthenticatedActor actor, @PathVariable Long id) {
        return wishes.getWishDetail(actor, id);
    }

    @PostMapping("/{id}/complete")
    public WishSummaryVo complete(@CurrentActor AuthenticatedActor actor,
                                  @PathVariable Long id,
                                  @RequestPart(value = "image", required = false) List<MultipartFile> images) {
        return wishes.completeWish(actor, id, requiredSingleImage(images));
    }

    @PostMapping("/{id}/reopen")
    public WishSummaryVo reopen(@CurrentActor AuthenticatedActor actor, @PathVariable Long id) {
        return wishes.reopenWish(actor, id);
    }

    @PostMapping
    public WishSummaryVo create(@CurrentActor AuthenticatedActor actor,
                                @RequestPart("payload") WishCreateDto request,
                                @RequestPart(value = "image", required = false) List<MultipartFile> images) {
        return wishes.createWish(actor, request, singleImage(images));
    }

    @PutMapping("/{id}")
    public WishSummaryVo update(@CurrentActor AuthenticatedActor actor,
                                @PathVariable Long id,
                                @RequestBody WishUpdateDto request) {
        return wishes.updateWish(actor, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentActor AuthenticatedActor actor, @PathVariable Long id) {
        wishes.deleteWish(actor, id);
    }

    private MultipartFile singleImage(List<MultipartFile> images) {
        if (images == null || images.isEmpty()) {
            return null;
        }
        if (images.size() > 1) {
            throw ApplicationFailure.invalidInput("WISH_IMAGE_LIMIT_EXCEEDED", "每个清单最多 1 张图片");
        }
        return images.get(0);
    }

    private MultipartFile requiredSingleImage(List<MultipartFile> images) {
        MultipartFile image = singleImage(images);
        if (image == null || image.isEmpty()) {
            throw ApplicationFailure.invalidInput(
                    "WISH_COMPLETION_IMAGE_REQUIRED",
                    "完成清单需要上传一张图片"
            );
        }
        return image;
    }
}
