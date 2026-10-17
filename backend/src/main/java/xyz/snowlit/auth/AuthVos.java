package xyz.snowlit.auth;

import java.time.LocalDateTime;

public final class AuthVos {

    private AuthVos() {
    }

    public record CurrentUserVo(
            Long id,
            String username,
            String displayName,
            String coupleRole,
            String avatarUrl,
            String bio,
            String mood,
            LocalDateTime updatedAt
    ) {
    }

    public record LoginVo(String token, CurrentUserVo user) {
    }
}
