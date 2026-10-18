package xyz.snowlit.infrastructure.auth;

import xyz.snowlit.auth.AuthSessionStore;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
public final class RedisAuthSessionStore implements AuthSessionStore {

    private static final String KEY_PREFIX = "loginSession:";

    private final StringRedisTemplate redisTemplate;

    public RedisAuthSessionStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void create(String token, Long userId, Duration ttl) {
        redisTemplate.opsForValue().set(KEY_PREFIX + token, userId.toString(), ttl);
    }

    @Override
    public Optional<Long> userId(String token) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(KEY_PREFIX + token)).map(Long::valueOf);
    }

    @Override
    public void delete(String token) {
        redisTemplate.delete(KEY_PREFIX + token);
    }
}
