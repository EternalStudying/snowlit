package xyz.snowlit.weather;

/**
 * Current weather as the product understands it: a display label plus the semantic fields clients render.
 */
public enum WeatherCondition {
    CLEAR("晴", "clear", "clear", "none"),
    FEW_CLOUDS("少云", "cloudy", "partlyCloudy", "none"),
    PARTLY_CLOUDY("多云", "cloudy", "partlyCloudy", "none"),
    OVERCAST("阴", "cloudy", "overcast", "none"),
    FOG("雾", "fog", "mist", "none"),
    FREEZING_FOG("冻雾", "fog", "mist", "none"),
    DRIZZLE("毛毛雨", "drizzle", "lightRain", "rain"),
    FREEZING_RAIN("冻雨", "rain", "moderateRain", "rain"),
    LIGHT_RAIN("小雨", "drizzle", "lightRain", "rain"),
    MODERATE_RAIN("中雨", "rain", "moderateRain", "rain"),
    HEAVY_RAIN("大雨", "heavyRain", "heavyRain", "rain"),
    RAIN_SHOWERS("阵雨", "drizzle", "lightRain", "rain"),
    VIOLENT_RAIN_SHOWERS("强阵雨", "heavyRain", "heavyRain", "rain"),
    LIGHT_SNOW("小雪", "lightSnow", "lightSnow", "snow"),
    MODERATE_SNOW("中雪", "snow", "snow", "snow"),
    HEAVY_SNOW("大雪", "blizzard", "heavySnow", "snow"),
    THUNDERSTORM("雷阵雨", "storm", "thunderstorm", "rain"),
    THUNDERSTORM_WITH_HAIL("雷阵雨并伴有冰雹", "storm", "hailStorm", "hail"),
    UNKNOWN("", "cloudy", "unknown", "none");

    private final String label;
    private final String state;
    private final String variant;
    private final String precipitation;

    WeatherCondition(String label, String state, String variant, String precipitation) {
        this.label = label;
        this.state = state;
        this.variant = variant;
        this.precipitation = precipitation;
    }

    /** Chinese description shown to members, blank when unknown. */
    public String label() {
        return label;
    }

    public String state() {
        return state;
    }

    public String variant() {
        return variant;
    }

    public String precipitation() {
        return precipitation;
    }
}
