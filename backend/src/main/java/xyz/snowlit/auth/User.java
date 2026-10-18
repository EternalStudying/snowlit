package xyz.snowlit.auth;

import java.util.Set;
import java.time.LocalDateTime;

public class User {

    private static final Set<String> COUPLE_ROLES = Set.of("boyfriend", "girlfriend");
    // Managers are fixed for the single couple this deployment serves.
    private static final Set<Long> MANAGER_IDS = Set.of(1L, 2L);

    private Long id;
    private String username;
    private String displayName;
    private String passwordHash;
    private String avatarUrl;
    private String bio;
    private String mood;
    private String coupleRole;
    private String wechatOpenid;
    private String wechatUnionid;
    private LocalDateTime wechatBoundAt;
    private LocalDateTime updatedAt;

    public User() {
    }

    public User(Long id, String username, String displayName, String passwordHash) {
        this(id, username, displayName, passwordHash, null, null, null, null);
    }

    public User(Long id, String username, String displayName, String passwordHash,
                    String avatarUrl, String bio, String mood, LocalDateTime updatedAt) {
        this(id, username, displayName, passwordHash, avatarUrl, bio, mood, null, null, null, updatedAt);
    }

    public User(Long id, String username, String displayName, String passwordHash,
                    String avatarUrl, String bio, String mood,
                    String wechatOpenid, String wechatUnionid, LocalDateTime wechatBoundAt,
                    LocalDateTime updatedAt) {
        this.id = id;
        this.username = username;
        this.displayName = displayName;
        this.passwordHash = passwordHash;
        this.avatarUrl = avatarUrl;
        this.bio = bio;
        this.mood = mood;
        this.wechatOpenid = wechatOpenid;
        this.wechatUnionid = wechatUnionid;
        this.wechatBoundAt = wechatBoundAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getMood() {
        return mood;
    }

    public void setMood(String mood) {
        this.mood = mood;
    }

    /**
     * The configured couple role, or null when the account has no recognised role.
     */
    public String validCoupleRole() {
        return coupleRole != null && COUPLE_ROLES.contains(coupleRole) ? coupleRole : null;
    }

    public boolean isManager() {
        return MANAGER_IDS.contains(id);
    }

    public String getCoupleRole() {
        return coupleRole;
    }

    public void setCoupleRole(String coupleRole) {
        this.coupleRole = coupleRole;
    }

    public String getWechatOpenid() {
        return wechatOpenid;
    }

    public void setWechatOpenid(String wechatOpenid) {
        this.wechatOpenid = wechatOpenid;
    }

    public String getWechatUnionid() {
        return wechatUnionid;
    }

    public void setWechatUnionid(String wechatUnionid) {
        this.wechatUnionid = wechatUnionid;
    }

    public LocalDateTime getWechatBoundAt() {
        return wechatBoundAt;
    }

    public void setWechatBoundAt(LocalDateTime wechatBoundAt) {
        this.wechatBoundAt = wechatBoundAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
