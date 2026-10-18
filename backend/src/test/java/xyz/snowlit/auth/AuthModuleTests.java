package xyz.snowlit.auth;

import xyz.snowlit.support.InMemoryAuthSessionStore;
import xyz.snowlit.auth.AuthDtos.LoginDto;
import xyz.snowlit.auth.AuthDtos.ProfileUpdateDto;
import xyz.snowlit.auth.AuthDtos.WechatBindLoginDto;
import xyz.snowlit.auth.AuthDtos.WechatLoginDto;
import xyz.snowlit.auth.AuthVos.CurrentUserVo;
import xyz.snowlit.auth.AuthVos.LoginVo;
import xyz.snowlit.failure.ApplicationFailure;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthModuleTests {

    private static final AuthenticatedActor ACTOR =
            new AuthenticatedActor(1L, "demo", "Demo User", null, "About me", "Happy", null, true);

    private final UserMapper userMapper = mock(UserMapper.class);
    private final InMemoryAuthSessionStore sessions = new InMemoryAuthSessionStore();
    private final FakeWechatLoginGateway wechat = new FakeWechatLoginGateway();
    private final AuthModule auth = auth("", "dev");

    @BeforeEach
    void resetWechat() {
        wechat.response = new WechatLoginGateway.Session("bound-openid", "unionid-1");
        wechat.failure = null;
        wechat.lastCode = null;
    }

    @Test
    void loginChecksBCryptPasswordAndCreatesIndependentSession() {
        String hash = new BCryptPasswordEncoder().encode("demo123456");
        when(userMapper.findByUsername("demo")).thenReturn(sampleUser(hash));

        LoginVo response = auth.login(new LoginDto("demo", "demo123456"));

        assertThat(response.token()).isNotBlank();
        assertThat(response.user()).isEqualTo(sampleVo());
        assertThat(sessions.userId(response.token())).contains(1L);
        assertThat(sessions.ttlFor(response.token())).isEqualTo(Duration.ofHours(1));
    }

    @Test
    void loginRejectsWrongPasswordWithTypedFailure() {
        String hash = new BCryptPasswordEncoder().encode("demo123456");
        when(userMapper.findByUsername("demo")).thenReturn(sampleUser(hash));

        assertThatThrownBy(() -> auth.login(new LoginDto("demo", "wrong")))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("账号或密码不正确");
    }

    @Test
    void wechatLoginExchangesCodeForBoundUserAndCreatesSession() {
        when(userMapper.findByWechatOpenid("bound-openid")).thenReturn(sampleUser("hash"));

        LoginVo response = auth.wechatLogin(new WechatLoginDto("wx-code"));

        assertThat(wechat.lastCode).isEqualTo("wx-code");
        assertThat(response.user()).isEqualTo(sampleVo());
        assertThat(sessions.exists(response.token())).isTrue();
    }

    @Test
    void wechatLoginValidatesCodeAndBoundAccount() {
        assertThatThrownBy(() -> auth.wechatLogin(new WechatLoginDto("  ")))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("code 不能为空");
        assertThat(wechat.lastCode).isNull();

        wechat.response = new WechatLoginGateway.Session("unbound-openid", null);
        assertThatThrownBy(() -> auth.wechatLogin(new WechatLoginDto("wx-code")))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("微信账号未绑定");
        assertThat(sessions.sessionCount()).isZero();
    }

    @Test
    void wechatLoginAutoBindsConfiguredUserOnlyInDev() {
        wechat.response = new WechatLoginGateway.Session("unbound-openid", "unionid-1");
        when(userMapper.bindWechatOpenidIfUnbound(1L, "unbound-openid", "unionid-1")).thenReturn(1);
        when(userMapper.findById(1L)).thenReturn(sampleUser("hash"));

        LoginVo response = auth("1", "dev").wechatLogin(new WechatLoginDto("wx-code"));

        assertThat(response.user()).isEqualTo(sampleVo());
        verify(userMapper).bindWechatOpenidIfUnbound(1L, "unbound-openid", "unionid-1");

        wechat.response = new WechatLoginGateway.Session("other-openid", null);
        assertThatThrownBy(() -> auth("1", "prod").wechatLogin(new WechatLoginDto("wx-code")))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("微信账号未绑定");
        verify(userMapper, never()).bindWechatOpenidIfUnbound(1L, "other-openid", null);
    }

    @Test
    void wechatLoginPropagatesGatewayFailureWithoutCreatingSession() {
        wechat.failure = ApplicationFailure.unauthenticated(
                "WECHAT_LOGIN_CODE_INVALID",
                "微信登录凭证无效"
        );

        assertThatThrownBy(() -> auth.wechatLogin(new WechatLoginDto("bad-code")))
                .isSameAs(wechat.failure);
        assertThat(sessions.sessionCount()).isZero();
    }

    @Test
    void wechatBindLoginBindsUnboundAccountAndCreatesSession() {
        String hash = new BCryptPasswordEncoder().encode("demo123456");
        wechat.response = new WechatLoginGateway.Session("new-openid", "unionid-1");
        when(userMapper.findByUsername("demo")).thenReturn(sampleUser(hash));
        when(userMapper.bindWechatOpenidIfUnbound(1L, "new-openid", "unionid-1")).thenReturn(1);
        when(userMapper.findById(1L)).thenReturn(sampleUser(hash));

        LoginVo response = auth.wechatBindLogin(
                new WechatBindLoginDto("wx-code", " demo ", "demo123456")
        );

        verify(userMapper).bindWechatOpenidIfUnbound(1L, "new-openid", "unionid-1");
        assertThat(response.user()).isEqualTo(sampleVo());
        assertThat(sessions.exists(response.token())).isTrue();
    }

    @Test
    void wechatBindLoginRejectsPasswordAndBindingConflicts() {
        String hash = new BCryptPasswordEncoder().encode("demo123456");
        when(userMapper.findByUsername("demo")).thenReturn(sampleUser(hash));

        assertThatThrownBy(() -> auth.wechatBindLogin(
                new WechatBindLoginDto("wx-code", "demo", "wrong")
        )).isInstanceOf(ApplicationFailure.class)
                .hasMessage("账号或密码不正确");

        wechat.response = new WechatLoginGateway.Session("new-openid", null);
        when(userMapper.findByWechatOpenid("new-openid"))
                .thenReturn(new User(2L, "other", "Other User", hash));
        assertThatThrownBy(() -> auth.wechatBindLogin(
                new WechatBindLoginDto("wx-code", "demo", "demo123456")
        )).isInstanceOf(ApplicationFailure.class)
                .hasMessage("当前微信已绑定其他账号");
    }

    @Test
    void currentUserReadsFreshUserAndUsesPersistedCoupleRole() {
        User persisted = sampleUser("hash");
        persisted.setCoupleRole("boyfriend");
        when(userMapper.findById(1L)).thenReturn(persisted);

        CurrentUserVo response = auth.currentUser(ACTOR);

        assertThat(response.coupleRole()).isEqualTo("boyfriend");
        assertThat(response.username()).isEqualTo("demo");
    }

    @Test
    void updateProfileTrimsAndPersistsTextFieldsForActor() {
        User updated = sampleUser("hash", "示例用户", "把每一天都写进 Snowlit。", "想见你");
        when(userMapper.updateProfile(1L, "示例用户", "想见你", "把每一天都写进 Snowlit。"))
                .thenReturn(1);
        when(userMapper.findById(1L)).thenReturn(updated);

        CurrentUserVo response = auth.updateProfile(
                ACTOR,
                new ProfileUpdateDto(" 示例用户 ", " 想见你 ", " 把每一天都写进 Snowlit。 ")
        );

        verify(userMapper).updateProfile(1L, "示例用户", "想见你", "把每一天都写进 Snowlit。");
        assertThat(response.displayName()).isEqualTo("示例用户");
        assertThat(response.mood()).isEqualTo("想见你");
        assertThat(response.bio()).isEqualTo("把每一天都写进 Snowlit。");
    }

    @Test
    void updateProfileRejectsBlankDisplayNameWithoutWriting() {
        assertThatThrownBy(() -> auth.updateProfile(ACTOR, new ProfileUpdateDto(" ", "想见你", "简介")))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("请输入昵称");
        verify(userMapper, never()).updateProfile(1L, "", "想见你", "简介");
    }

    @Test
    void logoutDeletesOnlyCurrentSessionAndIsIdempotent() {
        String firstToken = activeToken();
        String secondToken = activeToken();

        auth.logout(firstToken);

        assertThat(sessions.exists(firstToken)).isFalse();
        assertThat(sessions.exists(secondToken)).isTrue();

        assertThatCode(() -> auth.logout(firstToken)).doesNotThrowAnyException();
        assertThatThrownBy(() -> auth.logout(""))
                .isInstanceOfSatisfying(ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("UNAUTHORIZED"));
    }

    private AuthModule auth(String devBindUserId, String profile) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profile);
        return new AuthModule(
                userMapper,
                new AuthSessions(sessions, userMapper),
                new BCryptPasswordEncoder(),
                wechat,
                environment,
                devBindUserId
        );
    }

    private User sampleUser(String hash) {
        return sampleUser(hash, "Demo User", "About me", "Happy");
    }

    private User sampleUser(String hash, String displayName, String bio, String mood) {
        User user = new User(
                1L,
                "demo",
                displayName,
                hash,
                "https://cdn.example.com/avatar.png",
                bio,
                mood,
                LocalDateTime.of(2026, 4, 27, 12, 0)
        );
        user.setCoupleRole("girlfriend");
        return user;
    }

    private CurrentUserVo sampleVo() {
        return new CurrentUserVo(
                1L,
                "demo",
                "Demo User",
                "girlfriend",
                "https://cdn.example.com/avatar.png",
                "About me",
                "Happy",
                LocalDateTime.of(2026, 4, 27, 12, 0)
        );
    }

    private String activeToken() {
        return new AuthSessions(sessions, userMapper).issue(sampleUser("hash"));
    }


    private static final class FakeWechatLoginGateway implements WechatLoginGateway {

        private Session response;
        private ApplicationFailure failure;
        private String lastCode;

        @Override
        public Session exchangeCode(String code) {
            lastCode = code;
            if (failure != null) {
                throw failure;
            }
            return response;
        }
    }
}
