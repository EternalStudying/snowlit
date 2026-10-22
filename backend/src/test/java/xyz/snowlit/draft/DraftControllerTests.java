package xyz.snowlit.draft;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.LocalDateTime;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DraftControllerTests {
    final DraftModule drafts = mock(DraftModule.class);
    final ObjectMapper json = new ObjectMapper().findAndRegisterModules().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    final MockMvc mvc = MockMvcBuilders.standaloneSetup(new DraftController(drafts, json))
            .setCustomArgumentResolvers(requests.actorResolver()).setControllerAdvice(new ApiExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(json)).build();

    @Test void signedInMemberAndKnownKindRequired() throws Exception {
        mvc.perform(get("/api/drafts/album")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/drafts/other").header("Authorization", requests.authorization()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("DRAFT_KIND_INVALID"));
    }
    @Test void internalKindsAndNonAlbumReorderingReturn404() throws Exception {
        for (String path : List.of("album_edit","album-edit")) {
            for (var request : List.of(get("/api/drafts/"+path),put("/api/drafts/"+path).contentType(MediaType.APPLICATION_JSON).content("{\"fields\":{}}"),delete("/api/drafts/"+path))) {
                mvc.perform(request.header("Authorization",requests.authorization())).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("DRAFT_KIND_INVALID"));
            }
        }
        mvc.perform(put("/api/drafts/diary/images/order").header("Authorization",requests.authorization()).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[]}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("DRAFT_KIND_INVALID"));
        mvc.perform(put("/api/drafts/album/images/order").header("Authorization",requests.authorization()).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"b\",\"a\"]}"))
                .andExpect(status().isOk());
        verify(drafts).reorder(any(),eq(List.of("b","a")));
    }
    @Test void draftPathsAndPayloads() throws Exception {
        var fields = json.readTree("{\"title\":\"Weekend\"}");
        var saved = new DraftVos.DraftVo("album", fields, List.of(), LocalDateTime.of(2026,5,20,12,0), LocalDateTime.of(2026,5,20,12,0));
        when(drafts.current(any(), eq(DraftKind.ALBUM))).thenReturn(new DraftVos.CurrentDraftVo(null));
        mvc.perform(get("/api/drafts/album").header("Authorization", requests.authorization())).andExpect(status().isOk()).andExpect(content().json("{\"draft\":null}"));
        when(drafts.save(any(), eq(DraftKind.ALBUM), eq(fields))).thenReturn(saved);
        mvc.perform(put("/api/drafts/album").header("Authorization", requests.authorization()).contentType(MediaType.APPLICATION_JSON).content("{\"fields\":{\"title\":\"Weekend\"}}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fields.title").value("Weekend")).andExpect(jsonPath("$.images").isEmpty());
        mvc.perform(delete("/api/drafts/album").header("Authorization", requests.authorization())).andExpect(status().isNoContent());
        mvc.perform(delete("/api/drafts/album/images/opaque").header("Authorization", requests.authorization())).andExpect(status().isNoContent());
        verify(drafts).removeImage(any(AuthenticatedActor.class), eq(DraftKind.ALBUM), eq("opaque"));
        mvc.perform(post("/api/drafts/album/publish").header("Authorization", requests.authorization()).contentType(MediaType.APPLICATION_JSON).content("{\"fields\":{\"title\":\"Weekend\"},\"privatePassword\":\"test\"}"))
                .andExpect(status().isOk());
        verify(drafts).publish(any(), eq(DraftKind.ALBUM), argThat(request -> request.fields().equals(fields) && request.privatePassword().equals("test")));
    }
    @Test void uploadAcceptsMobileAndWebParts() throws Exception {
        mvc.perform(multipart("/api/drafts/album/images").file("file", new byte[]{1}).param("metadata", "{\"width\":1,\"height\":1}").header("Authorization", requests.authorization())).andExpect(status().isOk());
        verify(drafts).upload(any(), eq(DraftKind.ALBUM), argThat(file -> file.getSize()==1), isNull(), isNull(), argThat(node -> node.path("width").asInt()==1));
        mvc.perform(multipart("/api/drafts/album/images").file("original", new byte[]{1}).file("preview", new byte[]{2}).param("metadata", "{}").header("Authorization", requests.authorization())).andExpect(status().isOk());
        verify(drafts).upload(any(), eq(DraftKind.ALBUM), isNull(), notNull(), notNull(), any());
    }
}
