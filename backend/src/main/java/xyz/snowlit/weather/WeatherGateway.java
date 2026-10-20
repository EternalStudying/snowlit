package xyz.snowlit.weather;

import java.util.Optional;

public interface WeatherGateway {

    Optional<Location> reverseGeocode(Coordinates coordinates);

    Optional<LiveWeather> weather(Coordinates coordinates);

    // Validate WGS84 coordinates without changing the supplied precision.
    record Coordinates(double latitude, double longitude) {
        public Coordinates {
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)
                    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                throw new IllegalArgumentException("Invalid weather coordinates");
            }
        }
    }

    record Location(String city, String province, String district, String country) {
    }

    record LiveWeather(WeatherCondition condition, Double temperature, String windDirection, String windPower,
            String humidity, String reportTime, String daylightHint) {
    }
}
