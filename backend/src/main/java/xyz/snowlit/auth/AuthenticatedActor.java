package xyz.snowlit.auth;

import xyz.snowlit.failure.ApplicationFailure;

/**
 * The signed-in member acting on a request.
 *
 * @param coupleRole the validated couple role, or null when the account has none
 * @param manager    whether the member may curate shared content (albums, story moments, wishes)
 */
public record AuthenticatedActor(
        Long userId,
        String username,
        String displayName,
        String avatarUrl,
        String bio,
        String mood,
        String coupleRole,
        boolean manager
) {

    /**
     * Rejects non-managers with the calling feature's own forbidden code.
     */
    public void requireManager(String forbiddenCode, String forbiddenMessage) {
        if (!manager) {
            throw ApplicationFailure.forbidden(forbiddenCode, forbiddenMessage);
        }
    }
}
