package xyz.snowlit.notices;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.notices.NoticeVos.UpdateNoticeMuteVo;
import xyz.snowlit.notices.NoticeVos.UpdateNoticeResponseVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/update-notice")
public class NoticeController {

    private final NoticeModule notices;

    public NoticeController(NoticeModule notices) {
        this.notices = notices;
    }

    @GetMapping
    public UpdateNoticeResponseVo current(
            @CurrentActor AuthenticatedActor actor,
            @RequestParam(value = "client", defaultValue = "web") String client
    ) {
        return notices.current(actor, client);
    }

    @PostMapping("/mute-today")
    public UpdateNoticeMuteVo muteToday(
            @CurrentActor AuthenticatedActor actor,
            @RequestParam(value = "client", defaultValue = "web") String client
    ) {
        return notices.muteToday(actor, client);
    }
}
