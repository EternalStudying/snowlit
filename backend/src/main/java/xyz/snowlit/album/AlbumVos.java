package xyz.snowlit.album;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AlbumVos {

    private AlbumVos() {
    }

    public record AlbumCurrentDraftVo(
            AlbumDraftVo draft
    ) {
    }

    public record AlbumDetailVo(
            AlbumVo album,
            List<AlbumPhotoVo> photos
    ) {
    }

    public record AlbumDraftVo(
            AlbumVo album,
            List<AlbumPhotoVo> photos
    ) {
    }

    public record AlbumLikeVo(
            Long albumId,
            long likeCount,
            boolean likedToday
    ) {
    }

    public record AlbumPageVo(
            List<AlbumVo> items,
            long total,
            int page,
            int size,
            boolean hasMore,
            boolean canManage
    ) {
    }

    public record AlbumPhotoVo(
            Long id,
            Long albumId,
            String previewUrl,
            String originalUrl,
            String caption,
            String description,
            LocalDate takenAt,
            String location,
            int sortOrder,
            int width,
            int height
    ) {
    }

    public record AlbumUnlockVo(
            String privateAccessToken,
            LocalDateTime expiresAt
    ) {
    }

    public record AlbumViewVo(
            Long albumId,
            long viewCount,
            boolean counted
    ) {
    }

    public record AlbumVo(
            Long id,
            String title,
            String description,
            String coverPhotoUrl,
            String authorName,
            LocalDateTime createdAt,
            LocalDate eventDate,
            String location,
            int photoCount,
            long viewCount,
            long likeCount,
            boolean likedToday,
            String visibility,
            boolean locked,
            boolean pinned,
            int sortOrder,
            List<AlbumPhotoVo> previewPhotos
    ) {
    }
}
