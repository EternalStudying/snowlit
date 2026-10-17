package xyz.snowlit.auth;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTests {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hs256-tests";

    private final FakeAuthSessionStore authSessionStore = new FakeAuthSessionStore();
    private final JwtService jwtService = jwtService();

    @Test
    void generatedTokenExpiresAboutOneHourAfterIssuedAt() {
        String token = jwtService.generateToken(1L, "demo");

        SecretKey secretKey = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        long ttlSeconds = Duration.between(
                claims.getIssuedAt().toInstant(),
                claims.getExpiration().toInstant()
        ).toSeconds();

        assertThat(ttlSeconds).isBetween(3595L, 3605L);
    }

    @Test
    void generatedTokensForSameUserAreDistinctSessions() {
        String firstToken = jwtService.generateToken(1L, "demo");
        String secondToken = jwtService.generateToken(1L, "demo");

        assertThat(secondToken).isNotEqualTo(firstToken);
    }

    @Test
    void isValidRequiresJwtSignatureAndActiveSessionStoreEntry() {
        String token = jwtService.generateToken(1L, "demo");

        assertThat(jwtService.isValid(token)).isFalse();

        authSessionStore.create(token, 1L, "demo", jwtService.tokenTtl());

        assertThat(jwtService.isValid(token)).isTrue();
    }

    @Test
    void signatureValidationCanIgnoreMissingSessionForLogout() {
        String token = jwtService.generateToken(1L, "demo");

        assertThat(jwtService.isSignatureValid(token)).isTrue();
        assertThat(jwtService.isValid(token)).isFalse();
    }

    private JwtService jwtService() {
        return new JwtService(SECRET, authSessionStore);
    }

    private static class FakeAuthSessionStore implements AuthSessionStore {

        private final Set<String> tokens = new HashSet<>();

        @Override
        public void create(String token, Long userId, String username, Duration ttl) {
            tokens.add(token);
        }

        @Override
        public boolean exists(String token) {
            return tokens.contains(token);
        }

        @Override
        public void delete(String token) {
            tokens.remove(token);
        }
    }
}
