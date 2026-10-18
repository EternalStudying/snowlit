package xyz.snowlit.web;

import xyz.snowlit.auth.AuthSessions;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * Supplies {@link CurrentActor} parameters from the bearer token. A handler requires login exactly when it
 * declares a required {@code @CurrentActor}; this is the only authentication rule for the HTTP API.
 */
@Component
public final class RequestActorResolver implements HandlerMethodArgumentResolver {

    private final AuthSessions sessions;

    public RequestActorResolver(AuthSessions sessions) {
        this.sessions = sessions;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentActor.class)
                && AuthenticatedActor.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
    ) {
        String token = BearerToken.fromAuthorization(webRequest.getHeader("Authorization"));
        AuthenticatedActor actor = sessions.resolve(token).orElse(null);
        if (actor == null && parameter.getParameterAnnotation(CurrentActor.class).required()) {
            throw ApplicationFailure.unauthenticated("UNAUTHORIZED", "登录已过期，请重新登录");
        }
        return actor;
    }
}
