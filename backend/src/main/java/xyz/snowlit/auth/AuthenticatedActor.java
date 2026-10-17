package xyz.snowlit.auth;

public record AuthenticatedActor(
        Long userId,
        String username,
        String displayName,
        String avatarUrl,
        String bio,
        String mood
) {
}
