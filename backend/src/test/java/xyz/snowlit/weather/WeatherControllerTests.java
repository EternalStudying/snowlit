package xyz.snowlit.weather;

import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WeatherControllerTests {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-04-28T05:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final WeatherGateway gateway = mock(WeatherGateway.class);
    private final WeatherModule weather = new WeatherModule(gateway, CLOCK);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new WeatherController(weather))
            .setCustomArgumentResolvers(requests.actorResolver())
            .setControllerAdvice(new ApiExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(
                    Jackson2ObjectMapperBuilder.json()
                            .modules(new JavaTimeModule())
                            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                            .build()
            ))
            .build();

    @Test
    void atmosphereRootEndpointIsRemoved() throws Exception {
        mockMvc.perform(get("/api/weather/atmosphere")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isNotFound());
    }

    @Test
    void browserAtmosphereReturnsWeatherPayloadForAuthenticatedRequest() throws Exception {
        when(gateway.reverseGeocode(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.Location("示例城市 A", "示例地区 A", "示例街区 A", "德国")
        ));
        when(gateway.weather(new WeatherGateway.Coordinates(52.52, 13.41))).thenReturn(Optional.of(
                new WeatherGateway.LiveWeather("小雨", 22.3, "东风", "3", "80", "2026-04-28 13:00:00", "unknown")
        ));

        mockMvc.perform(get("/api/weather/atmosphere/browser")
                        .param("latitude", "52.52")
                        .param("longitude", "13.41")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("示例城市 A"))
                .andExpect(jsonPath("$.district").value("示例街区 A"))
                .andExpect(jsonPath("$.province").value("示例地区 A"))
                .andExpect(jsonPath("$.country").value("德国"))
                .andExpect(jsonPath("$.temperature").value(22.3))
                .andExpect(jsonPath("$.rawWeather").value("小雨"))
                .andExpect(jsonPath("$.weatherState").value("drizzle"))
                .andExpect(jsonPath("$.weatherVariant").value("lightRain"))
                .andExpect(jsonPath("$.precipitationKind").value("rain"))
                .andExpect(jsonPath("$.windDirection").value("东风"))
                .andExpect(jsonPath("$.windPower").value("3"))
                .andExpect(jsonPath("$.humidity").value("80"))
                .andExpect(jsonPath("$.daylightHint").value("day"))
                .andExpect(jsonPath("$.observedAt").value("2026-04-28T13:00:00"))
                .andExpect(jsonPath("$.weatherType").doesNotExist())
                .andExpect(jsonPath("$.isDay").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").doesNotExist());
    }

    @Test
    void browserAtmosphereRejectsRequestWithoutToken() throws Exception {
        mockMvc.perform(get("/api/weather/atmosphere/browser")
                        .param("latitude", "52.52")
                        .param("longitude", "13.41"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }
}
