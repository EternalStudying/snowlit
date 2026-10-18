package xyz.snowlit.weather;

import xyz.snowlit.weather.WeatherVos.WeatherAtmosphereVo;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.web.CurrentActor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/weather")
public final class WeatherController {

    private final WeatherModule weather;

    public WeatherController(WeatherModule weather) {
        this.weather = weather;
    }

    @GetMapping("/atmosphere/browser")
    public WeatherAtmosphereVo browserAtmosphere(
            @CurrentActor AuthenticatedActor actor,
            @RequestParam(required = false) String latitude,
            @RequestParam(required = false) String longitude) {
        return weather.getBrowserAtmosphere(latitude, longitude);
    }
}
