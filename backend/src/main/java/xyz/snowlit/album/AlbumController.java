package xyz.snowlit.album;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.album.AlbumDtos.AlbumUnlockDto;
import xyz.snowlit.album.AlbumVos.AlbumDetailVo;
import xyz.snowlit.album.AlbumVos.AlbumLikeVo;
import xyz.snowlit.album.AlbumVos.AlbumPageVo;
import xyz.snowlit.album.AlbumVos.AlbumUnlockVo;
import xyz.snowlit.album.AlbumVos.AlbumViewVo;
import xyz.snowlit.web.CurrentActor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/albums")
public final class AlbumController {

    private final AlbumModule albums;
    private final AlbumPrivateAccess privateAccess;

    public AlbumController(
            AlbumModule albums,
            AlbumPrivateAccess privateAccess
    ) {
        this.albums = albums;
        this.privateAccess = privateAccess;
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

}
