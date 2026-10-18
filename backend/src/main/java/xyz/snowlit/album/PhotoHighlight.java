package xyz.snowlit.album;

import java.time.LocalDate;

/**
 * The most recent photo from a public album, as other features show it.
 */
public record PhotoHighlight(Long id, String previewUrl, String caption, LocalDate takenAt) {
}
