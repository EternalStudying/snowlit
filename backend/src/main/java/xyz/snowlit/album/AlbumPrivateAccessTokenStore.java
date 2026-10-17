package xyz.snowlit.album;

import java.time.Duration;
import java.time.LocalDateTime;

public interface AlbumPrivateAccessTokenStore {

    CreatedToken create(Long albumId, Long userId, Duration ttl, LocalDateTime expiresAt);

    ValidationStatus validate(String token, Long albumId, Long userId);

    record CreatedToken(String token, LocalDateTime expiresAt) {
    }

    enum ValidationStatus {
        VALID,
        EXPIRED,
        INVALID
    }
}
