package xyz.snowlit.auth;

import java.util.Set;

public final class SiteManagerPolicy {

    private static final Set<Long> MANAGER_USER_IDS = Set.of(1L, 2L);

    private SiteManagerPolicy() {
    }

    public static boolean canManage(Long userId) {
        return MANAGER_USER_IDS.contains(userId);
    }
}
