package xyz.snowlit.weather;

import java.util.Optional;
import java.math.BigDecimal;
import java.math.RoundingMode;

public interface WeatherGateway {

    Optional<Location> reverseGeocode(Coordinates coordinates);

    Optional<LiveWeather> weather(Coordinates coordinates);

    // A gateway can only receive kilometre-scale WGS84 coordinates, never raw GPS precision.
    record Coordinates(double latitude, double longitude) {
        public Coordinates {
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)
                    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                throw new IllegalArgumentException("Invalid weather coordinates");
            }
            latitude = BigDecimal.valueOf(latitude).setScale(2, RoundingMode.HALF_UP).doubleValue();
            longitude = BigDecimal.valueOf(longitude).setScale(2, RoundingMode.HALF_UP).doubleValue();
        }
    }

    record Location(String city, String province, String district, String country) {
    }

    record LiveWeather(String weather, Double temperature, String windDirection, String windPower, String humidity,
            String reportTime, String daylightHint) {
    }
}
