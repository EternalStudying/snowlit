package xyz.snowlit.messages;

import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.support.InMemoryObjectStore;
import xyz.snowlit.support.TestImages;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.messages.MessageDtos.MessageCreateDto;
import xyz.snowlit.messages.MessageVos.MessagePageVo;
import xyz.snowlit.messages.MessageVos.MessageVo;
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
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MessageModuleTests {

    private static final AuthenticatedActor ACTOR =
            new AuthenticatedActor(3L, "guest", "游客", null, null, null, null);
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-27T12:30:00Z"), ZoneId.of("Asia/Singapore"));

    private final MessageMapper messageMapper = mock(MessageMapper.class);
    private final InMemoryObjectStore objects = new InMemoryObjectStore();
    private final MessageModule messages = new MessageModule(messageMapper, new ImageIntake(objects, CLOCK), CLOCK);

    @Test
    void listMessagesReturnsPagedItemsWithCurrentUserDeletePermission() {
        when(messageMapper.countMessages()).thenReturn(2L);
        when(messageMapper.findMessages(0, 20)).thenReturn(List.of(message(8L, 3L), message(7L, 1L)));

        MessagePageVo page = messages.listMessages(ACTOR, 1, 20);

        assertThat(page.total()).isEqualTo(2);
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.size()).isEqualTo(20);
        assertThat(page.hasMore()).isFalse();
        assertThat(page.items()).extracting(MessageVo::id).containsExactly(8L, 7L);
        assertThat(page.items()).extracting(MessageVo::canDelete).containsExactly(true, false);
    }

    @Test
    void createMessageStoresPlainTextForAuthenticatedActor() {
        doAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            message.setId(88L);
            return 1;
        }).when(messageMapper).insertMessage(any());
        when(messageMapper.findMessageById(88L)).thenReturn(message(88L, 3L));

        MessageVo created = messages.createMessage(ACTOR, new MessageCreateDto(" 晚点一起看相册。 "), null);

        assertThat(created.id()).isEqualTo(88L);
        assertThat(created.canDelete()).isTrue();
        verify(messageMapper).insertMessage(argThat(message ->
                message.getAuthorUserId().equals(3L)
                        && "晚点一起看相册。".equals(message.getContent())
                        && message.getImageUrl() == null
                        && message.getCreatedAt().equals(LocalDateTime.of(2026, 5, 27, 20, 30))
        ));
        assertThat(objects.stored()).isEmpty();
    }

    @Test
    void createMessageStoresOptionalImageMetadata() {
        MockMultipartFile image = TestImages.gif("image", "message.gif");
        doAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            message.setId(89L);
            return 1;
        }).when(messageMapper).insertMessage(any());
        when(messageMapper.findMessageById(89L)).thenReturn(message(89L, 3L));

        messages.createMessage(ACTOR, new MessageCreateDto("有一张图"), image);

        ObjectStore.StoredObject stored = objects.onlyStored();
        assertThat(stored.objectName()).matches("messages/\\d{4}/\\d{2}/3/[0-9a-f-]+\\.gif");
        verify(messageMapper).insertMessage(argThat(message ->
                stored.url().equals(message.getImageUrl())
                        && stored.objectName().equals(message.getImageObjectName())
                        && "image/gif".equals(message.getImageContentType())
                        && Long.valueOf(image.getSize()).equals(message.getImageSizeBytes())
        ));
    }

    @Test
    void createMessageValidatesContentAndImageContract() {
        assertThatThrownBy(() -> messages.createMessage(ACTOR, new MessageCreateDto(" "), null))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("留言内容不能为空");

        MockMultipartFile text = TestImages.text("image", "message.jpg");
        assertThatThrownBy(() -> messages.createMessage(ACTOR, new MessageCreateDto("hello"), text))
                .isInstanceOfSatisfying(ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("MESSAGE_IMAGE_TYPE_INVALID"));
    }

    @Test
    void deleteMessageOnlyAllowsAuthorAndUsesSoftDelete() {
        when(messageMapper.findMessageById(8L)).thenReturn(message(8L, 3L));

        messages.deleteMessage(ACTOR, 8L);

        verify(messageMapper).softDeleteMessage(8L, LocalDateTime.of(2026, 5, 27, 20, 30));
        assertThat(objects.deleted()).containsExactly("messages/8.jpg");

        when(messageMapper.findMessageById(9L)).thenReturn(message(9L, 1L));
        assertThatThrownBy(() -> messages.deleteMessage(ACTOR, 9L))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("只能删除自己发布的留言");
    }

    private Message message(Long id, Long authorUserId) {
        Message message = new Message();
        message.setId(id);
        message.setAuthorUserId(authorUserId);
        message.setAuthorName(authorUserId.equals(3L) ? "游客" : "伴侣 B");
        message.setContent(id.equals(8L) ? "今晚的晚霞很好看。" : "明天也一起吃饭。");
        message.setImageUrl(id.equals(8L) ? "https://cdn.example.com/messages/8.jpg" : null);
        message.setImageObjectName(id.equals(8L) ? "messages/8.jpg" : null);
        message.setImageContentType(id.equals(8L) ? "image/jpeg" : null);
        message.setImageSizeBytes(id.equals(8L) ? 5L : null);
        message.setCreatedAt(LocalDateTime.of(2026, 5, 27, 20, 30).minusMinutes(id));
        return message;
    }
}
