package xyz.snowlit;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.auth.RequestIdentity;
import xyz.snowlit.auth.User;
import xyz.snowlit.auth.UserMapper;
import xyz.snowlit.auth.AuthSessionStore;
import xyz.snowlit.auth.JwtService;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class RequestIdentityTests {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hs256-tests";

    private final FakeAuthSessionStore sessions = new FakeAuthSessionStore();
    private final JwtService jwt = new JwtService(SECRET, sessions);
    private final FakeUserMapper users = new FakeUserMapper();
    private final RequestIdentity identity = new RequestIdentity(jwt, users);

    @Test
    void resolvesActiveSessionToSafeAuthenticatedActor() {
        users.user = new User(1L, "member_a", "伴侣 A", "secret", "/avatar.webp", "bio", "happy", null);
        String token = jwt.generateToken(1L, "member_a");
        sessions.create(token, 1L, "member_a", jwt.tokenTtl());

        Optional<AuthenticatedActor> actor = identity.resolve(token);

        assertThat(actor).contains(new AuthenticatedActor(
                1L,
                "member_a",
                "伴侣 A",
                "/avatar.webp",
                "bio",
                "happy"
        ));
    }

    @Test
    void rejectsMissingSessionAndMissingUserWithoutLeakingTokenFailure() {
        String inactiveToken = jwt.generateToken(1L, "member_a");

        assertThat(identity.resolve(inactiveToken)).isEmpty();

        sessions.create(inactiveToken, 1L, "member_a", jwt.tokenTtl());
        users.user = null;

        assertThat(identity.resolve(inactiveToken)).isEmpty();
        assertThat(identity.resolve("not-a-jwt")).isEmpty();
        assertThat(identity.resolve("")).isEmpty();
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

        private User user;

        @Override
        public User findByUsername(String username) {
            return user;
        }

        @Override
        public User findById(Long id) {
            return user != null && user.getId().equals(id) ? user : null;
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
