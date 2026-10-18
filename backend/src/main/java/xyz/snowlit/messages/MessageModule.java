package xyz.snowlit.messages;

import xyz.snowlit.paging.PageWindow;
import xyz.snowlit.text.Text;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.messages.MessageDtos.MessageCreateDto;
import xyz.snowlit.messages.MessageVos.MessagePageVo;
import xyz.snowlit.messages.MessageVos.MessageVo;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ImagePolicy;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public final class MessageModule {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_CONTENT_LENGTH = 500;
    private static final ImagePolicy IMAGE =
            ImagePolicy.standard("MESSAGE", "messages", true, "留言图片上传失败，请稍后重试");

    private final MessageMapper messageMapper;
    private final ImageIntake images;
    private final Clock clock;

    public MessageModule(MessageMapper messageMapper, ImageIntake images, Clock clock) {
        this.messageMapper = messageMapper;
        this.images = images;
        this.clock = clock;
    }

    public MessagePageVo listMessages(AuthenticatedActor actor, Integer page, Integer size) {
        PageWindow window = PageWindow.of(page, size, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        long total = messageMapper.countMessages();
        List<MessageVo> items = messageMapper.findMessages(window.offset(), window.size()).stream()
                .map(message -> toVo(message, actor.userId()))
                .toList();
        return new MessagePageVo(items, total, window.page(), window.size(), window.hasMore(total));
    }

    public MessageVo createMessage(AuthenticatedActor actor, MessageCreateDto request, MultipartFile image) {
        validateCreateRequest(request);

        ObjectStore.StoredObject storedImage = null;
        if (image != null && !image.isEmpty()) {
            storedImage = images.store(image, IMAGE, actor.userId());
        }

        Message message = new Message();
        message.setAuthorUserId(actor.userId());
        message.setContent(Text.trim(request.content()));
        if (storedImage != null) {
            message.setImageUrl(storedImage.url());
            message.setImageObjectName(storedImage.objectName());
            message.setImageContentType(storedImage.contentType());
            message.setImageSizeBytes(storedImage.sizeBytes());
        }
        message.setCreatedAt(now());
        messageMapper.insertMessage(message);
        return toVo(messageMapper.findMessageById(message.getId()), actor.userId());
    }

    public void deleteMessage(AuthenticatedActor actor, Long id) {
        Message message = requireMessage(id);
        if (!actor.userId().equals(message.getAuthorUserId())) {
            throw ApplicationFailure.forbidden("MESSAGE_DELETE_FORBIDDEN", "只能删除自己发布的留言");
        }

        messageMapper.softDeleteMessage(id, now());
        images.deleteBestEffort(message.getImageObjectName());
    }

    public Optional<MessageHighlight> latest() {
        return Optional.ofNullable(messageMapper.findLatest())
                .map(message -> new MessageHighlight(
                        message.getId(), authorName(message), message.getContent(), message.getCreatedAt()));
    }

    public long count() {
        return messageMapper.countMessages();
    }

    private Message requireMessage(Long id) {
        Message message = messageMapper.findMessageById(id);
        if (message == null || message.getDeletedAt() != null) {
            throw ApplicationFailure.notFound("MESSAGE_NOT_FOUND", "留言不存在");
        }
        return message;
    }

    private void validateCreateRequest(MessageCreateDto request) {
        if (Text.trim(request.content()).isBlank()) {
            throw ApplicationFailure.invalidInput("MESSAGE_CONTENT_REQUIRED", "留言内容不能为空");
        }
        if (Text.trim(request.content()).length() > MAX_CONTENT_LENGTH) {
            throw ApplicationFailure.invalidInput("MESSAGE_CONTENT_TOO_LONG", "留言内容不能超过 500 字");
        }
    }

    private MessageVo toVo(Message message, Long currentUserId) {
        return new MessageVo(
                message.getId(),
                message.getAuthorUserId(),
                authorName(message),
                message.getContent(),
                message.getImageUrl(),
                message.getCreatedAt(),
                currentUserId.equals(message.getAuthorUserId())
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private static String authorName(Message message) {
        return Text.trim(message.getAuthorName()).isBlank() ? "Snowlit" : message.getAuthorName();
    }
}
