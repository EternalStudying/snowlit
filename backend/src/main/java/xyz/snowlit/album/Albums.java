package xyz.snowlit.album;

import xyz.snowlit.album.AlbumVos.AlbumPhotoVo;
import xyz.snowlit.album.AlbumVos.AlbumVo;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.text.Text;

import java.util.List;

/**
 * Album lookups and response mapping shared by the catalog, drafts and private access.
 */
final class Albums {

    private Albums() {
    }

    static Album require(AlbumMapper albumMapper, Long albumId) {
        Album album = albumMapper.findAlbumById(albumId);
        if (album == null) {
            throw ApplicationFailure.notFound("ALBUM_NOT_FOUND", "相册不存在");
        }
        return album;
    }

    static Album requirePublished(AlbumMapper albumMapper, Long albumId) {
        Album album = require(albumMapper, albumId);
        if (!"published".equals(album.getStatus())) {
            throw ApplicationFailure.notFound("ALBUM_NOT_FOUND", "相册不存在");
        }
        return album;
    }

    static boolean isPrivate(Album album) {
        return "private".equals(album.getVisibility());
    }

    static AlbumVo toAlbumVo(Album album, boolean locked, List<AlbumPhotoVo> previewPhotos, boolean likedToday) {
        if (locked) {
            return new AlbumVo(
                    album.getId(),
                    "锁定专辑",
                    "已锁定",
                    "/album-assets/private-locked-cover.png",
                    "",
                    album.getCreatedAt(),
                    album.getEventDate(),
                    "地球",
                    album.getPhotoCount(),
                    album.getViewCount(),
                    album.getLikeCount(),
                    likedToday,
                    album.getVisibility(),
                    true,
                    album.isPinned(),
                    album.getSortOrder(),
                    List.of()
            );
        }
        return new AlbumVo(
                album.getId(),
                album.getTitle(),
                album.getDescription(),
                album.getCoverPhotoUrl(),
                album.getAuthorName(),
                album.getCreatedAt(),
                album.getEventDate(),
                album.getLocation(),
                album.getPhotoCount(),
                album.getViewCount(),
                album.getLikeCount(),
                likedToday,
                album.getVisibility(),
                false,
                album.isPinned(),
                album.getSortOrder(),
                previewPhotos
        );
    }

    static AlbumPhotoVo toPhotoVo(AlbumPhoto photo) {
        return new AlbumPhotoVo(
                photo.getId(),
                photo.getAlbumId(),
                photo.getPreviewUrl(),
                Text.trim(photo.getOriginalUrl()),
                photo.getCaption(),
                photo.getDescription(),
                photo.getTakenAt(),
                photo.getLocation(),
                photo.getSortOrder(),
                photo.getWidth(),
                photo.getHeight()
        );
    }
}
