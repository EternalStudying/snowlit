package xyz.snowlit.home;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.home.HomeDtos.HomeLocationUpdateDto;
import xyz.snowlit.home.HomeVos.HomeVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/home")
public final class HomeController {

    private final HomeModule home;

    public HomeController(HomeModule home) {
        this.home = home;
    }

    @GetMapping
    public HomeVo home(@CurrentActor AuthenticatedActor actor) {
        return home.getHome(actor);
    }

    @PostMapping("/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateLocation(@CurrentActor AuthenticatedActor actor,
                               @RequestBody HomeLocationUpdateDto request) {
        home.updateLocation(actor, request);
    }
}
