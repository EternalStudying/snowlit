package xyz.snowlit.album;

import xyz.snowlit.album.AlbumDtos.AlbumUnlockDto;
import xyz.snowlit.album.AlbumVos.AlbumUnlockVo;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Private album access: unlocking with the album password (with a temporary lock after repeated failures)
 * and checking the time-limited access token on later requests.
 */
@Service
public class AlbumPrivateAccess {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlbumPrivateAccess.class);
    private static final int MAX_UNLOCK_FAILURES = 5;
    private static final Duration TOKEN_TTL = Duration.ofHours(1);
    private static final Duration LOCK_DURATION = Duration.ofMinutes(10);

    private final AlbumMapper albumMapper;
    private final PasswordEncoder passwordEncoder;
    private final AlbumPrivateAccessTokenStore tokenStore;
    private final Clock clock;

    public AlbumPrivateAccess(
            AlbumMapper albumMapper,
            PasswordEncoder passwordEncoder,
            AlbumPrivateAccessTokenStore tokenStore,
            Clock clock
    ) {
        this.albumMapper = albumMapper;
        this.passwordEncoder = passwordEncoder;
        this.tokenStore = tokenStore;
        this.clock = clock;
    }

    public AlbumUnlockVo unlock(AuthenticatedActor actor, Long albumId, AlbumUnlockDto request) {
        Album album = Albums.require(albumMapper, albumId);
        if (!Albums.isPrivate(album)) {
            throw ApplicationFailure.invalidInput("ALBUM_NOT_PRIVATE", "相册不是私密相册");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        AlbumUnlockFailure failure = albumMapper.findUnlockFailure(album.getId(), actor.userId());
        if (failure != null && failure.getLockedUntil() != null && failure.getLockedUntil().isAfter(now)) {
            LOGGER.warn("Private album unlock blocked: userId={}, albumId={}, lockedUntil={}",
                    actor.userId(), album.getId(), failure.getLockedUntil());
            throw locked();
        }

        String password = Objects.requireNonNullElse(request.password(), "");
        if (!passwordEncoder.matches(password, album.getPrivatePasswordHash())) {
            int previousFailures = failure == null || failure.getLockedUntil() != null && !failure.getLockedUntil().isAfter(now)
                    ? 0
                    : failure.getFailureCount();
            int nextFailures = previousFailures + 1;
            LocalDateTime lockedUntil = nextFailures >= MAX_UNLOCK_FAILURES ? now.plus(LOCK_DURATION) : null;
            albumMapper.recordUnlockFailure(album.getId(), actor.userId(), nextFailures, lockedUntil, now, now);
            LOGGER.warn("Private album unlock failed: userId={}, albumId={}, failureCount={}, locked={}",
                    actor.userId(), album.getId(), nextFailures, lockedUntil != null);
            if (lockedUntil != null) {
                throw locked();
            }
            throw ApplicationFailure.invalidInput("PRIVATE_ALBUM_PASSWORD_INVALID", "私密相册密码不正确");
        }

        albumMapper.clearUnlockFailure(album.getId(), actor.userId());
        AlbumPrivateAccessTokenStore.CreatedToken created =
                tokenStore.create(album.getId(), actor.userId(), TOKEN_TTL, now.plus(TOKEN_TTL));
        return new AlbumUnlockVo(created.token(), created.expiresAt());
    }

    /**
     * Rejects the request unless the token grants this user access to this private album.
     */
    void require(Album album, Long userId, String token) {
        if (token == null || token.isBlank()) {
            throw ApplicationFailure.forbidden("PRIVATE_ALBUM_LOCKED", "请输入私密相册密码");
        }
        switch (tokenStore.validate(token, album.getId(), userId)) {
            case VALID -> {
            }
            case EXPIRED -> throw ApplicationFailure.forbidden(
                    "PRIVATE_ALBUM_TOKEN_EXPIRED", "私密相册访问已过期，请重新输入密码");
            case INVALID -> throw ApplicationFailure.forbidden(
                    "PRIVATE_ALBUM_TOKEN_INVALID", "私密相册访问无效，请重新输入密码");
        }
    }

    private static ApplicationFailure locked() {
        return ApplicationFailure.locked("PRIVATE_ALBUM_UNLOCK_LOCKED", "密码错误次数过多，请 10 分钟后再试");
    }
}
