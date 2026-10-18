package xyz.snowlit.config;

import xyz.snowlit.web.RequestActorResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final RequestActorResolver requestActorResolver;

    public WebConfig(RequestActorResolver requestActorResolver) {
        this.requestActorResolver = requestActorResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(requestActorResolver);
    }
}
