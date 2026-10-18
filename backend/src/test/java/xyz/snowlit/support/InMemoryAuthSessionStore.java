package xyz.snowlit.support;

import xyz.snowlit.auth.AuthSessionStore;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * AuthSessionStore adapter for tests; sessions never expire on their own.
 */
public final class InMemoryAuthSessionStore implements AuthSessionStore {

    private final Map<String, Long> userIds = new HashMap<>();
    private final Map<String, Duration> ttls = new HashMap<>();

    @Override
    public void create(String token, Long userId, Duration ttl) {
        userIds.put(token, userId);
        ttls.put(token, ttl);
    }

    @Override
    public Optional<Long> userId(String token) {
        return Optional.ofNullable(userIds.get(token));
    }

    @Override
    public void delete(String token) {
        ttls.remove(token);
        userIds.remove(token);
    }

    public boolean exists(String token) {
        return userIds.containsKey(token);
    }

    public Duration ttlFor(String token) {
        return ttls.get(token);
    }

    public int sessionCount() {
        return userIds.size();
    }
}
