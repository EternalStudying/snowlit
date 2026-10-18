package xyz.snowlit.messages;

import xyz.snowlit.text.Text;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.messages.MessageDtos.MessageCreateDto;
import xyz.snowlit.messages.MessageVos.MessagePageVo;
import xyz.snowlit.messages.MessageVos.MessageVo;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
public final class MessageModule {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;
    private static final int MAX_CONTENT_LENGTH = 500;
    private static final long MAX_IMAGE_SIZE = 10L * 1024L * 1024L;
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final MessageMapper messageMapper;
    private final MessageImages messageImageStorageService;
    private final Clock clock;

    @Autowired
    public MessageModule(MessageMapper messageMapper, MessageImages messageImageStorageService) {
        this(messageMapper, messageImageStorageService, Clock.systemDefaultZone());
    }

    public MessageModule(
            MessageMapper messageMapper,
            MessageImages messageImageStorageService,
            Clock clock
    ) {
        this.messageMapper = messageMapper;
        this.messageImageStorageService = messageImageStorageService;
        this.clock = clock;
    }

    public MessagePageVo listMessages(AuthenticatedActor actor, Integer page, Integer size) {
        int resolvedPage = clampPage(page);
        int resolvedSize = clampSize(size);
        int offset = (resolvedPage - 1) * resolvedSize;
        long total = messageMapper.countMessages();
        List<MessageVo> items = messageMapper.findMessages(offset, resolvedSize).stream()
                .map(message -> toVo(message, actor.userId()))
                .toList();
        return new MessagePageVo(items, total, resolvedPage, resolvedSize, (long) resolvedPage * resolvedSize < total);
    }

    public MessageVo createMessage(AuthenticatedActor actor, MessageCreateDto request, MultipartFile image) {
        validateCreateRequest(request);

        ObjectStore.StoredObject storedImage = null;
        if (image != null && !image.isEmpty()) {
            validateImage(image);
            storedImage = messageImageStorageService.upload(image, actor.userId());
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
        messageImageStorageService.deleteBestEffort(message.getImageObjectName());
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

    private void validateImage(MultipartFile file) {
        String contentType = Text.trim(file.getContentType()).toLowerCase();
        String filename = Text.trim(file.getOriginalFilename()).toLowerCase();
        boolean hasAllowedExtension = filename.endsWith(".jpg") || filename.endsWith(".jpeg")
                || filename.endsWith(".png") || filename.endsWith(".webp");
        if (!IMAGE_TYPES.contains(contentType) || !hasAllowedExtension) {
            throw ApplicationFailure.invalidInput("MESSAGE_IMAGE_TYPE_INVALID", "留言图片只支持 jpg、png、webp");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw ApplicationFailure.payloadTooLarge("MESSAGE_IMAGE_TOO_LARGE", "留言图片不能超过 10MB");
        }
    }

    private MessageVo toVo(Message message, Long currentUserId) {
        return new MessageVo(
                message.getId(),
                message.getAuthorUserId(),
                Text.trim(message.getAuthorName()).isBlank() ? "Snowlit" : message.getAuthorName(),
                message.getContent(),
                message.getImageUrl(),
                message.getCreatedAt(),
                currentUserId.equals(message.getAuthorUserId())
        );
    }

    private int clampPage(Integer page) {
        return page == null || page < 1 ? DEFAULT_PAGE : page;
    }

    private int clampSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

}
