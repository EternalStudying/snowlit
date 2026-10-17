package xyz.snowlit.album;

import java.time.LocalDate;

public final class AlbumDtos {

    private AlbumDtos() {
    }

    public record AlbumCreateDto(
            String title,
            String description,
            LocalDate eventDate,
            String location,
            String visibility,
            String privatePassword,
            Boolean pinned
    ) {
    }

    public record AlbumPhotoMetadataDto(
            String caption,
            LocalDate takenAt,
            String location,
            Integer width,
            Integer height,
            Integer sortOrder
    ) {
    }

    public record AlbumUnlockDto(String password) {
    }
}
