package xyz.snowlit.diary;

import java.time.LocalDate;

public final class DiaryDtos {

    private DiaryDtos() {
    }

    public record DiaryCreateDto(
            String contentMarkdown,
            LocalDate date,
            String moodKey,
            String visibility,
            DiaryWeatherSnapshotDto weatherSnapshot
    ) {
    }

    public record DiaryUpdateDto(
            String contentMarkdown,
            String moodKey,
            String visibility
    ) {
    }

    public record DiaryWeatherSnapshotDto(
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
            Double longitude
    ) {
    }
}
