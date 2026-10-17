package xyz.snowlit.messages;

public final class MessageDtos {

    private MessageDtos() {
    }

    public record MessageCreateDto(String content) {
    }
}
