package xyz.snowlit.config;

import xyz.snowlit.web.AuthenticationRequiredInterceptor;
import xyz.snowlit.web.RequestActorResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final RequestActorResolver requestActorResolver;
    private final AuthenticationRequiredInterceptor authenticationRequiredInterceptor;

    public WebConfig(
            RequestActorResolver requestActorResolver,
            AuthenticationRequiredInterceptor authenticationRequiredInterceptor
    ) {
        this.requestActorResolver = requestActorResolver;
        this.authenticationRequiredInterceptor = authenticationRequiredInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(requestActorResolver)
                .addPathPatterns("/api/**");
        registry.addInterceptor(authenticationRequiredInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/login",
                        "/api/auth/wechat-login",
                        "/api/auth/wechat-bind-login",
                        "/api/auth/logout",
                        "/api/story/moments",
                        "/api/story/moments/**"
                );
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(requestActorResolver);
    }
}
