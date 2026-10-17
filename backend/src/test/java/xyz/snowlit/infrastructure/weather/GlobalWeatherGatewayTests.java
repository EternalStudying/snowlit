package xyz.snowlit.infrastructure.weather;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import xyz.snowlit.weather.WeatherGateway.Coordinates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GlobalWeatherGatewayTests {
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final Coordinates point = new Coordinates(52.52048, 13.40572);
    private final GlobalWeatherGateway gateway = new GlobalWeatherGateway(builder.build(), "test-key", "");

    @Test
    void roundsCoordinatesBeforeAnyProviderReceivesThem() {
        assertThat(point).isEqualTo(new Coordinates(52.52, 13.41));
        assertThat(new Coordinates(-33.865, -151.205)).isEqualTo(new Coordinates(-33.87, -151.21));
        assertThatThrownBy(() -> new Coordinates(Double.NaN, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Coordinates(0, Double.POSITIVE_INFINITY)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Coordinates(90.1, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Coordinates(0, -180.1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void requestsOnlyCityLevelAddressWithCoarseCoordinates() {
        server.expect(requestTo("https://api.geoapify.com/v1/geocode/reverse?lat=52.52&lon=13.41&type=city&format=json&lang=zh&apiKey=test-key"))
                .andExpect(headerDoesNotExist("Authorization"))
                .andExpect(headerDoesNotExist("X-Forwarded-For"))
                .andRespond(withSuccess("""
                    {"results":[{"city":"Berlin;柏林","state":"Berlin","country":"Germany;Deutschland","street":"unused","housenumber":"unused"}]}
                    """, MediaType.APPLICATION_JSON));
        var location = gateway.reverseGeocode(point).orElseThrow();
        assertThat(location.city()).isEqualTo("Berlin");
        assertThat(location.country()).isEqualTo("Germany");
        assertThat(location.district()).isEmpty();
        server.verify();
    }

    @Test
    void missingKeySkipsGeocodingButWeatherStillWorks() {
        expectWeather("{\"temperature_2m\":0,\"weather_code\":0,\"is_day\":0}");
        var unconfigured = new GlobalWeatherGateway(builder.build(), "", "");
        assertThat(unconfigured.reverseGeocode(point)).isEmpty();
        assertThat(unconfigured.weather(point).orElseThrow().temperature()).isZero();
        server.verify();
    }

    @ParameterizedTest
    @CsvSource({"{}", "{\"results\":[]}", "{\"results\":[{}]}", "{\"results\":[null]}"})
    void missingAddressDoesNotInventLocation(String json) {
        server.expect(anything()).andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
        assertThat(gateway.reverseGeocode(point)).isEmpty();
        server.verify();
    }

    @Test
    void parsesCurrentModelConditionsAndProviderDaylight() {
        expectWeather("""
            {"temperature_2m":17.2,"weather_code":96,"is_day":1,"relative_humidity_2m":62,
             "wind_speed_10m":5.5,"wind_direction_10m":225,"time":"2026-06-21T20:30"}
            """);
        var weather = gateway.weather(point).orElseThrow();
        assertThat(weather.weather()).isEqualTo("雷阵雨并伴有冰雹");
        assertThat(weather.temperature()).isEqualTo(17.2);
        assertThat(weather.windDirection()).isEqualTo("西南风");
        assertThat(weather.windPower()).isEqualTo("4");
        assertThat(weather.humidity()).isEqualTo("62");
        assertThat(weather.daylightHint()).isEqualTo("day");
        assertThat(weather.reportTime()).isEqualTo("2026-06-21T20:30");
        server.verify();
    }

    @Test
    void missingTemperatureAndInvalidOptionalValuesRemainUnknown() {
        expectWeather("""
            {"temperature_2m":null,"weather_code":3,"is_day":7,"relative_humidity_2m":120,
             "wind_speed_10m":-1,"wind_direction_10m":999}
            """);
        var weather = gateway.weather(point).orElseThrow();
        assertThat(weather.temperature()).isNull();
        assertThat(weather.weather()).isEqualTo("阴");
        assertThat(weather.daylightHint()).isEqualTo("unknown");
        assertThat(weather.humidity()).isEmpty();
        assertThat(weather.windDirection()).isEmpty();
        assertThat(weather.windPower()).isEmpty();
        server.verify();
    }

    @Test
    void emptyWeatherAndHttpFailuresDegradeIndependently() {
        expectWeather("{}");
        server.expect(anything()).andRespond(withServerError());
        server.expect(anything()).andRespond(withServerError());
        assertThat(gateway.weather(point)).isEmpty();
        assertThat(gateway.reverseGeocode(point)).isEmpty();
        assertThat(gateway.weather(point)).isEmpty();
        server.verify();
    }

    @Test
    void paidWeatherKeyUsesCustomerEndpoint() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://customer-api.open-meteo.com/v1/forecast?")))
                .andExpect(queryParam("apikey", "paid-test-key"))
                .andRespond(withSuccess("{\"current\":{\"weather_code\":0}}", MediaType.APPLICATION_JSON));
        assertThat(new GlobalWeatherGateway(builder.build(), "", "paid-test-key").weather(point)).isPresent();
        server.verify();
    }

    @ParameterizedTest
    @CsvSource({"0,晴", "1,少云", "2,多云", "3,阴", "45,雾", "48,冻雾", "51,毛毛雨", "57,冻雨", "61,小雨", "63,中雨", "65,大雨", "67,冻雨", "71,小雪", "73,中雪", "75,大雪", "77,中雪", "80,阵雨", "81,中雨", "82,强阵雨", "85,小雪", "86,大雪", "95,雷阵雨", "99,雷阵雨并伴有冰雹", "100,''"})
    void mapsWmoWeatherCodes(int code, String description) {
        assertThat(GlobalWeatherGateway.describeWeather(code)).isEqualTo(description);
    }

    private void expectWeather(String current) {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.open-meteo.com/v1/forecast?")))
                .andExpect(queryParam("latitude", "52.52"))
                .andExpect(queryParam("longitude", "13.41"))
                .andExpect(queryParam("wind_speed_unit", "ms"))
                .andExpect(queryParam("timezone", "auto"))
                .andExpect(headerDoesNotExist("Authorization"))
                .andRespond(withSuccess("{\"current\":" + current + "}", MediaType.APPLICATION_JSON));
    }
}
