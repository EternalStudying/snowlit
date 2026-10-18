package xyz.snowlit.auth;

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
        if (token.isBlank() || !jwtService.isValid(token)) {
            return Optional.empty();
        }
        return Optional.ofNullable(userMapper.findById(jwtService.getUserId(token))).map(this::toActor);
    }

    private AuthenticatedActor toActor(User user) {
        return new AuthenticatedActor(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getBio(),
                user.getMood(),
                user.validCoupleRole()
        );
    }
}
