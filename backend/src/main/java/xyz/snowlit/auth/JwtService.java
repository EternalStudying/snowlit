package xyz.snowlit.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public final class JwtService {

    private static final Duration TOKEN_TTL = Duration.ofHours(1);

    private final AuthSessionStore authSessionStore;
    private final SecretKey secretKey;

    public JwtService(
            @Value("${JWT_SECRET:snowlit-development-secret-key-change-me-please-32-bytes-minimum}") String secret,
            AuthSessionStore authSessionStore
    ) {
        this.authSessionStore = authSessionStore;
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Long userId, String username) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .id(UUID.randomUUID().toString())
                .claim("username", username)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(TOKEN_TTL)))
                .signWith(secretKey)
                .compact();
    }

    public boolean isValid(String token) {
        return isSignatureValid(token) && authSessionStore.exists(token);
    }

    public boolean isSignatureValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }

    public Duration tokenTtl() {
        return TOKEN_TTL;
    }

    public Long getUserId(String token) {
        return Long.valueOf(parseClaims(token).getSubject());
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
