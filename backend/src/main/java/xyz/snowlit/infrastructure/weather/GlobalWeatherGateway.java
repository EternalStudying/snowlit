package xyz.snowlit.infrastructure.weather;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import xyz.snowlit.weather.WeatherGateway;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Optional;

@Component
public final class GlobalWeatherGateway implements WeatherGateway {

    private static final String CURRENT_FIELDS = "temperature_2m,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m";
    private static final String[] WIND_DIRECTIONS = {"北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"};
    private static final double[] BEAUFORT_LIMITS = {0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7};

    private final RestClient client;
    private final String geoapifyKey;
    private final String openMeteoKey;

    @Autowired
    public GlobalWeatherGateway(RestClient.Builder builder,
            @Value("${geoapify.key:}") String geoapifyKey,
            @Value("${open-meteo.key:}") String openMeteoKey) {
        this(configuredClient(builder), geoapifyKey, openMeteoKey);
    }

    GlobalWeatherGateway(RestClient client, String geoapifyKey, String openMeteoKey) {
        this.client = client;
        this.geoapifyKey = clean(geoapifyKey);
        this.openMeteoKey = clean(openMeteoKey);
    }

    private static RestClient configuredClient(RestClient.Builder builder) {
        var httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(5));
        return builder.clone().requestFactory(factory).build();
    }

    @Override
    public Optional<Location> reverseGeocode(Coordinates coordinates) {
        if (geoapifyKey.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode response = client.get()
                    .uri("https://api.geoapify.com/v1/geocode/reverse?lat={lat}&lon={lon}&type=city&format=json&lang=zh&apiKey={key}",
                            coordinates.latitude(), coordinates.longitude(), geoapifyKey)
                    .retrieve().body(JsonNode.class);
            JsonNode results = response == null ? null : response.get("results");
            if (results == null || !results.isArray() || results.isEmpty()) {
                return Optional.empty();
            }
            JsonNode address = results.get(0);
            Location location = new Location(
                    firstText(address, "city", "town", "village", "municipality"),
                    firstText(address, "state"),
                    firstText(address, "suburb", "district", "county"),
                    firstText(address, "country"));
            if (location.city().isBlank() && location.province().isBlank()
                    && location.district().isBlank() && location.country().isBlank()) {
                return Optional.empty();
            }
            return Optional.of(location);
        } catch (RuntimeException ex) {
            // Provider errors may include URLs with credentials; never log the exception or URL.
            return Optional.empty();
        }
    }

    @Override
    public Optional<LiveWeather> weather(Coordinates coordinates) {
        try {
            String endpoint = openMeteoKey.isBlank() ? "https://api.open-meteo.com" : "https://customer-api.open-meteo.com";
            String uri = endpoint + "/v1/forecast?latitude={lat}&longitude={lon}&current={fields}&wind_speed_unit=ms&timezone=auto&forecast_days=1";
            JsonNode response = (openMeteoKey.isBlank()
                    ? client.get().uri(uri, coordinates.latitude(), coordinates.longitude(), CURRENT_FIELDS)
                    : client.get().uri(uri + "&apikey={key}", coordinates.latitude(), coordinates.longitude(), CURRENT_FIELDS, openMeteoKey))
                    .retrieve().body(JsonNode.class);
            JsonNode current = response == null ? null : response.get("current");
            if (current == null || !current.isObject()) {
                return Optional.empty();
            }
            Double temperature = number(current, "temperature_2m");
            Integer code = integer(current, "weather_code");
            String weather = describeWeather(code);
            if (temperature == null && weather.isBlank()) {
                return Optional.empty();
            }
            Double speed = number(current, "wind_speed_10m");
            Double direction = number(current, "wind_direction_10m");
            Double humidity = number(current, "relative_humidity_2m");
            Integer isDay = integer(current, "is_day");
            return Optional.of(new LiveWeather(weather, temperature, windDirection(direction), windPower(speed),
                    humidity != null && humidity >= 0 && humidity <= 100 ? Long.toString(Math.round(humidity)) : "",
                    text(current, "time"), isDay != null && isDay == 1 ? "day" : isDay != null && isDay == 0 ? "night" : "unknown"));
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }

    static String describeWeather(Integer code) {
        if (code == null) {
            return "";
        }
        return switch (code) {
            case 0 -> "晴";
            case 1 -> "少云";
            case 2 -> "多云";
            case 3 -> "阴";
            case 45 -> "雾";
            case 48 -> "冻雾";
            case 51, 53, 55 -> "毛毛雨";
            case 56, 57, 66, 67 -> "冻雨";
            case 61 -> "小雨";
            case 63 -> "中雨";
            case 65 -> "大雨";
            case 71, 85 -> "小雪";
            case 73, 77 -> "中雪";
            case 75, 86 -> "大雪";
            case 80 -> "阵雨";
            case 81 -> "中雨";
            case 82 -> "强阵雨";
            case 95 -> "雷阵雨";
            case 96, 99 -> "雷阵雨并伴有冰雹";
            default -> "";
        };
    }

    private static String windDirection(Double degrees) {
        if (degrees == null || degrees < 0 || degrees > 360) {
            return "";
        }
        return WIND_DIRECTIONS[(int) Math.round(degrees / 45) % 8];
    }

    private static String windPower(Double speed) {
        if (speed == null || speed < 0) {
            return "";
        }
        int power = 0;
        while (power < BEAUFORT_LIMITS.length && speed >= BEAUFORT_LIMITS[power]) {
            power++;
        }
        return Integer.toString(power);
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (!value.isBlank()) {
                // OSM names may contain simplified/traditional aliases separated by semicolons.
                return java.util.Arrays.stream(value.split("[;；]"))
                        .map(String::trim).filter(name -> !name.isBlank()).findFirst().orElse("");
            }
        }
        return "";
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? clean(value.asText()) : "";
    }

    private static Double number(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isNumber() && Double.isFinite(value.asDouble()) ? value.asDouble() : null;
    }

    private static Integer integer(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isIntegralNumber() && value.canConvertToInt() ? value.asInt() : null;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
