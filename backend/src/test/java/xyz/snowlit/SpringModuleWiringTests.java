package xyz.snowlit;

import xyz.snowlit.album.AlbumModule;
import xyz.snowlit.auth.AuthModule;
import xyz.snowlit.diary.DiaryModule;
import xyz.snowlit.feedback.FeedbackModule;
import xyz.snowlit.home.HomeModule;
import xyz.snowlit.messages.MessageModule;
import xyz.snowlit.notices.NoticeModule;
import xyz.snowlit.story.StoryModule;
import xyz.snowlit.weather.WeatherModule;
import xyz.snowlit.wishes.WishModule;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import java.time.Clock;
import java.util.Arrays;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class SpringModuleWiringTests {

    static Stream<Class<?>> businessModules() {
        return Stream.of(AlbumModule.class, AuthModule.class, DiaryModule.class, FeedbackModule.class,
                HomeModule.class, MessageModule.class, NoticeModule.class, StoryModule.class,
                WeatherModule.class, WishModule.class);
    }

    @ParameterizedTest
    @MethodSource("businessModules")
    void springCanConstructAndProxyBusinessModule(Class<?> module) {
        try (var context = new AnnotationConfigApplicationContext()) {
            // Mock only external collaborators; Spring must select the real constructor
            // and create transaction proxies just as application startup does.
            var constructor = Arrays.stream(module.getConstructors())
                    .filter(candidate -> Arrays.stream(candidate.getParameterTypes()).noneMatch(type -> type == Clock.class))
                    .findFirst().orElseThrow();
            Arrays.stream(constructor.getParameterTypes())
                    .filter(type -> type != String.class && type != Environment.class)
                    .distinct()
                    .forEach(type -> context.getBeanFactory().registerSingleton(type.getName(), mock(type)));
            context.register(TransactionConfiguration.class, module);
            context.refresh();

            assertThat(context.getBean(module)).isInstanceOf(module);
        }
    }

    @Configuration(proxyBeanMethods = false)
    @EnableTransactionManagement(proxyTargetClass = true)
    static class TransactionConfiguration {
        @Bean
        PlatformTransactionManager transactionManager() {
            return mock(PlatformTransactionManager.class);
        }
    }
}
