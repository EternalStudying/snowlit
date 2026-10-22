package xyz.snowlit.album;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.album.AlbumDtos.AlbumUnlockDto;
import xyz.snowlit.album.AlbumVos.AlbumDetailVo;
import xyz.snowlit.album.AlbumVos.AlbumLikeVo;
import xyz.snowlit.album.AlbumVos.AlbumPageVo;
import xyz.snowlit.album.AlbumVos.AlbumUnlockVo;
import xyz.snowlit.album.AlbumVos.AlbumViewVo;
import xyz.snowlit.web.CurrentActor;
import xyz.snowlit.draft.DraftVos;
import xyz.snowlit.failure.ApplicationFailure;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/albums")
public final class AlbumController {

    private final AlbumModule albums;
    private final AlbumPrivateAccess privateAccess;
    private final AlbumEditor editor;
    private final ObjectMapper json;

    public AlbumController(
            AlbumModule albums,
            AlbumPrivateAccess privateAccess,
            AlbumEditor editor,
            ObjectMapper json
    ) {
        this.albums = albums;
        this.privateAccess = privateAccess;
        this.editor = editor;
        this.json = json;
    }

    @GetMapping
    public AlbumPageVo albums(@CurrentActor AuthenticatedActor actor,
                              @RequestParam(required = false) Integer page,
                              @RequestParam(required = false) Integer size,
                              @RequestParam(required = false) Integer previewLimit) {
        return albums.listAlbums(actor, page, size, previewLimit);
    }

    @GetMapping("/{albumId}")
    public AlbumDetailVo album(@CurrentActor AuthenticatedActor actor,
                               @PathVariable Long albumId,
                               @RequestHeader(value = "X-Album-Access-Token", required = false) String privateAccessToken) {
        return albums.getAlbumDetail(actor, albumId, privateAccessToken);
    }

    @PostMapping("/{albumId}/unlock")
    public AlbumUnlockVo unlock(@CurrentActor AuthenticatedActor actor,
                                @PathVariable Long albumId,
                                @RequestBody AlbumUnlockDto request) {
        return privateAccess.unlock(actor, albumId, request);
    }

    @PostMapping("/{albumId}/like")
    public AlbumLikeVo like(@CurrentActor AuthenticatedActor actor,
                            @PathVariable Long albumId) {
        return albums.likeAlbum(actor, albumId);
    }

    @PostMapping("/{albumId}/view")
    public AlbumViewVo view(@CurrentActor AuthenticatedActor actor,
                            @PathVariable Long albumId,
                            @RequestHeader(value = "X-Album-Access-Token", required = false) String privateAccessToken) {
        return albums.recordAlbumView(actor, albumId, privateAccessToken);
    }

    @PostMapping("/{albumId}/edit")
    public AlbumVos.AlbumEditVo startEdit(@CurrentActor AuthenticatedActor actor, @PathVariable Long albumId) {
        return editor.start(actor, albumId);
    }

    @PostMapping("/{albumId}/edit/photos")
    public DraftVos.DraftImageVo uploadEdit(@CurrentActor AuthenticatedActor actor, @PathVariable Long albumId,
                                          @RequestParam(required = false) MultipartFile file,
                                          @RequestParam(required = false) MultipartFile original,
                                          @RequestParam(required = false) MultipartFile preview,
                                          @RequestParam(required = false) String metadata) {
        JsonNode node = null;
        if (metadata != null) {
            try { node = json.readTree(metadata); }
            catch (Exception exception) { throw ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确"); }
        }
        return editor.upload(actor, albumId, file, original, preview, node);
    }

    @DeleteMapping("/{albumId}/edit/photos/{draftImageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeEditPhoto(@CurrentActor AuthenticatedActor actor, @PathVariable Long albumId, @PathVariable String draftImageId) {
        editor.remove(actor, albumId, draftImageId);
    }

    @DeleteMapping("/{albumId}/edit")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelEdit(@CurrentActor AuthenticatedActor actor, @PathVariable Long albumId) { editor.cancel(actor, albumId); }

    @PutMapping("/{albumId}")
    public AlbumDetailVo save(@CurrentActor AuthenticatedActor actor, @PathVariable Long albumId,
                               @RequestBody AlbumDtos.AlbumSaveDto request) { return editor.save(actor, albumId, request); }

    @DeleteMapping("/{albumId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAlbum(@CurrentActor AuthenticatedActor actor, @PathVariable Long albumId) { editor.delete(actor, albumId); }

}
