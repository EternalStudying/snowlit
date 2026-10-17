package xyz.snowlit.wishes;

import java.time.LocalDateTime;

public final class WishDtos {

    private WishDtos() {
    }

    public record WishCreateDto(
            String title,
            String category,
            String description,
            String locationName,
            LocalDateTime expectedCompletedAt,
            String note
    ) {
    }

    public record WishUpdateDto(
            String title,
            String category,
            String description,
            String locationName,
            LocalDateTime expectedCompletedAt,
            String note
    ) {
    }
}
