package xyz.snowlit.messages;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.messages.MessageDtos.MessageCreateDto;
import xyz.snowlit.messages.MessageVos.MessagePageVo;
import xyz.snowlit.messages.MessageVos.MessageVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageModule messages;

    public MessageController(MessageModule messages) {
        this.messages = messages;
    }

    @GetMapping
    public MessagePageVo messages(@CurrentActor AuthenticatedActor actor,
                                  @RequestParam(required = false) Integer page,
                                  @RequestParam(required = false) Integer size) {
        return messages.listMessages(actor, page, size);
    }

    @PostMapping
    public MessageVo create(@CurrentActor AuthenticatedActor actor,
                            @RequestPart("payload") MessageCreateDto request,
                            @RequestPart(value = "image", required = false) List<MultipartFile> images) {
        return messages.createMessage(actor, request, singleImage(images));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentActor AuthenticatedActor actor,
                       @PathVariable Long id) {
        messages.deleteMessage(actor, id);
    }

    private MultipartFile singleImage(List<MultipartFile> images) {
        if (images == null || images.isEmpty()) {
            return null;
        }
        if (images.size() > 1) {
            throw ApplicationFailure.invalidInput("MESSAGE_IMAGE_LIMIT_EXCEEDED", "每条留言最多 1 张图片");
        }
        return images.get(0);
    }
}
