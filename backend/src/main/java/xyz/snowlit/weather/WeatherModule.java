package xyz.snowlit.weather;

import xyz.snowlit.text.Text;
import xyz.snowlit.weather.WeatherVos.WeatherAtmosphereVo;
import org.springframework.stereotype.Service;

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

    public WeatherModule(WeatherGateway weatherGateway, Clock clock) {
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
        WeatherGateway.LiveWeather live = weather.orElse(
                new WeatherGateway.LiveWeather(WeatherCondition.UNKNOWN, null, "", "", "", "", "unknown"));
        WeatherCondition condition = live.condition();
        Optional<LocalDateTime> reportTime = parseReportTime(live.reportTime());
        String daylightHint = "day".equals(live.daylightHint()) || "night".equals(live.daylightHint())
                ? live.daylightHint()
                : reportTime.map(this::toDaylightHint).orElse("unknown");
        return new WeatherAtmosphereVo(
                isBlank(loc.city()) ? "unknown" : loc.city(),
                Text.trim(loc.district()),
                Text.trim(loc.province()),
                Text.trim(loc.country()),
                live.temperature(),
                condition.label(),
                condition.state(),
                condition.variant(),
                condition.precipitation(),
                Text.trim(live.windDirection()),
                Text.trim(live.windPower()),
                Text.trim(live.humidity()),
                daylightHint,
                reportTime.orElseGet(this::now)
        );
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
}
