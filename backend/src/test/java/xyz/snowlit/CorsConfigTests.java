package xyz.snowlit;

import xyz.snowlit.config.CorsConfig;
import xyz.snowlit.auth.AuthController;
import xyz.snowlit.auth.AuthModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mock.web.MockServletContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CorsConfigTests {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AnnotationConfigWebApplicationContext context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(AuthController.class, CorsConfig.class, TestConfig.class);
        context.refresh();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void allowsViteFromLocalhostAndLoopback() throws Exception {
        assertCorsAllowed("http://localhost:5173", "POST");
        assertCorsAllowed("http://127.0.0.1:5173", "POST");
        assertCorsAllowed("http://localhost:5178", "POST");
        assertCorsAllowed("http://127.0.0.1:5178", "POST");
    }

    @Test
    void allowsProductionDomain() throws Exception {
        assertCorsAllowed("https://snowlit.xyz", "POST");
        assertCorsAllowed("https://www.snowlit.xyz", "POST");
    }

    @Test
    void allowsBrowserDeleteRequestsThroughViteProxy() throws Exception {
        assertCorsAllowed("http://127.0.0.1:5173", "DELETE");
    }

    private void assertCorsAllowed(String origin, String method) throws Exception {
        mockMvc.perform(options("/api/auth/me")
                        .header("Origin", origin)
                        .header("Access-Control-Request-Method", method))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin));
    }

    @Configuration
    @EnableWebMvc
    static class TestConfig {

        @Bean
        AuthModule authModule() {
            return mock(AuthModule.class);
        }
    }
}
