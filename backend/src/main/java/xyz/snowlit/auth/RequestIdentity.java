package xyz.snowlit.auth;

import xyz.snowlit.auth.User;
import xyz.snowlit.auth.UserMapper;
import xyz.snowlit.auth.JwtService;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public final class RequestIdentity {

    private final JwtService jwtService;
    private final UserMapper userMapper;

    public RequestIdentity(JwtService jwtService, UserMapper userMapper) {
        this.jwtService = jwtService;
        this.userMapper = userMapper;
    }

    public Optional<AuthenticatedActor> resolve(String token) {
        if (token == null || token.isBlank() || !jwtService.isValid(token)) {
            return Optional.empty();
        }
        try {
            User user = userMapper.findById(jwtService.getUserId(token));
            return Optional.ofNullable(user).map(this::toActor);
        } catch (RuntimeException exception) {
            return Optional.empty();
        }
    }

    private AuthenticatedActor toActor(User user) {
        return new AuthenticatedActor(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getBio(),
                user.getMood()
        );
    }
}
