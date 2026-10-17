package xyz.snowlit;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.auth.RequestIdentity;
import xyz.snowlit.auth.User;
import xyz.snowlit.auth.UserMapper;
import xyz.snowlit.auth.AuthSessionStore;
import xyz.snowlit.auth.JwtService;
import xyz.snowlit.web.AuthenticationRequiredInterceptor;
import xyz.snowlit.web.CurrentActor;
import xyz.snowlit.web.RequestActorResolver;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RequestActorWebTests {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hs256-tests";

    private final FakeAuthSessionStore sessions = new FakeAuthSessionStore();
    private final JwtService jwt = new JwtService(SECRET, sessions);
    private final FakeUserMapper users = new FakeUserMapper();
    private final RequestActorResolver actorResolver = new RequestActorResolver(new RequestIdentity(jwt, users));

    @Test
    void protectedWebSeamInjectsAuthenticatedActorResolvedOnce() throws Exception {
        users.user = new User(1L, "member_a", "伴侣 A", "secret");
        String token = jwt.generateToken(1L, "member_a");
        sessions.create(token, 1L, "member_a", jwt.tokenTtl());

        protectedMockMvc().perform(get("/test/protected")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(jsonPath("$.displayName").value("伴侣 A"));
    }

    @Test
    void protectedWebSeamRejectsAnonymousButPublicSeamKeepsOptionalActorEmpty() throws Exception {
        protectedMockMvc().perform(get("/test/protected"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        publicMockMvc().perform(get("/test/public")
                        .header("Authorization", "Bearer invalid"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false));
    }

    private MockMvc protectedMockMvc() {
        return MockMvcBuilders.standaloneSetup(new ActorController())
                .addInterceptors(actorResolver, new AuthenticationRequiredInterceptor())
                .setCustomArgumentResolvers(actorResolver)
                .build();
    }

    private MockMvc publicMockMvc() {
        return MockMvcBuilders.standaloneSetup(new ActorController())
                .addInterceptors(actorResolver)
                .setCustomArgumentResolvers(actorResolver)
                .build();
    }

    @RestController
    static class ActorController {

        @GetMapping("/test/protected")
        Map<String, Object> protectedActor(@CurrentActor AuthenticatedActor actor) {
            return Map.of("userId", actor.userId(), "displayName", actor.displayName());
        }

        @GetMapping("/test/public")
        Map<String, Object> publicActor(@CurrentActor(required = false) AuthenticatedActor actor) {
            return Map.of("authenticated", actor != null);
        }
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
