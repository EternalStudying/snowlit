package xyz.snowlit.infrastructure.album;

import xyz.snowlit.album.AlbumPrivateAccessTokenStore;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.UUID;

@Service
public final class RedisAlbumPrivateAccessTokenStore implements AlbumPrivateAccessTokenStore {

    private static final String KEY_PREFIX = "albumPrivateToken:";
    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final StringRedisTemplate redisTemplate;

    public RedisAlbumPrivateAccessTokenStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public CreatedToken create(Long albumId, Long userId, Duration ttl, LocalDateTime expiresAt) {
        String token = createToken(albumId, userId, expiresAt);
        String value = albumId + ":" + userId + ":" + expiresAt.atZone(ZONE).toEpochSecond();
        redisTemplate.opsForValue().set(KEY_PREFIX + token, value, ttl);
        return new CreatedToken(token, expiresAt);
    }

    @Override
    public ValidationStatus validate(String token, Long albumId, Long userId) {
        if (token == null || token.isBlank()) {
            return ValidationStatus.INVALID;
        }

        String value = redisTemplate.opsForValue().get(KEY_PREFIX + token);
        if (value == null || value.isBlank()) {
            return isExpiredTokenShape(token) ? ValidationStatus.EXPIRED : ValidationStatus.INVALID;
        }

        String[] parts = value.split(":");
        if (parts.length != 3 || !parts[0].equals(String.valueOf(albumId)) || !parts[1].equals(String.valueOf(userId))) {
            return ValidationStatus.INVALID;
        }
        long expiresAt = parseLong(parts[2]);
        return expiresAt < LocalDateTime.now().atZone(ZONE).toEpochSecond()
                ? ValidationStatus.EXPIRED
                : ValidationStatus.VALID;
    }

    private String createToken(Long albumId, Long userId, LocalDateTime expiresAt) {
        String payload = albumId + ":" + userId + ":" + expiresAt.atZone(ZONE).toEpochSecond() + ":" + UUID.randomUUID();
        return "album_" + Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }

    private boolean isExpiredTokenShape(String token) {
        if (!token.startsWith("album_")) {
            return false;
        }
        try {
            String payload = new String(Base64.getUrlDecoder().decode(token.substring(6)), StandardCharsets.UTF_8);
            String[] parts = payload.split(":");
            return parts.length >= 3 && parseLong(parts[2]) < LocalDateTime.now().atZone(ZONE).toEpochSecond();
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return -1L;
        }
    }
}
