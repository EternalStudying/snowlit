package xyz.snowlit.messages;

import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.support.InMemoryObjectStore;
import xyz.snowlit.support.TestImages;

import xyz.snowlit.messages.MessageDtos.MessageCreateDto;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MessageControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-27T12:30:00Z"), ZoneId.of("Asia/Singapore"));

    private final MessageMapper messageMapper = mock(MessageMapper.class);
    private final InMemoryObjectStore objects = new InMemoryObjectStore();
    private final MessageModule messages = new MessageModule(messageMapper, new ImageIntake(objects), CLOCK);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new MessageController(messages))
            .setCustomArgumentResolvers(requests.actorResolver())
            .setControllerAdvice(new ApiExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(
                    Jackson2ObjectMapperBuilder.json()
                            .modules(new JavaTimeModule())
                            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                            .build()
            ))
            .build();

    @Test
    void messagesRequireAuthenticatedActor() throws Exception {
        mockMvc.perform(get("/api/messages?page=1&size=20"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void listMessagesReturnsPagedWallContract() throws Exception {
        when(messageMapper.countMessages()).thenReturn(1L);
        when(messageMapper.findMessages(0, 20)).thenReturn(List.of(message(true)));

        mockMvc.perform(get("/api/messages?page=1&size=20")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(8))
                .andExpect(jsonPath("$.items[0].authorUserId").value(1))
                .andExpect(jsonPath("$.items[0].authorName").value("伴侣 B"))
                .andExpect(jsonPath("$.items[0].content").value("今晚的晚霞很好看。"))
                .andExpect(jsonPath("$.items[0].imageUrl").value("https://cdn.example.com/messages/8.jpg"))
                .andExpect(jsonPath("$.items[0].canDelete").value(true))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void createMessageAcceptsMultipartPayloadAndOptionalImage() throws Exception {
        doAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            message.setId(8L);
            return 1;
        }).when(messageMapper).insertMessage(any());
        when(messageMapper.findMessageById(8L)).thenReturn(message(true));

        mockMvc.perform(multipart("/api/messages")
                        .file(new MockMultipartFile("payload", "", MediaType.APPLICATION_JSON_VALUE, """
                                {"content":"今晚的晚霞很好看。"}
                                """.getBytes()))
                        .file(TestImages.jpeg("image", "message.jpg"))
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("今晚的晚霞很好看。"))
                .andExpect(jsonPath("$.imageUrl").value("https://cdn.example.com/messages/8.jpg"));

        assertThat(objects.onlyStored().contentType()).isEqualTo("image/jpeg");
    }

    @Test
    void createMessageRejectsMultipleImageParts() throws Exception {
        mockMvc.perform(multipart("/api/messages")
                        .file(new MockMultipartFile("payload", "", MediaType.APPLICATION_JSON_VALUE, """
                                {"content":"two images"}
                                """.getBytes()))
                        .file(new MockMultipartFile("image", "first.webp", "image/webp", "first".getBytes()))
                        .file(new MockMultipartFile("image", "second.webp", "image/webp", "second".getBytes()))
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MESSAGE_IMAGE_LIMIT_EXCEEDED"))
                .andExpect(jsonPath("$.message").value("每条留言最多 1 张图片"));

        verify(messageMapper, never()).insertMessage(any());
    }

    @Test
    void deleteMessageUsesAuthenticatedActor() throws Exception {
        when(messageMapper.findMessageById(8L)).thenReturn(message(true));

        mockMvc.perform(delete("/api/messages/8")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isNoContent());

        verify(messageMapper).softDeleteMessage(8L, LocalDateTime.of(2026, 5, 27, 20, 30));
    }

    private Message message(boolean canDelete) {
        Message message = new Message();
        message.setId(8L);
        message.setAuthorUserId(canDelete ? 1L : 2L);
        message.setAuthorName("伴侣 B");
        message.setContent("今晚的晚霞很好看。");
        message.setImageUrl("https://cdn.example.com/messages/8.jpg");
        message.setImageObjectName("messages/8.jpg");
        message.setImageContentType("image/jpeg");
        message.setImageSizeBytes(5L);
        message.setCreatedAt(LocalDateTime.of(2026, 5, 27, 20, 30));
        return message;
    }
}
