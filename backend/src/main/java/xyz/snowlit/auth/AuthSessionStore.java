package xyz.snowlit.auth;

import java.time.Duration;

public interface AuthSessionStore {

    void create(String token, Long userId, String username, Duration ttl);

    boolean exists(String token);

    void delete(String token);
}
