package xyz.snowlit.infrastructure.auth;

import xyz.snowlit.auth.AuthSessionStore;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public final class RedisAuthSessionStore implements AuthSessionStore {

    private static final String KEY_PREFIX = "loginSession:";

    private final StringRedisTemplate redisTemplate;

    public RedisAuthSessionStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void create(String token, Long userId, String username, Duration ttl) {
        redisTemplate.opsForValue().set(KEY_PREFIX + token, userId + ":" + username, ttl);
    }

    @Override
    public boolean exists(String token) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(KEY_PREFIX + token));
    }

    @Override
    public void delete(String token) {
        redisTemplate.delete(KEY_PREFIX + token);
    }
}
