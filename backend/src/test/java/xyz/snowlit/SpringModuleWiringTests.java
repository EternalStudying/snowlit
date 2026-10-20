package xyz.snowlit;

import xyz.snowlit.album.AlbumPublisher;
import xyz.snowlit.album.AlbumModule;
import xyz.snowlit.album.AlbumPrivateAccess;
import xyz.snowlit.auth.AuthModule;
import xyz.snowlit.auth.AuthSessions;
import xyz.snowlit.diary.DiaryModule;
import xyz.snowlit.feedback.FeedbackModule;
import xyz.snowlit.home.HomeModule;
import xyz.snowlit.home.MemberLocations;
import xyz.snowlit.messages.MessageModule;
import xyz.snowlit.notices.NoticeModule;
import xyz.snowlit.storage.ImageIntake;
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
                WeatherModule.class, WishModule.class, ImageIntake.class, AuthSessions.class,
                AlbumPublisher.class, xyz.snowlit.draft.DraftModule.class, AlbumPrivateAccess.class, MemberLocations.class);
    }

    @ParameterizedTest
    @MethodSource("businessModules")
    void springCanConstructAndProxyBusinessModule(Class<?> module) {
        try (var context = new AnnotationConfigApplicationContext()) {
            // Mock only collaborators (including the shared Clock); Spring must select the real
            // constructor and create transaction proxies just as application startup does.
            var constructor = Arrays.stream(module.getConstructors()).findFirst().orElseThrow();
            Arrays.stream(constructor.getParameterTypes())
                    .filter(type -> type != String.class && type != Environment.class && type != PlatformTransactionManager.class)
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
