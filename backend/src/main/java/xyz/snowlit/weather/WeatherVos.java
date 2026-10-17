package xyz.snowlit.weather;

import java.time.LocalDateTime;

public final class WeatherVos {

    private WeatherVos() {
    }

    public record WeatherAtmosphereVo(
            String city,
            String district,
            String province,
            String country,
            Double temperature,
            String rawWeather,
            String weatherState,
            String weatherVariant,
            String precipitationKind,
            String windDirection,
            String windPower,
            String humidity,
            String daylightHint,
            LocalDateTime observedAt
    ) {
    }
}
