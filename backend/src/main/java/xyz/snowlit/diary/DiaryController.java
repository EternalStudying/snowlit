package xyz.snowlit.diary;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.diary.DiaryDtos.DiaryCreateDto;
import xyz.snowlit.diary.DiaryDtos.DiaryUpdateDto;
import xyz.snowlit.diary.DiaryVos.DiaryDetailVo;
import xyz.snowlit.diary.DiaryVos.DiaryImageUploadVo;
import xyz.snowlit.diary.DiaryVos.DiaryMonthListVo;
import xyz.snowlit.diary.DiaryVos.DiaryMonthsVo;
import xyz.snowlit.diary.DiaryVos.DiarySummaryVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/diary")
public final class DiaryController {

    private final DiaryModule diaries;

    public DiaryController(DiaryModule diaries) {
        this.diaries = diaries;
    }

    @GetMapping("/months")
    public DiaryMonthsVo months(@CurrentActor AuthenticatedActor actor,
                                @RequestParam(required = false) Integer year) {
        return diaries.months(actor, year);
    }

    @GetMapping
    public DiaryMonthListVo month(@CurrentActor AuthenticatedActor actor,
                                  @RequestParam String month) {
        return diaries.listByMonth(actor, month);
    }

    @GetMapping("/{id}")
    public DiaryDetailVo detail(@CurrentActor AuthenticatedActor actor,
                                @PathVariable Long id) {
        return diaries.getDetail(actor, id);
    }

    @PostMapping
    public DiarySummaryVo create(@CurrentActor AuthenticatedActor actor,
                                 @RequestBody DiaryCreateDto request) {
        return diaries.create(actor, request);
    }

    @PutMapping("/{id}")
    public DiaryDetailVo update(@CurrentActor AuthenticatedActor actor,
                                @PathVariable Long id,
                                @RequestBody DiaryUpdateDto request) {
        return diaries.update(actor, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentActor AuthenticatedActor actor,
                       @PathVariable Long id) {
        diaries.delete(actor, id);
    }

    @PostMapping("/images")
    public DiaryImageUploadVo uploadImage(@CurrentActor AuthenticatedActor actor,
                                          @RequestParam("file") MultipartFile file) {
        return diaries.uploadImage(actor, file);
    }
}
