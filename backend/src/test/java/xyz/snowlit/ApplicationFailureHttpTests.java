package xyz.snowlit;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.web.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApplicationFailureHttpTests {

    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new FailureController())
            .setControllerAdvice(new ApiExceptionHandler())
            .build();

    @Test
    void webAdapterMapsTypedFailureToStableHttpContract() throws Exception {
        mockMvc.perform(get("/test/application-failure"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("STORY_FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("只有站点主人可以管理点滴"));
    }

    @Test
    void missingRequestBodyUsesStableHttpContract() throws Exception {
        mockMvc.perform(post("/test/body").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("REQUEST_BODY_INVALID"));
    }

    @RestController
    static class FailureController {

        @PostMapping("/test/body")
        void body(@RequestBody Map<String, Object> body) {
        }

        @GetMapping("/test/application-failure")
        void fail() {
            throw ApplicationFailure.forbidden("STORY_FORBIDDEN", "只有站点主人可以管理点滴");
        }
    }
}
