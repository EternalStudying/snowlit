package xyz.snowlit.infrastructure.auth;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RedisAuthSessionStoreTests {

    @Test
    void redisStoreUsesLoginSessionKeyAndJwtTtl() {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.hasKey("loginSession:jwt-token")).thenReturn(true);
        RedisAuthSessionStore store = new RedisAuthSessionStore(redisTemplate);

        store.create("jwt-token", 1L, "demo", Duration.ofHours(1));

        verify(valueOperations).set("loginSession:jwt-token", "1:demo", Duration.ofHours(1));
        assertThat(store.exists("jwt-token")).isTrue();

        store.delete("jwt-token");

        verify(redisTemplate).delete("loginSession:jwt-token");
    }
}
