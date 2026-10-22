package xyz.snowlit.album;

import java.time.LocalDate;
import java.util.List;

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

    public record AlbumPhotoEntryDto(Long photoId, String draftImageId) {}
    public record AlbumSaveDto(String title, String description, LocalDate eventDate, String location,
                               String visibility, String privatePassword, Boolean pinned, List<AlbumPhotoEntryDto> photos) {
        AlbumCreateDto fields() { return new AlbumCreateDto(title, description, eventDate, location, visibility, privatePassword, pinned); }
    }

    public record AlbumUnlockDto(String password) {
    }
}
