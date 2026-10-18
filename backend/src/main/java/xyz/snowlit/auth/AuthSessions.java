package xyz.snowlit.auth;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

/**
 * Business sessions: issues an opaque bearer token for a user, resolves a token to the acting user,
 * and revokes it. A session lasts one hour from login.
 */
@Service
public class AuthSessions {

    static final Duration TTL = Duration.ofHours(1);

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthSessionStore store;
    private final UserMapper users;

    public AuthSessions(AuthSessionStore store, UserMapper users) {
        this.store = store;
        this.users = users;
    }

    public String issue(User user) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        store.create(token, user.getId(), TTL);
        return token;
    }

    /**
     * The actor behind a live session, or empty for a blank, unknown or expired token or a deleted user.
     */
    public Optional<AuthenticatedActor> resolve(String token) {
        if (token.isBlank()) {
            return Optional.empty();
        }
        return store.userId(token)
                .map(users::findById)
                .map(AuthSessions::toActor);
    }

    /**
     * Ends the session; revoking an unknown or expired token has no effect.
     */
    public void revoke(String token) {
        store.delete(token);
    }

    private static AuthenticatedActor toActor(User user) {
        return new AuthenticatedActor(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getBio(),
                user.getMood(),
                user.validCoupleRole(),
                user.isManager()
        );
    }
}
