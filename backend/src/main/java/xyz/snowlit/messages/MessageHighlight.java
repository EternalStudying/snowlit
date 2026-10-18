package xyz.snowlit.messages;

import java.time.LocalDateTime;

/**
 * The most recent message on the wall, as other features show it.
 */
public record MessageHighlight(Long id, String authorName, String content, LocalDateTime createdAt) {
}
