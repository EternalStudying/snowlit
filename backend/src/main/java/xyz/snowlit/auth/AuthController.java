package xyz.snowlit.auth;

import xyz.snowlit.auth.AuthDtos.LoginDto;
import xyz.snowlit.auth.AuthDtos.ProfileUpdateDto;
import xyz.snowlit.auth.AuthDtos.WechatBindLoginDto;
import xyz.snowlit.auth.AuthDtos.WechatLoginDto;
import xyz.snowlit.auth.AuthVos.CurrentUserVo;
import xyz.snowlit.auth.AuthVos.LoginVo;
import xyz.snowlit.web.BearerToken;
import xyz.snowlit.web.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public final class AuthController {

    private final AuthModule auth;

    public AuthController(AuthModule auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public LoginVo login(@RequestBody LoginDto request) {
        return auth.login(request);
    }

    @PostMapping("/wechat-login")
    public LoginVo wechatLogin(@RequestBody WechatLoginDto request) {
        return auth.wechatLogin(request);
    }

    @PostMapping("/wechat-bind-login")
    public LoginVo wechatBindLogin(@RequestBody WechatBindLoginDto request) {
        return auth.wechatBindLogin(request);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        auth.logout(BearerToken.fromAuthorization(authorization));
    }

    @GetMapping("/me")
    public CurrentUserVo me(@CurrentActor AuthenticatedActor actor) {
        return auth.currentUser(actor);
    }

    @PatchMapping("/me/profile")
    public CurrentUserVo updateProfile(@CurrentActor AuthenticatedActor actor,
                                       @RequestBody ProfileUpdateDto request) {
        return auth.updateProfile(actor, request);
    }
}
