package xyz.snowlit.home;

import xyz.snowlit.album.PhotoHighlight;
import xyz.snowlit.messages.MessageHighlight;
import xyz.snowlit.wishes.WishVos.WishItemVo;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class HomeVos {

    private HomeVos() {
    }

    public record HomeAnniversaryVo(
            String name,
            LocalDate date,
            long daysUntil,
            String type
    ) {
    }

    public record HomeCoupleVo(
            String boyfriendName,
            String girlfriendName,
            LocalDate startedOn,
            long togetherDays,
            HomeAnniversaryVo nextAnniversary
    ) {
    }

    public record HomeDailyNoteVo(
            LocalDate date,
            String sentence,
            String weatherHint,
            String activityHint
    ) {
    }

    public record HomeDistanceVo(
            Double kilometers,
            String label,
            String status,
            LocalDateTime updatedAt
    ) {
    }

    public record HomeLatestDiaryVo(
            Long id,
            String title,
            LocalDate entryDate,
            String content,
            String tag
    ) {
    }

    public record HomeLatestVo(
            HomeLatestDiaryVo diary,
            PhotoHighlight photo,
            WishItemVo wish,
            MessageHighlight message
    ) {
    }

    public record HomePersonStatusVo(
            String role,
            String name,
            String city,
            String district,
            String province,
            String country,
            String weather,
            Double temperature,
            String mood,
            String note,
            LocalDateTime lastOnlineAt
    ) {
    }

    public record HomeStatsVo(
            long photoCount,
            long messageCount,
            long wishCount,
            long completedWishCount
    ) {
    }

    public record HomeVo(
            HomeCoupleVo couple,
            HomeDailyNoteVo dailyNote,
            List<HomePersonStatusVo> personStatuses,
            HomeDistanceVo distance,
            HomeLatestVo latest,
            HomeStatsVo stats
    ) {
    }

}
