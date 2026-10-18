package xyz.snowlit.support;

import xyz.snowlit.auth.AuthSessions;
import xyz.snowlit.auth.User;
import xyz.snowlit.web.AuthenticationRequiredInterceptor;
import xyz.snowlit.web.RequestActorResolver;

public final class AuthenticatedRequestFixture {

    private final RequestActorResolver actorResolver;
    private final String token;

    public AuthenticatedRequestFixture() {
        this(memberA());
    }

    public AuthenticatedRequestFixture(User user) {
        AuthSessions sessions = new AuthSessions(new InMemoryAuthSessionStore(), new SingleUserMapper(user));
        this.actorResolver = new RequestActorResolver(sessions);
        this.token = sessions.issue(user);
    }

    private static User memberA() {
        User user = new User(1L, "member_a", "伴侣 A", "secret");
        user.setCoupleRole("boyfriend");
        return user;
    }

    public RequestActorResolver actorResolver() {
        return actorResolver;
    }

    public AuthenticationRequiredInterceptor authenticationRequired() {
        return new AuthenticationRequiredInterceptor();
    }

    public String authorization() {
        return "Bearer " + token;
    }
}
