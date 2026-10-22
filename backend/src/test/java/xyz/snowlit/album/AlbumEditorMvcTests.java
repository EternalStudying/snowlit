package xyz.snowlit.album;

import com.fasterxml.jackson.databind.ObjectMapper;
import xyz.snowlit.auth.User;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AlbumEditorMvcTests {
    @Test void everyNewEndpointRequiresManagerBeforeLoadingAnyAlbumOrDraft() throws Exception {
        var requests = new AuthenticatedRequestFixture(new User(3L,"member","Member","fixture-only"));
        var mapper = mock(AlbumMapper.class);
        var editor = new AlbumEditor(mapper,null,null,null,null);
        var mvc = MockMvcBuilders.standaloneSetup(new AlbumController(mock(AlbumModule.class),mock(AlbumPrivateAccess.class),editor,new ObjectMapper()))
                .setCustomArgumentResolvers(requests.actorResolver()).setControllerAdvice(new ApiExceptionHandler()).build();
        for (var request : java.util.List.of(post("/api/albums/1/edit"),multipart("/api/albums/1/edit/photos"),
                delete("/api/albums/1/edit/photos/image"),delete("/api/albums/1/edit"),
                put("/api/albums/1").contentType(MediaType.APPLICATION_JSON).content("{\"photos\":[]}"),delete("/api/albums/1"))) {
            mvc.perform(request.header("Authorization",requests.authorization())).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ALBUM_FORBIDDEN"));
        }
        verifyNoInteractions(mapper);
    }
}
