package xyz.snowlit.auth;

import xyz.snowlit.support.InMemoryAuthSessionStore;
import xyz.snowlit.support.SingleUserMapper;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class AuthSessionsTests {

    private final InMemoryAuthSessionStore store = new InMemoryAuthSessionStore();
    private final SingleUserMapper users = new SingleUserMapper(member());
    private final AuthSessions sessions = new AuthSessions(store, users);

    @Test
    void issuesUnguessableOneHourTokensThatResolveToTheActor() {
        String token = sessions.issue(member());
        String another = sessions.issue(member());

        assertThat(token).matches("[A-Za-z0-9_-]{43}").isNotEqualTo(another);
        assertThat(store.ttlFor(token)).isEqualTo(Duration.ofHours(1));
        assertThat(sessions.resolve(token)).contains(new AuthenticatedActor(
                1L, "member_a", "伴侣 A", "/avatar.webp", "bio", "happy", "girlfriend"
        ));
    }

    @Test
    void unknownBlankOrRevokedTokensAndDeletedUsersResolveToNobody() {
        String token = sessions.issue(member());

        assertThat(sessions.resolve("")).isEmpty();
        assertThat(sessions.resolve("unknown")).isEmpty();

        users.replace(null);
        assertThat(sessions.resolve(token)).isEmpty();

        users.replace(member());
        sessions.revoke(token);
        assertThat(sessions.resolve(token)).isEmpty();
    }

    private static User member() {
        User user = new User(1L, "member_a", "伴侣 A", "secret", "/avatar.webp", "bio", "happy", null);
        user.setCoupleRole("girlfriend");
        return user;
    }
}
