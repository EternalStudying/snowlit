package xyz.snowlit.weather;

import xyz.snowlit.weather.WeatherVos.WeatherAtmosphereVo;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public final class WeatherModule {

    private static final Duration CACHE_TTL = Duration.ofMinutes(20);
    private static final Duration RETRY_TTL = Duration.ofMinutes(2);
    private static final int MAX_CACHE_ENTRIES = 2048;
    private static final DateTimeFormatter LEGACY_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final WeatherGateway weatherGateway;
    private final Clock clock;
    private final ConcurrentMap<WeatherGateway.Coordinates, CacheEntry> cache = new ConcurrentHashMap<>();

    @Autowired
    public WeatherModule(WeatherGateway weatherGateway) {
        this(weatherGateway, Clock.systemDefaultZone());
    }

    WeatherModule(WeatherGateway weatherGateway, Clock clock) {
        this.weatherGateway = weatherGateway;
        this.clock = clock;
    }

    public WeatherAtmosphereVo getBrowserAtmosphere(String latitude, String longitude) {
        Optional<Double> lat = parseCoordinate(latitude, -90, 90);
        Optional<Double> lon = parseCoordinate(longitude, -180, 180);
        if (lat.isEmpty() || lon.isEmpty()) {
            return fallback();
        }

        WeatherGateway.Coordinates coordinates = new WeatherGateway.Coordinates(lat.get(), lon.get());
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(clock.instant()));
            if (cache.size() >= MAX_CACHE_ENTRIES) {
                cache.clear();
            }
        }
        CacheEntry entry = cache.compute(coordinates, (point, cached) -> {
            if (cached != null && cached.expiresAt().isAfter(clock.instant())) {
                return cached;
            }
            WeatherAtmosphereVo value = loadBrowserAtmosphere(point);
            boolean resolvedPlace = java.util.stream.Stream.of(value.city(), value.country(), value.province(), value.district())
                    .anyMatch(place -> !place.isBlank() && !"unknown".equalsIgnoreCase(place));
            Duration ttl = resolvedPlace && !"unknown".equals(value.weatherVariant()) ? CACHE_TTL : RETRY_TTL;
            return new CacheEntry(value, clock.instant().plus(ttl));
        });
        return entry.value();
    }

    private WeatherAtmosphereVo loadBrowserAtmosphere(WeatherGateway.Coordinates coordinates) {
        Optional<WeatherGateway.Location> location = weatherGateway.reverseGeocode(coordinates);
        Optional<WeatherGateway.LiveWeather> weather = weatherGateway.weather(coordinates);
        if (location.isEmpty() && weather.isEmpty()) {
            return fallback();
        }

        WeatherGateway.Location loc = location.orElse(new WeatherGateway.Location("", "", "", ""));
        WeatherGateway.LiveWeather live = weather.orElse(new WeatherGateway.LiveWeather("", null, "", "", "", "", "unknown"));
        WeatherMapping mapping = mapWeather(live.weather(), live.reportTime());
        String daylightHint = "day".equals(live.daylightHint()) || "night".equals(live.daylightHint())
                ? live.daylightHint() : mapping.daylightHint();
        return new WeatherAtmosphereVo(
                isBlank(loc.city()) ? "unknown" : loc.city(),
                blankToEmpty(loc.district()),
                blankToEmpty(loc.province()),
                blankToEmpty(loc.country()),
                live.temperature(),
                blankToEmpty(live.weather()),
                mapping.weatherState(),
                mapping.weatherVariant(),
                mapping.precipitationKind(),
                blankToEmpty(live.windDirection()),
                blankToEmpty(live.windPower()),
                blankToEmpty(live.humidity()),
                daylightHint,
                parseReportTime(live.reportTime()).orElseGet(this::now)
        );
    }

    WeatherMapping mapWeather(String rawWeather, String reportTime) {
        String weather = blankToEmpty(rawWeather);
        String daylightHint = parseReportTime(reportTime)
                .map(this::toDaylightHint)
                .orElse("unknown");

        if (isBlank(weather) || weather.contains("未知") || "unknown".equalsIgnoreCase(weather)) {
            return new WeatherMapping("cloudy", "unknown", "none", daylightHint);
        }
        if (weather.contains("雷阵雨并伴有冰雹")) {
            return new WeatherMapping("storm", "hailStorm", "hail", daylightHint);
        }
        if (weather.contains("雷")) {
            return new WeatherMapping("storm", "thunderstorm", "rain", daylightHint);
        }
        if (containsAny(weather, "大雨", "暴雨", "大暴雨", "特大暴雨", "强阵雨")) {
            return new WeatherMapping("heavyRain", "heavyRain", "rain", daylightHint);
        }
        if (containsAny(weather, "小雨", "毛毛雨", "细雨", "阵雨")) {
            return new WeatherMapping("drizzle", "lightRain", "rain", daylightHint);
        }
        if (containsAny(weather, "雨夹雪", "雨雪")) {
            return new WeatherMapping("snow", "snow", "mixed", daylightHint);
        }
        if (containsAny(weather, "中雨", "雨")) {
            return new WeatherMapping("rain", "moderateRain", "rain", daylightHint);
        }
        if (containsAny(weather, "大雪", "暴雪")) {
            return new WeatherMapping("blizzard", "heavySnow", "snow", daylightHint);
        }
        if (containsAny(weather, "阵雪", "小雪")) {
            return new WeatherMapping("lightSnow", "lightSnow", "snow", daylightHint);
        }
        if (weather.contains("冰雹")) {
            return new WeatherMapping("snow", "hail", "hail", daylightHint);
        }
        if (containsAny(weather, "中雪", "雪")) {
            return new WeatherMapping("snow", "snow", "snow", daylightHint);
        }
        if (weather.contains("霾")) {
            return new WeatherMapping("fog", "haze", "none", daylightHint);
        }
        if (weather.contains("雾")) {
            return new WeatherMapping("fog", "mist", "none", daylightHint);
        }
        if (containsAny(weather, "沙尘暴", "强沙尘暴")) {
            return new WeatherMapping("sandstorm", "sandstorm", "none", daylightHint);
        }
        if (containsAny(weather, "浮尘", "扬沙")) {
            return new WeatherMapping("sandstorm", "dust", "none", daylightHint);
        }
        if (weather.contains("晴间多云")) {
            return new WeatherMapping("clear", "partlyCloudy", "none", daylightHint);
        }
        if (weather.contains("晴")) {
            return new WeatherMapping("clear", "clear", "none", daylightHint);
        }
        if (containsAny(weather, "多云", "少云")) {
            return new WeatherMapping("cloudy", "partlyCloudy", "none", daylightHint);
        }
        if (weather.contains("阴")) {
            return new WeatherMapping("cloudy", "overcast", "none", daylightHint);
        }
        if (containsAny(weather, "有风", "微风", "强风", "大风", "风暴", "风")) {
            return new WeatherMapping("cloudy", "windy", "none", daylightHint);
        }
        if (weather.contains("热")) {
            return new WeatherMapping("clear", "hot", "none", daylightHint);
        }
        if (weather.contains("冷")) {
            return new WeatherMapping("cloudy", "cold", "none", daylightHint);
        }
        return new WeatherMapping("cloudy", "unknown", "none", daylightHint);
    }

    private Optional<LocalDateTime> parseReportTime(String reportTime) {
        if (isBlank(reportTime)) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalDateTime.parse(reportTime, LEGACY_TIME_FORMAT));
        } catch (DateTimeParseException ex) {
            try {
                return Optional.of(LocalDateTime.parse(reportTime));
            } catch (DateTimeParseException ignored) {
                return Optional.empty();
            }
        }
    }

    private String toDaylightHint(LocalDateTime reportTime) {
        int hour = reportTime.getHour();
        return hour >= 6 && hour < 18 ? "day" : "night";
    }

    private Optional<Double> parseCoordinate(String value, double min, double max) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        try {
            double coordinate = Double.parseDouble(value.trim());
            if (!Double.isFinite(coordinate) || coordinate < min || coordinate > max) {
                return Optional.empty();
            }
            return Optional.of(coordinate);
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean containsAny(String value, String... keywords) {
        for (String keyword : keywords) {
            if (value.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private WeatherAtmosphereVo fallback() {
        return new WeatherAtmosphereVo(
                "unknown",
                "unknown",
                "unknown",
                "unknown",
                null,
                "",
                "cloudy",
                "unknown",
                "none",
                "",
                "",
                "",
                "unknown",
                now()
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private record CacheEntry(WeatherAtmosphereVo value, java.time.Instant expiresAt) {
    }

    record WeatherMapping(String weatherState, String weatherVariant, String precipitationKind, String daylightHint) {
    }
}
