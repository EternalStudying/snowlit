package xyz.snowlit.auth;

import java.time.Duration;
import java.util.Optional;

/**
 * Persists business sessions keyed by their opaque token. Redis in the application, in memory in tests.
 */
public interface AuthSessionStore {

    void create(String token, Long userId, Duration ttl);

    Optional<Long> userId(String token);

    void delete(String token);
}
