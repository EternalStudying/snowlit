package xyz.snowlit.album;

import java.time.Duration;
import java.time.LocalDateTime;

public interface AlbumPrivateAccessTokenStore {

    CreatedToken create(Long albumId, Long userId, String passwordStamp, Duration ttl, LocalDateTime expiresAt);

    ValidationStatus validate(String token, Long albumId, Long userId, String passwordStamp);

    record CreatedToken(String token, LocalDateTime expiresAt) {
    }

    enum ValidationStatus {
        VALID,
        EXPIRED,
        INVALID
    }
}
