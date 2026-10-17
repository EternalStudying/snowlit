package xyz.snowlit.diary;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class DiaryVos {

    private DiaryVos() {
    }

    public record DiaryDetailVo(
            Long id,
            String role,
            String authorName,
            String authorAvatar,
            String contentMarkdown,
            String title,
            String summary,
            List<String> imageUrls,
            LocalDate entryDate,
            String moodKey,
            String visibility,
            String weather,
            String rawWeather,
            Double temperature,
            String windDirection,
            String windPower,
            String humidity,
            String province,
            String city,
            String district,
            String locationName,
            Double latitude,
            Double longitude,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record DiaryImageUploadVo(
            Long uploadId,
            String url
    ) {
    }

    public record DiaryMonthListVo(
            String month,
            List<DiarySummaryVo> items
    ) {
    }

    public record DiaryMonthStatVo(
            String month,
            int count,
            boolean hasEntries
    ) {
    }

    public record DiaryMonthsVo(
            List<DiaryYearStatVo> years
    ) {
    }

    public record DiarySummaryVo(
            Long id,
            String role,
            String authorName,
            String authorAvatar,
            String title,
            String summary,
            List<String> imageUrls,
            LocalDate entryDate,
            String moodKey,
            String locationName,
            String weather,
            String visibility,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record DiaryYearStatVo(
            int year,
            List<DiaryMonthStatVo> months
    ) {
    }
}
