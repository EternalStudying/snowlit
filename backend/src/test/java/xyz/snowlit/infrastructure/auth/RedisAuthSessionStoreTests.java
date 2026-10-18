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
    void storesUserIdUnderLoginSessionKeyWithTtl() {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("loginSession:token")).thenReturn("1");
        RedisAuthSessionStore store = new RedisAuthSessionStore(redisTemplate);

        store.create("token", 1L, Duration.ofHours(1));

        verify(valueOperations).set("loginSession:token", "1", Duration.ofHours(1));
        assertThat(store.userId("token")).contains(1L);
        assertThat(store.userId("missing")).isEmpty();
        store.delete("token");
        verify(redisTemplate).delete("loginSession:token");
    }
}
