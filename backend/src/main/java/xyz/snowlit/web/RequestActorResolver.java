package xyz.snowlit.web;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.auth.RequestIdentity;
import xyz.snowlit.failure.ApplicationFailure;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public final class RequestActorResolver implements HandlerInterceptor, HandlerMethodArgumentResolver {

    static final String ACTOR_ATTRIBUTE = RequestActorResolver.class.getName() + ".actor";

    private final RequestIdentity requestIdentity;

    public RequestActorResolver(RequestIdentity requestIdentity) {
        this.requestIdentity = requestIdentity;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String token = BearerToken.fromAuthorization(request.getHeader("Authorization"));
        requestIdentity.resolve(token).ifPresent(actor -> request.setAttribute(ACTOR_ATTRIBUTE, actor));
        return true;
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
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        AuthenticatedActor actor = request == null
                ? null
                : (AuthenticatedActor) request.getAttribute(ACTOR_ATTRIBUTE);
        CurrentActor currentActor = parameter.getParameterAnnotation(CurrentActor.class);
        if (actor == null && currentActor != null && currentActor.required()) {
            throw ApplicationFailure.unauthenticated("UNAUTHORIZED", "登录已过期，请重新登录");
        }
        return actor;
    }
}
