package xyz.snowlit.auth;

import xyz.snowlit.text.Text;
import xyz.snowlit.auth.AuthDtos.LoginDto;
import xyz.snowlit.auth.AuthDtos.ProfileUpdateDto;
import xyz.snowlit.auth.AuthDtos.WechatBindLoginDto;
import xyz.snowlit.auth.AuthDtos.WechatLoginDto;
import xyz.snowlit.auth.AuthVos.CurrentUserVo;
import xyz.snowlit.auth.AuthVos.LoginVo;
import xyz.snowlit.failure.ApplicationFailure;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;


@Service
public final class AuthModule {

    private static final int DISPLAY_NAME_MAX_LENGTH = 20;
    private static final int MOOD_MAX_LENGTH = 20;
    private static final int BIO_MAX_LENGTH = 80;

    private final UserMapper userMapper;
    private final JwtService jwt;
    private final AuthSessionStore sessions;
    private final PasswordEncoder passwordEncoder;
    private final WechatLoginGateway wechat;
    private final Environment environment;
    private final String devBindUserId;

    public AuthModule(
            UserMapper userMapper,
            JwtService jwt,
            AuthSessionStore sessions,
            PasswordEncoder passwordEncoder,
            WechatLoginGateway wechat,
            Environment environment,
            @Value("${snowlit.wechat.miniprogram.dev-bind-user-id:}") String devBindUserId
    ) {
        this.userMapper = userMapper;
        this.jwt = jwt;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.wechat = wechat;
        this.environment = environment;
        this.devBindUserId = Text.trim(devBindUserId);
    }

    public LoginVo login(LoginDto request) {
        String username = Text.trim(request.username());
        String password = Text.trim(request.password());
        User user = userMapper.findByUsername(username);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw ApplicationFailure.unauthenticated("ACCOUNT_PASSWORD_INVALID", "账号或密码不正确");
        }
        return issueLogin(user);
    }

    public LoginVo wechatLogin(WechatLoginDto request) {
        String code = Text.trim(request.code());
        if (code.isBlank()) {
            throw ApplicationFailure.invalidInput("WECHAT_LOGIN_CODE_REQUIRED", "code 不能为空");
        }
        WechatLoginGateway.Session session = wechat.exchangeCode(code);
        User user = userMapper.findByWechatOpenid(session.openid());
        if (user == null) {
            user = devBindWechatUser(session);
        }
        if (user == null) {
            throw ApplicationFailure.forbidden("WECHAT_ACCOUNT_NOT_BOUND", "微信账号未绑定");
        }
        return issueLogin(user);
    }

    public LoginVo wechatBindLogin(WechatBindLoginDto request) {
        String code = Text.trim(request.code());
        String username = Text.trim(request.username());
        String password = Text.trim(request.password());
        if (code.isBlank()) {
            throw ApplicationFailure.invalidInput("WECHAT_LOGIN_CODE_REQUIRED", "code 不能为空");
        }

        User user = userMapper.findByUsername(username);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw ApplicationFailure.unauthenticated("ACCOUNT_PASSWORD_INVALID", "账号或密码不正确");
        }

        WechatLoginGateway.Session session = wechat.exchangeCode(code);
        User existingWechatUser = userMapper.findByWechatOpenid(session.openid());
        if (existingWechatUser != null) {
            if (existingWechatUser.getId().equals(user.getId())) {
                return issueLogin(existingWechatUser);
            }
            throw ApplicationFailure.conflict("WECHAT_OPENID_ALREADY_BOUND", "当前微信已绑定其他账号");
        }

        String currentOpenid = Text.trim(user.getWechatOpenid());
        if (!currentOpenid.isBlank() && !currentOpenid.equals(session.openid())) {
            throw ApplicationFailure.conflict("WECHAT_ACCOUNT_ALREADY_BOUND", "该账号已绑定其他微信");
        }
        if (currentOpenid.equals(session.openid())) {
            return issueLogin(user);
        }

        int updated = userMapper.bindWechatOpenidIfUnbound(
                user.getId(),
                session.openid(),
                Text.trimToNull(session.unionid())
        );
        if (updated != 1) {
            throw ApplicationFailure.conflict("WECHAT_ACCOUNT_ALREADY_BOUND", "该账号已绑定其他微信");
        }
        return issueLogin(userMapper.findById(user.getId()));
    }

    public void logout(String token) {
        if (!jwt.isSignatureValid(token)) {
            throw ApplicationFailure.unauthenticated("UNAUTHORIZED", "登录已过期，请重新登录");
        }
        sessions.delete(token);
    }

    public CurrentUserVo currentUser(AuthenticatedActor actor) {
        return toVo(requireUser(actor.userId()));
    }

    public CurrentUserVo updateProfile(AuthenticatedActor actor, ProfileUpdateDto request) {
        String displayName = Text.trim(request.displayName());
        String mood = Text.trimToNull(request.mood());
        String bio = Text.trimToNull(request.bio());

        if (displayName.isBlank()) {
            throw ApplicationFailure.invalidInput("PROFILE_DISPLAY_NAME_REQUIRED", "请输入昵称");
        }
        if (isTooLong(displayName, DISPLAY_NAME_MAX_LENGTH)) {
            throw ApplicationFailure.invalidInput("PROFILE_DISPLAY_NAME_TOO_LONG", "昵称最多 20 个字");
        }
        if (isTooLong(mood, MOOD_MAX_LENGTH)) {
            throw ApplicationFailure.invalidInput("PROFILE_MOOD_TOO_LONG", "心情最多 20 个字");
        }
        if (isTooLong(bio, BIO_MAX_LENGTH)) {
            throw ApplicationFailure.invalidInput("PROFILE_BIO_TOO_LONG", "简介最多 80 个字");
        }

        int updated = userMapper.updateProfile(actor.userId(), displayName, mood, bio);
        if (updated != 1) {
            throw ApplicationFailure.unauthenticated("UNAUTHORIZED", "登录已过期，请重新登录");
        }
        return toVo(requireUser(actor.userId()));
    }

    private User devBindWechatUser(WechatLoginGateway.Session session) {
        if (!environment.acceptsProfiles(Profiles.of("dev")) || devBindUserId.isBlank()) {
            return null;
        }

        Long userId;
        try {
            userId = Long.parseLong(devBindUserId);
        } catch (NumberFormatException ex) {
            throw ApplicationFailure.internal("WECHAT_DEV_BIND_USER_INVALID", "本地微信绑定用户配置不正确");
        }

        int updated = userMapper.bindWechatOpenidIfUnbound(
                userId,
                session.openid(),
                Text.trimToNull(session.unionid())
        );
        return updated == 1 ? userMapper.findById(userId) : null;
    }

    private LoginVo issueLogin(User user) {
        String token = jwt.generateToken(user.getId(), user.getUsername());
        sessions.create(token, user.getId(), user.getUsername(), jwt.tokenTtl());
        return new LoginVo(token, toVo(user));
    }

    private User requireUser(Long userId) {
        User user = userMapper.findById(userId);
        if (user == null) {
            throw ApplicationFailure.unauthenticated("UNAUTHORIZED", "登录已过期，请重新登录");
        }
        return user;
    }

    private CurrentUserVo toVo(User user) {
        return new CurrentUserVo(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.validCoupleRole(),
                user.getAvatarUrl(),
                user.getBio(),
                user.getMood(),
                user.getUpdatedAt()
        );
    }


    private boolean isTooLong(String value, int maxLength) {
        return value != null && value.codePointCount(0, value.length()) > maxLength;
    }

}
