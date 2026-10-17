package xyz.snowlit.weather;

import xyz.snowlit.weather.WeatherVos.WeatherAtmosphereVo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.lang.reflect.RecordComponent;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WeatherModuleTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-04-28T05:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final WeatherGateway weatherGateway = mock(WeatherGateway.class);
    private final WeatherModule weather = new WeatherModule(weatherGateway, CLOCK);

    @Test
    void getBrowserAtmosphereUsesCoordinatesAndGlobalWeather() {
        when(weatherGateway.reverseGeocode(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.Location("Example City", "Example Region", "Example District", "德国")
        ));
        when(weatherGateway.weather(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.LiveWeather("\u5c0f\u96e8", 22.3, "\u4e1c\u98ce", "3", "80", "2026-04-28 13:00:00", "unknown")
        ));

        WeatherAtmosphereVo response = weather.getBrowserAtmosphere("52.52", "13.41");

        assertThat(response.city()).isEqualTo("Example City");
        assertThat(response.district()).isEqualTo("Example District");
        assertThat(response.province()).isEqualTo("Example Region");
        assertThat(response.country()).isEqualTo("\u5fb7\u56fd");
        assertThat(response.temperature()).isEqualTo(22.3);
        assertThat(response.rawWeather()).isEqualTo("\u5c0f\u96e8");
        assertThat(response.weatherState()).isEqualTo("drizzle");
        assertThat(response.weatherVariant()).isEqualTo("lightRain");
        assertThat(response.precipitationKind()).isEqualTo("rain");
        assertThat(response.windDirection()).isEqualTo("\u4e1c\u98ce");
        assertThat(response.windPower()).isEqualTo("3");
        assertThat(response.humidity()).isEqualTo("80");
        assertThat(response.daylightHint()).isEqualTo("day");
        assertThat(response.observedAt()).isEqualTo(LocalDateTime.of(2026, 4, 28, 13, 0));
        verify(weatherGateway).reverseGeocode(new WeatherGateway.Coordinates(52.52, 13.41));
        verify(weatherGateway).weather(new WeatherGateway.Coordinates(52.52, 13.41));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            \u96f7\u9635\u96e8\u5e76\u4f34\u6709\u51b0\u96f9 | storm | hailStorm | hail
            \u96f7\u9635\u96e8 | storm | thunderstorm | rain
            \u5c0f\u96e8 | drizzle | lightRain | rain
            \u6bdb\u6bdb\u96e8 | drizzle | lightRain | rain
            \u7ec6\u96e8 | drizzle | lightRain | rain
            \u9635\u96e8 | drizzle | lightRain | rain
            \u4e2d\u96e8 | rain | moderateRain | rain
            \u96e8 | rain | moderateRain | rain
            \u5927\u96e8 | heavyRain | heavyRain | rain
            \u66b4\u96e8 | heavyRain | heavyRain | rain
            \u5927\u66b4\u96e8 | heavyRain | heavyRain | rain
            \u7279\u5927\u66b4\u96e8 | heavyRain | heavyRain | rain
            \u5f3a\u9635\u96e8 | heavyRain | heavyRain | rain
            \u9635\u96ea | lightSnow | lightSnow | snow
            \u5c0f\u96ea | lightSnow | lightSnow | snow
            \u4e2d\u96ea | snow | snow | snow
            \u96ea | snow | snow | snow
            \u5927\u96ea | blizzard | heavySnow | snow
            \u66b4\u96ea | blizzard | heavySnow | snow
            \u51b0\u96f9 | snow | hail | hail
            \u96fe | fog | mist | none
            \u8f7b\u96fe | fog | mist | none
            \u973e | fog | haze | none
            \u91cd\u5ea6\u973e | fog | haze | none
            \u6d6e\u5c18 | sandstorm | dust | none
            \u626c\u6c99 | sandstorm | dust | none
            \u6c99\u5c18\u66b4 | sandstorm | sandstorm | none
            \u5f3a\u6c99\u5c18\u66b4 | sandstorm | sandstorm | none
            \u6674 | clear | clear | none
            \u6674\u95f4\u591a\u4e91 | clear | partlyCloudy | none
            \u591a\u4e91 | cloudy | partlyCloudy | none
            \u5c11\u4e91 | cloudy | partlyCloudy | none
            \u9634 | cloudy | overcast | none
            \u6709\u98ce | cloudy | windy | none
            \u5927\u98ce | cloudy | windy | none
            \u98ce | cloudy | windy | none
            \u70ed | clear | hot | none
            \u51b7 | cloudy | cold | none
            \u672a\u77e5 | cloudy | unknown | none
            """)
    void mapsProviderDescriptionsToSemanticWeather(String rawWeather, String weatherState, String weatherVariant,
            String precipitationKind) {
        when(weatherGateway.reverseGeocode(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.Location("Example City", "Example Region", "Example District", "德国")
        ));
        when(weatherGateway.weather(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.LiveWeather(rawWeather, 22.3, "\u4e1c\u98ce", "3", "80", "2026-04-28 13:00:00", "unknown")
        ));

        WeatherAtmosphereVo response = weather.getBrowserAtmosphere("52.52", "13.41");

        assertThat(response.rawWeather()).isEqualTo(rawWeather);
        assertThat(response.weatherState()).isEqualTo(weatherState);
        assertThat(response.weatherVariant()).isEqualTo(weatherVariant);
        assertThat(response.precipitationKind()).isEqualTo(precipitationKind);
        assertThat(response.daylightHint()).isEqualTo("day");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            2026-04-28 05:59:00 | night
            2026-04-28 06:00:00 | day
            2026-04-28 17:59:00 | day
            2026-04-28 18:00:00 | night
            not-a-time | unknown
            """)
    void derivesDaylightHintFromReportTime(String reportTime, String daylightHint) {
        when(weatherGateway.reverseGeocode(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.Location("Example City", "Example Region", "Example District", "德国")
        ));
        when(weatherGateway.weather(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.LiveWeather("\u6674", 22.3, "\u4e1c\u98ce", "3", "80", reportTime, "unknown")
        ));

        WeatherAtmosphereVo response = weather.getBrowserAtmosphere("52.52", "13.41");

        assertThat(response.daylightHint()).isEqualTo(daylightHint);
        assertThat(response.observedAt()).isNotNull();
    }

    @Test
    void getBrowserAtmosphereReturnsFallbackWhenReverseGeocodeFails() {
        when(weatherGateway.reverseGeocode(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.empty());

        WeatherAtmosphereVo response = weather.getBrowserAtmosphere("52.52", "13.41");

        assertFallback(response);
    }

    @Test
    void getBrowserAtmospherePreservesResolvedLocationWhenWeatherFails() {
        when(weatherGateway.reverseGeocode(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.Location("Example City", "Example Region", "Example District", "德国")
        ));
        when(weatherGateway.weather(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.empty());

        WeatherAtmosphereVo response = weather.getBrowserAtmosphere("52.52", "13.41");

        assertThat(response.city()).isEqualTo("Example City");
        assertThat(response.country()).isEqualTo("德国");
        assertThat(response.temperature()).isNull();
        assertThat(response.weatherVariant()).isEqualTo("unknown");
    }

    @Test
    void getBrowserAtmosphereReturnsFallbackWhenCoordinatesAreInvalid() {
        WeatherAtmosphereVo response = weather.getBrowserAtmosphere("91", "13.41");

        assertFallback(response);
    }

    @Test
    void weatherAtmosphereVoContainsOnlySemanticWeatherFields() {
        assertThat(WeatherAtmosphereVo.class.getRecordComponents())
                .extracting(RecordComponent::getName)
                .containsExactly(
                        "city",
                        "district",
                        "province",
                        "country",
                        "temperature",
                        "rawWeather",
                        "weatherState",
                        "weatherVariant",
                        "precipitationKind",
                        "windDirection",
                        "windPower",
                        "humidity",
                        "daylightHint",
                        "observedAt"
                )
                .doesNotContain(
                        "intensity",
                        "windLevel",
                        "atmosphereLevel",
                        "lightningLevel",
                        "frostLevel",
                        "wetLensLevel",
                        "weatherType",
                        "isDay",
                        "updatedAt"
                );
    }

    @Test
    void sharesCacheByRoundedCoordinateAndKeepsProviderDaylight() {
        var point = new WeatherGateway.Coordinates(52.52, 13.41);
        when(weatherGateway.reverseGeocode(point)).thenReturn(Optional.of(new WeatherGateway.Location("Berlin", "", "", "Germany")));
        when(weatherGateway.weather(point)).thenReturn(Optional.of(new WeatherGateway.LiveWeather("晴", 18.0, "", "", "", "2026-06-21T20:30", "day")));
        var first = weather.getBrowserAtmosphere("52.52048", "13.40572");
        var second = weather.getBrowserAtmosphere("52.52123", "13.40621");
        assertThat(second).isSameAs(first);
        assertThat(first.daylightHint()).isEqualTo("day");
        assertThat(first.observedAt()).isEqualTo(LocalDateTime.of(2026, 6, 21, 20, 30));
        verify(weatherGateway, times(1)).reverseGeocode(point);
        verify(weatherGateway, times(1)).weather(point);
    }

    @Test
    void weatherSuccessDoesNotDependOnGeocoding() {
        var point = new WeatherGateway.Coordinates(-33.87, 151.21);
        when(weatherGateway.weather(point)).thenReturn(Optional.of(new WeatherGateway.LiveWeather("阴", 0.0, "", "", "", "2026-10-17T06:00", "night")));
        var result = weather.getBrowserAtmosphere("-33.87", "151.21");
        assertThat(result.city()).isEqualTo("unknown");
        assertThat(result.country()).isEmpty();
        assertThat(result.temperature()).isZero();
        assertThat(result.weatherVariant()).isEqualTo("overcast");
        assertThat(result.daylightHint()).isEqualTo("night");
    }

    @ParameterizedTest
    @CsvSource({"NaN,0", "Infinity,0", "0,181", "-91,0"})
    void invalidCoordinatesNeverReachProviders(String latitude, String longitude) {
        assertFallback(weather.getBrowserAtmosphere(latitude, longitude));
        verifyNoInteractions(weatherGateway);
    }

    @Test
    void cacheExpiresByElapsedTimeAcrossTimezoneClockChanges() {
        var instant = new java.util.concurrent.atomic.AtomicReference<>(Instant.parse("2026-11-01T08:55:00Z"));
        Clock moving = new Clock() {
            public ZoneId getZone() { return ZoneId.of("America/Los_Angeles"); }
            public Clock withZone(ZoneId zone) { return this; }
            public Instant instant() { return instant.get(); }
        };
        var cachedWeather = new WeatherModule(weatherGateway, moving);
        var point = new WeatherGateway.Coordinates(52.52, 13.41);
        when(weatherGateway.reverseGeocode(point)).thenReturn(Optional.of(new WeatherGateway.Location("Berlin", "", "", "Germany")));
        when(weatherGateway.weather(point)).thenReturn(Optional.of(new WeatherGateway.LiveWeather("晴", 18.0, "", "", "", "2026-11-01T10:00", "day")));
        cachedWeather.getBrowserAtmosphere("52.52", "13.41");
        instant.set(instant.get().plusSeconds(19 * 60));
        cachedWeather.getBrowserAtmosphere("52.52", "13.41");
        verify(weatherGateway, times(1)).weather(point);
        instant.set(instant.get().plusSeconds(60));
        cachedWeather.getBrowserAtmosphere("52.52", "13.41");
        verify(weatherGateway, times(2)).weather(point);
    }

    private void assertFallback(WeatherAtmosphereVo response) {
        assertThat(response.city()).isEqualTo("unknown");
        assertThat(response.district()).isEqualTo("unknown");
        assertThat(response.province()).isEqualTo("unknown");
        assertThat(response.country()).isEqualTo("unknown");
        assertThat(response.temperature()).isNull();
        assertThat(response.rawWeather()).isEmpty();
        assertThat(response.weatherState()).isEqualTo("cloudy");
        assertThat(response.weatherVariant()).isEqualTo("unknown");
        assertThat(response.precipitationKind()).isEqualTo("none");
        assertThat(response.windDirection()).isEmpty();
        assertThat(response.windPower()).isEmpty();
        assertThat(response.humidity()).isEmpty();
        assertThat(response.daylightHint()).isEqualTo("unknown");
        assertThat(response.observedAt()).isNotNull();
    }

    @Test
    void resolvedCountryIsNotReplacedByMainlandDefaultAndDoesNotRequireWeatherCoverage() {
        when(weatherGateway.reverseGeocode(new WeatherGateway.Coordinates(10, 20))).thenReturn(Optional.of(
                new WeatherGateway.Location("Example City", "Example Region", "", "Exampleland")));
        WeatherAtmosphereVo response = weather.getBrowserAtmosphere("10", "20");
        assertThat(response.country()).isEqualTo("Exampleland");
        assertThat(response.city()).isEqualTo("Example City");
        assertThat(response.temperature()).isNull();
        assertThat(response.rawWeather()).isEmpty();
        assertThat(response.weatherVariant()).isEqualTo("unknown");
        verify(weatherGateway).weather(new WeatherGateway.Coordinates(10, 20));
    }

    @Test
    void missingCountryIsKeptEmptyInsteadOfInferredFromCity() {
        when(weatherGateway.reverseGeocode(new WeatherGateway.Coordinates(10, 20))).thenReturn(Optional.of(
                new WeatherGateway.Location("Example City", "", "", "")));
        assertThat(weather.getBrowserAtmosphere("10", "20").country()).isEmpty();
    }
}
