package xyz.snowlit;

import xyz.snowlit.auth.AuthSessions;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.auth.User;
import xyz.snowlit.support.InMemoryAuthSessionStore;
import xyz.snowlit.support.SingleUserMapper;
import xyz.snowlit.web.ApiExceptionHandler;
import xyz.snowlit.web.CurrentActor;
import xyz.snowlit.web.RequestActorResolver;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RequestActorWebTests {

    private final User member = new User(1L, "member_a", "伴侣 A", "secret");
    private final AuthSessions sessions =
            new AuthSessions(new InMemoryAuthSessionStore(), new SingleUserMapper(member));
    private final RequestActorResolver actorResolver = new RequestActorResolver(sessions);

    @Test
    void requiredActorIsResolvedFromBearerToken() throws Exception {
        String token = sessions.issue(member);

        mockMvc().perform(get("/test/protected")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(jsonPath("$.displayName").value("伴侣 A"));
    }

    @Test
    void requiredActorRejectsAnonymousWhileOptionalActorStaysEmpty() throws Exception {
        mockMvc().perform(get("/test/protected"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc().perform(get("/test/public")
                        .header("Authorization", "Bearer invalid"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false));
    }

    private MockMvc mockMvc() {
        return MockMvcBuilders.standaloneSetup(new ActorController())
                .setCustomArgumentResolvers(actorResolver)
                .setControllerAdvice(new ApiExceptionHandler())
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
}
