package xyz.snowlit.diary;

import java.time.LocalDate;

/**
 * The most recent shared diary, as other features show it.
 */
public record DiaryHighlight(Long id, String title, LocalDate entryDate, String summary, String moodKey) {
}
