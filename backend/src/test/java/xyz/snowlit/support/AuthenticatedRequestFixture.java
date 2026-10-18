package xyz.snowlit.support;

import xyz.snowlit.auth.RequestIdentity;
import xyz.snowlit.auth.User;
import xyz.snowlit.auth.UserMapper;
import xyz.snowlit.auth.AuthSessionStore;
import xyz.snowlit.auth.JwtService;
import xyz.snowlit.web.AuthenticationRequiredInterceptor;
import xyz.snowlit.web.RequestActorResolver;

import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

public final class AuthenticatedRequestFixture {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hs256-tests";

    private final FakeAuthSessionStore sessions = new FakeAuthSessionStore();
    private final FakeUserMapper users;
    private final JwtService jwt = new JwtService(SECRET, sessions);
    private final RequestActorResolver actorResolver;
    private final String token;

    public AuthenticatedRequestFixture() {
        this(memberA());
    }

    private static User memberA() {
        User user = new User(1L, "member_a", "伴侣 A", "secret");
        user.setCoupleRole("boyfriend");
        return user;
    }

    public AuthenticatedRequestFixture(User user) {
        this.users = new FakeUserMapper(user);
        this.actorResolver = new RequestActorResolver(new RequestIdentity(jwt, users));
        this.token = jwt.generateToken(user.getId(), user.getUsername());
        sessions.create(token, user.getId(), user.getUsername(), jwt.tokenTtl());
    }

    public RequestActorResolver actorResolver() {
        return actorResolver;
    }

    public AuthenticationRequiredInterceptor authenticationRequired() {
        return new AuthenticationRequiredInterceptor();
    }

    public String authorization() {
        return "Bearer " + token;
    }

    private static final class FakeAuthSessionStore implements AuthSessionStore {

        private final Set<String> tokens = new HashSet<>();

        @Override
        public void create(String token, Long userId, String username, Duration ttl) {
            tokens.add(token);
        }

        @Override
        public boolean exists(String token) {
            return tokens.contains(token);
        }

        @Override
        public void delete(String token) {
            tokens.remove(token);
        }
    }

    private static final class FakeUserMapper implements UserMapper {

        private final User user;

        private FakeUserMapper(User user) {
            this.user = user;
        }

        @Override
        public User findByUsername(String username) {
            return user;
        }

        @Override
        public User findById(Long id) {
            return user.getId().equals(id) ? user : null;
        }

        @Override
        public User findByWechatOpenid(String openid) {
            return null;
        }

        @Override
        public int bindWechatOpenidIfUnbound(Long id, String openid, String unionid) {
            return 0;
        }

        @Override
        public int updateProfile(Long id, String displayName, String mood, String bio) {
            return 0;
        }
    }
}
