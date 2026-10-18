package xyz.snowlit.auth;

import xyz.snowlit.support.InMemoryAuthSessionStore;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTests {


    private final UserMapper userMapper = mock(UserMapper.class);
    private final InMemoryAuthSessionStore sessions = new InMemoryAuthSessionStore();
    private final WechatLoginGateway wechat = mock(WechatLoginGateway.class);
    private final AuthModule auth = new AuthModule(
            userMapper,
            new AuthSessions(sessions, userMapper),
            new BCryptPasswordEncoder(),
            wechat,
            new MockEnvironment(),
            ""
    );
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(auth))
            .addInterceptors(requests.actorResolver())
            .setCustomArgumentResolvers(requests.actorResolver())
            .setControllerAdvice(new ApiExceptionHandler())
            .build();

    @BeforeEach
    void setUp() {
        when(userMapper.findById(1L)).thenReturn(sampleUser());
    }

    @Test
    void loginReturnsTokenAndSafeUserContract() throws Exception {
        String hash = new BCryptPasswordEncoder().encode("demo123456");
        User user = sampleUser();
        user.setPasswordHash(hash);
        when(userMapper.findByUsername("demo")).thenReturn(user);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"demo\",\"password\":\"demo123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.id").value(1))
                .andExpect(jsonPath("$.user.username").value("demo"))
                .andExpect(jsonPath("$.user.displayName").value("Demo User"))
                .andExpect(jsonPath("$.user.avatarUrl").value("https://cdn.example.com/avatar.png"))
                .andExpect(jsonPath("$.user.bio").value("About me"))
                .andExpect(jsonPath("$.user.mood").value("Happy"))
                .andExpect(jsonPath("$.user.updatedAt").exists())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.user.wechatOpenid").doesNotExist());
    }

    @Test
    void loginRejectsWrongPasswordWithStableError() throws Exception {
        User user = sampleUser();
        user.setPasswordHash(new BCryptPasswordEncoder().encode("demo123456"));
        when(userMapper.findByUsername("demo")).thenReturn(user);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"demo\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PASSWORD_INVALID"));
    }

    @Test
    void wechatLoginReturnsTokenWithoutWechatSensitiveFields() throws Exception {
        when(wechat.exchangeCode("wx-code"))
                .thenReturn(new WechatLoginGateway.Session("openid-1", "unionid-1"));
        when(userMapper.findByWechatOpenid("openid-1")).thenReturn(sampleUser());

        mockMvc.perform(post("/api/auth/wechat-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"wx-code\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.username").value("demo"))
                .andExpect(jsonPath("$.openid").doesNotExist())
                .andExpect(jsonPath("$.sessionKey").doesNotExist())
                .andExpect(jsonPath("$.appSecret").doesNotExist());
    }

    @Test
    void wechatEndpointsUseTypedValidationAndConflictErrors() throws Exception {
        mockMvc.perform(post("/api/auth/wechat-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WECHAT_LOGIN_CODE_REQUIRED"))
                .andExpect(jsonPath("$.message").value("code 不能为空"));

        User user = sampleUser();
        user.setPasswordHash(new BCryptPasswordEncoder().encode("demo123456"));
        user.setWechatOpenid("other-openid");
        when(userMapper.findByUsername("demo")).thenReturn(user);
        when(wechat.exchangeCode("wx-code"))
                .thenReturn(new WechatLoginGateway.Session("new-openid", null));

        mockMvc.perform(post("/api/auth/wechat-bind-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"wx-code\",\"username\":\"demo\",\"password\":\"demo123456\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WECHAT_ACCOUNT_ALREADY_BOUND"));
    }

    @Test
    void meRequiresActorAndReturnsFreshUser() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.username").value("demo"))
                .andExpect(jsonPath("$.coupleRole").value("girlfriend"));
    }

    @Test
    void updateProfileUsesActorAndReturnsUpdatedUser() throws Exception {
        User updated = sampleUser();
        updated.setDisplayName("示例用户");
        updated.setMood("想见你");
        updated.setBio("把每一天都写进 Snowlit。");
        when(userMapper.updateProfile(
                1L,
                "示例用户",
                "想见你",
                "把每一天都写进 Snowlit。"
        )).thenReturn(1);
        when(userMapper.findById(1L)).thenReturn(updated);

        mockMvc.perform(patch("/api/auth/me/profile")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "displayName":"示例用户",
                                  "mood":"想见你",
                                  "bio":"把每一天都写进 Snowlit。"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("示例用户"))
                .andExpect(jsonPath("$.mood").value("想见你"))
                .andExpect(jsonPath("$.bio").value("把每一天都写进 Snowlit。"));

        verify(userMapper).updateProfile(
                1L,
                "示例用户",
                "想见你",
                "把每一天都写进 Snowlit。"
        );
    }

    @Test
    void logoutEndsSessionAndRejectsMissingAuthorization() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private User sampleUser() {
        User user = new User(
                1L,
                "demo",
                "Demo User",
                "hash",
                "https://cdn.example.com/avatar.png",
                "About me",
                "Happy",
                LocalDateTime.of(2026, 4, 27, 12, 0)
        );
        user.setCoupleRole("girlfriend");
        return user;
    }
}
