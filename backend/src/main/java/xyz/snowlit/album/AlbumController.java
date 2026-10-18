package xyz.snowlit.album;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.album.AlbumDtos.AlbumCreateDto;
import xyz.snowlit.album.AlbumDtos.AlbumPhotoMetadataDto;
import xyz.snowlit.album.AlbumDtos.AlbumUnlockDto;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.album.AlbumVos.AlbumCurrentDraftVo;
import xyz.snowlit.album.AlbumVos.AlbumDetailVo;
import xyz.snowlit.album.AlbumVos.AlbumDraftVo;
import xyz.snowlit.album.AlbumVos.AlbumLikeVo;
import xyz.snowlit.album.AlbumVos.AlbumPageVo;
import xyz.snowlit.album.AlbumVos.AlbumPhotoVo;
import xyz.snowlit.album.AlbumVos.AlbumUnlockVo;
import xyz.snowlit.album.AlbumVos.AlbumViewVo;
import xyz.snowlit.web.CurrentActor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/albums")
public final class AlbumController {

    private final AlbumModule albums;
    private final AlbumDrafts drafts;
    private final AlbumPrivateAccess privateAccess;
    private final ObjectMapper objectMapper;

    public AlbumController(
            AlbumModule albums,
            AlbumDrafts drafts,
            AlbumPrivateAccess privateAccess,
            ObjectMapper objectMapper
    ) {
        this.albums = albums;
        this.drafts = drafts;
        this.privateAccess = privateAccess;
        this.objectMapper = objectMapper;
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

    @GetMapping("/drafts/current")
    public AlbumCurrentDraftVo currentDraft(@CurrentActor AuthenticatedActor actor) {
        return drafts.currentDraft(actor);
    }

    @PostMapping
    public AlbumDraftVo createDraft(@CurrentActor AuthenticatedActor actor,
                                    @RequestBody AlbumCreateDto request) {
        return drafts.createDraft(actor, request);
    }

    @PostMapping("/{albumId}/photos")
    public AlbumPhotoVo uploadPhoto(@CurrentActor AuthenticatedActor actor,
                                    @PathVariable Long albumId,
                                    @RequestParam("original") MultipartFile original,
                                    @RequestParam("preview") MultipartFile preview,
                                    @RequestParam("metadata") String metadataJson) {
        AlbumPhotoMetadataDto metadata;
        try {
            metadata = objectMapper.readValue(metadataJson, AlbumPhotoMetadataDto.class);
        } catch (Exception ex) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确");
        }
        return drafts.uploadPhoto(actor, albumId, original, preview, metadata);
    }

    @PostMapping("/{albumId}/photos/mobile")
    public AlbumPhotoVo uploadMobilePhoto(@CurrentActor AuthenticatedActor actor,
                                          @PathVariable Long albumId,
                                          @RequestParam("file") MultipartFile file,
                                          @RequestParam("metadata") String metadataJson) {
        AlbumPhotoMetadataDto metadata;
        try {
            metadata = objectMapper.readValue(metadataJson, AlbumPhotoMetadataDto.class);
        } catch (Exception ex) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确");
        }
        return drafts.uploadMobilePhoto(actor, albumId, file, metadata);
    }

    @PostMapping("/{albumId}/publish")
    public AlbumDraftVo publish(@CurrentActor AuthenticatedActor actor,
                                @PathVariable Long albumId) {
        return drafts.publish(actor, albumId);
    }

    @DeleteMapping("/{albumId}/draft")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelDraft(@CurrentActor AuthenticatedActor actor,
                            @PathVariable Long albumId) {
        drafts.discard(actor, albumId);
    }
}
