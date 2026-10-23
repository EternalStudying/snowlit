package xyz.snowlit.home;

import xyz.snowlit.text.Text;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.home.HomeDtos.HomeLocationUpdateDto;
import xyz.snowlit.album.AlbumModule;
import xyz.snowlit.diary.DiaryHighlight;
import xyz.snowlit.diary.DiaryModule;
import xyz.snowlit.messages.MessageModule;
import xyz.snowlit.wishes.WishModule;
import xyz.snowlit.wishes.WishTotals;
import xyz.snowlit.home.HomeVos.HomeAnniversaryVo;
import xyz.snowlit.home.HomeVos.HomeCoupleVo;
import xyz.snowlit.home.HomeVos.HomeDailyNoteVo;
import xyz.snowlit.home.HomeVos.HomeDistanceVo;
import xyz.snowlit.home.HomeVos.HomeLatestDiaryVo;
import xyz.snowlit.home.HomeVos.HomeLatestVo;
import xyz.snowlit.home.HomeVos.HomePersonStatusVo;
import xyz.snowlit.home.HomeVos.HomeStatsVo;
import xyz.snowlit.home.HomeVos.HomeVo;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.MonthDay;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public final class HomeModule {

    private static final String BOYFRIEND = "boyfriend";
    private static final String GIRLFRIEND = "girlfriend";
    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final int[] DAY_MILESTONES = {100, 520, 1000, 1314, 2000};
    private static final String[] NOTE_SENTENCES = {
            "心有所念，字字认真",
            "彼此留白，温柔相待",
            "今日小事，皆可入册",
            "纵然忙碌，偷偷想你",
            "晚风寄信，道声想你"
    };
    private static final String[] WEATHER_HINTS = {
            "适合一起听歌",
            "适合存一张照片",
            "适合慢慢散步",
            "适合分享晚风",
            "适合喝一杯热饮"
    };
    private static final String[] ACTIVITY_HINTS = {
            "留一张晚安小纸条",
            "补一件想一起完成的事",
            "挑一张今天的照片",
            "写下一个小小愿望",
            "约定下一次见面"
    };
    private static final String[] MOODS = {
            "专注模式",
            "心情很好",
            "有点想你",
            "元气恢复中",
            "温柔在线"
    };
    private static final String[] STATUS_NOTES = {
            "写代码中...",
            "正在处理一些小事",
            "想偷偷见你一面",
            "今天也在好好生活",
            "等一条晚安消息"
    };
    private static final Map<Integer, LocalDate> QIXI_DATES = Map.of(
            2026, LocalDate.of(2026, 8, 19),
            2027, LocalDate.of(2027, 8, 8),
            2028, LocalDate.of(2028, 8, 26),
            2029, LocalDate.of(2029, 8, 16),
            2030, LocalDate.of(2030, 8, 5),
            2031, LocalDate.of(2031, 8, 24),
            2032, LocalDate.of(2032, 8, 12)
    );

    private final HomeMapper homeMapper;
    private final MemberLocations memberLocations;
    private final DiaryModule diaries;
    private final AlbumModule albums;
    private final WishModule wishes;
    private final MessageModule messages;
    private final Clock clock;

    public HomeModule(
            HomeMapper homeMapper,
            MemberLocations memberLocations,
            DiaryModule diaries,
            AlbumModule albums,
            WishModule wishes,
            MessageModule messages,
            Clock clock
    ) {
        this.homeMapper = homeMapper;
        this.memberLocations = memberLocations;
        this.diaries = diaries;
        this.albums = albums;
        this.wishes = wishes;
        this.messages = messages;
        this.clock = clock;
    }

    public HomeVo getHome(AuthenticatedActor actor) {
        Couple couple = homeMapper.findCouple();
        if (couple == null) {
            throw ApplicationFailure.internal("HOME_COUPLE_MISSING", "情侣资料尚未配置");
        }

        LocalDate today = LocalDate.now(clock);
        HomeLocation boyfriendLocation = memberLocations.of(BOYFRIEND).orElse(null);
        HomeLocation girlfriendLocation = memberLocations.of(GIRLFRIEND).orElse(null);
        WishTotals wishTotals = wishes.totals();

        return new HomeVo(
                toCoupleVo(couple, today),
                createDailyNote(actor.userId(), today),
                List.of(
                        createPersonStatus(BOYFRIEND, couple.getPersonA(), boyfriendLocation, actor.userId(), today),
                        createPersonStatus(GIRLFRIEND, couple.getPersonB(), girlfriendLocation, actor.userId(), today)
                ),
                calculateDistance(boyfriendLocation, girlfriendLocation),
                createLatest(),
                new HomeStatsVo(albums.photoCount(), messages.count(), wishTotals.total(), wishTotals.completed())
        );
    }

    public void updateLocation(AuthenticatedActor actor, HomeLocationUpdateDto request) {
        validateLocation(request);

        HomeLocation location = new HomeLocation();
        location.setUserId(actor.userId());
        location.setRole(resolveRole(actor));
        location.setLatitude(request.latitude());
        location.setLongitude(request.longitude());
        location.setCity(Text.trimToNull(request.city()));
        location.setDistrict(Text.trimToNull(request.district()));
        location.setProvince(Text.trimToNull(request.province()));
        location.setCountry(Text.trimToNull(request.country()));
        location.setWeather(Text.trimToNull(request.weather()));
        location.setTemperature(request.temperature());
        location.setLastOnlineAt(LocalDateTime.now(clock));
        memberLocations.save(location);
    }

    private String resolveRole(AuthenticatedActor actor) {
        if (actor.coupleRole() == null) {
            throw ApplicationFailure.invalidInput("HOME_ROLE_NOT_CONFIGURED", "账号角色尚未配置");
        }
        return actor.coupleRole();
    }

    private HomeCoupleVo toCoupleVo(Couple couple, LocalDate today) {
        LocalDate startedAt = couple.getStartDate();
        return new HomeCoupleVo(
                couple.getPersonA(),
                couple.getPersonB(),
                startedAt,
                Math.max(1, ChronoUnit.DAYS.between(startedAt, today) + 1),
                calculateNextAnniversary(startedAt, today)
        );
    }

    private HomeAnniversaryVo calculateNextAnniversary(LocalDate startedAt, LocalDate today) {
        int currentYearOffset = Math.max(1, today.getYear() - startedAt.getYear());
        List<AnniversaryCandidate> candidates = new java.util.ArrayList<>();

        for (int offset = currentYearOffset; offset <= currentYearOffset + 6; offset += 1) {
            LocalDate date = startedAt.plusYears(offset);
            candidates.add(new AnniversaryCandidate(
                    "恋爱 " + offset + " 周年",
                    date,
                    "anniversary",
                    0
            ));
        }

        for (int milestone : DAY_MILESTONES) {
            candidates.add(new AnniversaryCandidate(
                    "恋爱 " + milestone + " 天",
                    startedAt.plusDays(milestone - 1L),
                    "dayMilestone",
                    1
            ));
        }

        for (int year = today.getYear(); year <= today.getYear() + 6; year += 1) {
            candidates.add(new AnniversaryCandidate("520", MonthDay.of(5, 20).atYear(year), "romanticDay", 2));
            LocalDate qixi = QIXI_DATES.get(year);
            if (qixi != null) {
                candidates.add(new AnniversaryCandidate("七夕", qixi, "qixi", 3));
            }
        }

        AnniversaryCandidate next = candidates.stream()
                .filter(candidate -> !candidate.date().isBefore(today))
                .min(Comparator.comparing(AnniversaryCandidate::date).thenComparingInt(AnniversaryCandidate::priority))
                .orElseGet(() -> new AnniversaryCandidate("520", MonthDay.of(5, 20).atYear(today.getYear() + 1), "romanticDay", 2));

        return new HomeAnniversaryVo(
                next.name(),
                next.date(),
                ChronoUnit.DAYS.between(today, next.date()),
                next.type()
        );
    }

    private HomeDailyNoteVo createDailyNote(Long userId, LocalDate today) {
        int seed = Objects.hash(userId, today);
        return new HomeDailyNoteVo(
                today,
                pick(NOTE_SENTENCES, seed),
                pick(WEATHER_HINTS, seed * 31),
                pick(ACTIVITY_HINTS, seed * 17)
        );
    }

    private HomePersonStatusVo createPersonStatus(String role, String name, HomeLocation location, Long userId, LocalDate today) {
        int seed = Objects.hash(userId, role, today);
        return new HomePersonStatusVo(
                role,
                name,
                Text.trim(location == null ? "" : location.getCity()),
                Text.trim(location == null ? "" : location.getDistrict()),
                Text.trim(location == null ? "" : location.getProvince()),
                Text.trim(location == null ? "" : location.getCountry()),
                Text.trim(location == null ? "" : location.getWeather()),
                location == null ? null : location.getTemperature(),
                pick(MOODS, seed),
                pick(STATUS_NOTES, seed * 13),
                location == null ? null : location.getLastOnlineAt()
        );
    }

    private HomeDistanceVo calculateDistance(HomeLocation boyfriendLocation, HomeLocation girlfriendLocation) {
        if (boyfriendLocation == null || girlfriendLocation == null) {
            return new HomeDistanceVo(null, "距离正在更新", "missingLocation", null);
        }

        double kilometers = haversine(
                boyfriendLocation.getLatitude(),
                boyfriendLocation.getLongitude(),
                girlfriendLocation.getLatitude(),
                girlfriendLocation.getLongitude()
        );
        double rounded = Math.round(kilometers * 10.0) / 10.0;
        LocalDateTime updatedAt = latestTime(boyfriendLocation.getLastOnlineAt(), girlfriendLocation.getLastOnlineAt());
        return new HomeDistanceVo(rounded, "相距 " + String.format(java.util.Locale.ROOT, "%.1f", rounded) + " 公里", "ready", updatedAt);
    }

    private HomeLatestVo createLatest() {
        return new HomeLatestVo(
                diaries.latestShared().map(HomeModule::toLatestDiaryVo).orElse(null),
                albums.latestPublicPhoto().orElse(null),
                wishes.latest().orElse(null),
                messages.latest().orElse(null)
        );
    }

    private static HomeLatestDiaryVo toLatestDiaryVo(DiaryHighlight diary) {
        return new HomeLatestDiaryVo(diary.id(), diary.title(), diary.entryDate(), diary.summary(), diary.moodKey());
    }

    private void validateLocation(HomeLocationUpdateDto request) {
        if (request.latitude() == null || request.longitude() == null) {
            throw ApplicationFailure.invalidInput(
                    "HOME_LOCATION_COORDINATES_REQUIRED",
                    "纬度和经度不能为空"
            );
        }
        if (!Double.isFinite(request.latitude()) || !Double.isFinite(request.longitude())) {
            throw ApplicationFailure.invalidInput(
                    "HOME_LOCATION_COORDINATES_INVALID",
                    "纬度和经度必须是有效数字"
            );
        }
        if (request.latitude() < -90 || request.latitude() > 90 || request.longitude() < -180 || request.longitude() > 180) {
            throw ApplicationFailure.invalidInput(
                    "HOME_LOCATION_COORDINATES_OUT_OF_RANGE",
                    "纬度或经度超出范围"
            );
        }
    }

    private double haversine(double latitudeA, double longitudeA, double latitudeB, double longitudeB) {
        double lat1 = Math.toRadians(latitudeA);
        double lat2 = Math.toRadians(latitudeB);
        double deltaLat = Math.toRadians(latitudeB - latitudeA);
        double deltaLon = Math.toRadians(longitudeB - longitudeA);
        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    private LocalDateTime latestTime(LocalDateTime left, LocalDateTime right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return left.isAfter(right) ? left : right;
    }

    private String pick(String[] values, int seed) {
        return values[Math.floorMod(seed, values.length)];
    }

    private record AnniversaryCandidate(String name, LocalDate date, String type, int priority) {
    }
}
