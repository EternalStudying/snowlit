package xyz.snowlit.album;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.support.AuthenticatedRequestFixture;
import xyz.snowlit.web.ApiExceptionHandler;
import xyz.snowlit.album.AlbumVos.AlbumDetailVo;
import xyz.snowlit.album.AlbumVos.AlbumLikeVo;
import xyz.snowlit.album.AlbumVos.AlbumPageVo;
import xyz.snowlit.album.AlbumVos.AlbumPhotoVo;
import xyz.snowlit.album.AlbumVos.AlbumUnlockVo;
import xyz.snowlit.album.AlbumVos.AlbumViewVo;
import xyz.snowlit.album.AlbumVos.AlbumVo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AlbumControllerTests {

    private final AlbumModule albumService = mock(AlbumModule.class);
    private final AlbumPrivateAccess privateAccess = mock(AlbumPrivateAccess.class);
    private final AuthenticatedRequestFixture requests = new AuthenticatedRequestFixture();
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(
                    new AlbumController(albumService, privateAccess, mock(AlbumEditor.class), new ObjectMapper())
            )
            .setCustomArgumentResolvers(requests.actorResolver())
            .setControllerAdvice(new ApiExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(
                    Jackson2ObjectMapperBuilder.json()
                            .modules(new JavaTimeModule())
                            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                            .build()
            ))
            .build();

    @Test
    void albumsRequireJwt() throws Exception {
        mockMvc.perform(get("/api/albums"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listAlbumsReturnsPagedAlbumContract() throws Exception {
        when(albumService.listAlbums(
                any(AuthenticatedActor.class),
                eq(1),
                eq(5),
                eq(9)
        )).thenReturn(new AlbumPageVo(
                List.of(album(false, List.of(photo()))),
                6,
                1,
                5,
                true,
                true
        ));

        mockMvc.perform(get("/api/albums?page=1&size=5&previewLimit=9")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("见面出游"))
                .andExpect(jsonPath("$.items[0].previewPhotos[0].location").value("法国·尼斯"))
                .andExpect(jsonPath("$.items[0].previewPhotos[0].previewUrl").value("https://example.com/photo.jpg"))
                .andExpect(jsonPath("$.items[0].previewPhotos[0].originalUrl").value("https://example.com/original.jpg"))
                .andExpect(jsonPath("$.items[0].previewPhotos[0].url").doesNotExist())
                .andExpect(jsonPath("$.items[0].previewPhotos[0].thumbnailUrl").doesNotExist())
                .andExpect(jsonPath("$.items[0].likedToday").value(true))
                .andExpect(jsonPath("$.total").value(6))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.hasMore").value(true))
                .andExpect(jsonPath("$.canManage").value(true));
    }

    @Test
    void privateDetailPassesAlbumAccessTokenHeader() throws Exception {
        when(albumService.getAlbumDetail(
                any(AuthenticatedActor.class),
                eq(2L),
                eq("private-token")
        )).thenReturn(
                new AlbumDetailVo(album(false, List.of()), List.of(photo()), true)
        );

        mockMvc.perform(get("/api/albums/2")
                        .header("Authorization", requests.authorization())
                        .header("X-Album-Access-Token", "private-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.album.locked").value(false))
                .andExpect(jsonPath("$.photos[0].location").value("法国·尼斯"))
                .andExpect(jsonPath("$.photos[0].previewUrl").value("https://example.com/photo.jpg"))
                .andExpect(jsonPath("$.photos[0].originalUrl").value("https://example.com/original.jpg"))
                .andExpect(jsonPath("$.photos[0].url").doesNotExist())
                .andExpect(jsonPath("$.photos[0].thumbnailUrl").doesNotExist());

        verify(albumService).getAlbumDetail(
                any(AuthenticatedActor.class),
                eq(2L),
                eq("private-token")
        );
    }

    @Test
    void privateErrorsReturnCodeAndChineseMessage() throws Exception {
        when(albumService.getAlbumDetail(
                any(AuthenticatedActor.class),
                eq(2L),
                isNull()
        )).thenThrow(
                ApplicationFailure.forbidden("PRIVATE_ALBUM_LOCKED", "请输入私密相册密码")
        );

        mockMvc.perform(get("/api/albums/2")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PRIVATE_ALBUM_LOCKED"))
                .andExpect(jsonPath("$.message").value("请输入私密相册密码"));
    }

    @Test
    void unlockLikeAndViewReturnActionPayloads() throws Exception {
        when(privateAccess.unlock(any(AuthenticatedActor.class), eq(2L), any())).thenReturn(
                new AlbumUnlockVo("private-token", LocalDateTime.of(2026, 5, 16, 21, 0))
        );
        when(albumService.likeAlbum(any(AuthenticatedActor.class), eq(2L)))
                .thenReturn(new AlbumLikeVo(2L, 4, true));
        when(albumService.recordAlbumView(
                any(AuthenticatedActor.class),
                eq(2L),
                eq("private-token")
        )).thenReturn(new AlbumViewVo(2L, 8, true));

        mockMvc.perform(post("/api/albums/2/unlock")
                        .header("Authorization", requests.authorization())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"5201314\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.privateAccessToken").value("private-token"))
                .andExpect(jsonPath("$.expiresAt").value("2026-05-16T21:00:00"));

        mockMvc.perform(post("/api/albums/2/like")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.albumId").value(2))
                .andExpect(jsonPath("$.likeCount").value(4))
                .andExpect(jsonPath("$.likedToday").value(true));

        mockMvc.perform(post("/api/albums/2/view")
                        .header("Authorization", requests.authorization())
                        .header("X-Album-Access-Token", "private-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.albumId").value(2))
                .andExpect(jsonPath("$.viewCount").value(8))
                .andExpect(jsonPath("$.counted").value(true));
    }

    @Test
    void oldDraftEndpointsHaveNoMappings() throws Exception {
        mockMvc.perform(get("/api/albums/drafts/current")).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/albums")).andExpect(status().isMethodNotAllowed());
        for (String path : List.of("/api/albums/1/photos", "/api/albums/1/photos/mobile", "/api/albums/1/publish")) {
            mockMvc.perform(post(path)).andExpect(status().isNotFound());
        }
        mockMvc.perform(delete("/api/albums/1/draft")).andExpect(status().isNotFound());
    }

    @Test
    void editStartRouteExists() throws Exception {
        mockMvc.perform(post("/api/albums/1/edit")
                        .header("Authorization", requests.authorization()))
                .andExpect(status().isOk());
    }

    private AlbumVo album(boolean locked, List<AlbumPhotoVo> previewPhotos) {
        return new AlbumVo(
                1L,
                locked ? "锁定专辑" : "见面出游",
                locked ? "已锁定" : "把见面那几天的光都收好。",
                locked ? "/album-assets/private-locked-cover.png" : "/album-assets/meeting-cover.jpg",
                locked ? "" : "伴侣 B",
                LocalDateTime.of(2026, 5, 16, 20, 0),
                LocalDate.of(2026, 4, 16),
                locked ? "地球" : "法国·尼斯",
                14,
                21,
                0,
                true,
                locked ? "private" : "public",
                locked,
                true,
                10,
                previewPhotos
        );
    }

    private AlbumPhotoVo photo() {
        return new AlbumPhotoVo(
                101L,
                1L,
                "https://example.com/photo.jpg",
                "https://example.com/original.jpg",
                "海边日落",
                "傍晚的风很轻。",
                LocalDate.of(2026, 4, 16),
                "法国·尼斯",
                10,
                1600,
                1067
        );
    }

}
