package xyz.snowlit.diary;

import xyz.snowlit.text.Text;
import xyz.snowlit.diary.DiaryDtos.DiaryCreateDto;
import xyz.snowlit.diary.DiaryDtos.DiaryUpdateDto;
import xyz.snowlit.diary.DiaryDtos.DiaryWeatherSnapshotDto;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.home.HomeLocation;
import xyz.snowlit.home.MemberLocations;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ImagePolicy;
import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.diary.DiaryVos.DiaryDetailVo;
import xyz.snowlit.diary.DiaryVos.DiaryImageUploadVo;
import xyz.snowlit.diary.DiaryVos.DiaryMonthListVo;
import xyz.snowlit.diary.DiaryVos.DiaryMonthStatVo;
import xyz.snowlit.diary.DiaryVos.DiaryMonthsVo;
import xyz.snowlit.diary.DiaryVos.DiarySummaryVo;
import xyz.snowlit.diary.DiaryVos.DiaryYearStatVo;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class DiaryModule {

    private static final Set<String> VISIBILITIES = Set.of("shared", "private");
    private static final Set<String> MOOD_KEYS = Set.of(
            "happy", "miss", "calm", "wronged", "expecting",
            "tired", "sweet", "secret", "angry", "touched"
    );
    private static final ImagePolicy IMAGE = ImagePolicy.standard("DIARY", "diary/tmp", false, "图片上传失败，请稍后重试");
    private static final int MAX_IMAGES_PER_DIARY = 20;
    private static final Map<String, String> ROLE_AVATARS = Map.of(
            "boyfriend", "/assets/home-avatars/partner-a.webp",
            "girlfriend", "/assets/home-avatars/partner-b.webp"
    );

    private final DiaryMapper diaryMapper;
    private final MemberLocations memberLocations;
    private final ImageIntake images;
    private final Clock clock;

    public DiaryModule(
            DiaryMapper diaryMapper,
            MemberLocations memberLocations,
            ImageIntake images,
            Clock clock
    ) {
        this.diaryMapper = diaryMapper;
        this.memberLocations = memberLocations;
        this.images = images;
        this.clock = clock;
    }

    public DiaryMonthsVo months(AuthenticatedActor actor, Integer year) {
        ActorContext user = context(actor);
        Integer targetYear = year == null ? null : validateYear(year);
        List<DiaryMonthCount> counts = diaryMapper.findVisibleMonthCounts(actor.userId(), user.role(), targetYear);
        Map<Integer, Map<Integer, Integer>> countsByYear = groupMonthCountsByYear(counts);
        List<Integer> years = targetYear == null
                ? new ArrayList<>(countsByYear.keySet())
                : new ArrayList<>(List.of(targetYear));
        if (years.isEmpty()) {
            years.add(LocalDate.now(clock).getYear());
        }
        years.sort(Comparator.reverseOrder());

        List<DiaryYearStatVo> yearStats = years.stream()
                .map(currentYear -> new DiaryYearStatVo(currentYear, monthsForYear(currentYear, countsByYear.getOrDefault(currentYear, Map.of()))))
                .toList();
        return new DiaryMonthsVo(yearStats);
    }

    public DiaryMonthListVo listByMonth(AuthenticatedActor actor, String month) {
        ActorContext user = context(actor);
        YearMonth yearMonth = parseMonth(month);
        List<DiaryEntry> diaries = diaryMapper.findVisibleEntriesByMonth(
                actor.userId(),
                user.role(),
                yearMonth.atDay(1),
                yearMonth.plusMonths(1).atDay(1)
        );
        Map<Long, List<String>> imageUrlsByDiaryId = findImageUrlsByDiaryId(diaries);
        List<DiarySummaryVo> items = diaries
                .stream()
                .map(diary -> toSummary(diary, imageUrlsByDiaryId.getOrDefault(diary.getId(), List.of())))
                .toList();
        return new DiaryMonthListVo(yearMonth.toString(), items);
    }

    public DiaryDetailVo getDetail(AuthenticatedActor actor, Long id) {
        ActorContext user = context(actor);
        DiaryEntry diary = requireExistingDiary(id);
        ensureVisible(diary, user);
        return toDetail(diary, diaryMapper.findImageUrlsByDiaryId(diary.getId()));
    }

    @Transactional
    public DiarySummaryVo create(AuthenticatedActor actor, DiaryCreateDto request) {
        ActorContext user = context(actor);
        validateCreateRequest(request);
        if (diaryMapper.existsActiveDiaryForRoleAndDate(user.role(), request.date(), null)) {
            throw ApplicationFailure.conflict("DIARY_DAY_ALREADY_EXISTS", "这一天已经写过日记啦");
        }

        DiaryMarkdown content = DiaryMarkdown.read(request.contentMarkdown());
        List<String> imageUrls = content.imageUrls();
        ImageReferencePlan imagePlan = planImageReferences(null, imageUrls, actor.userId());
        LocalDateTime now = now();
        DiaryEntry diary = new DiaryEntry();
        diary.setRole(user.role());
        diary.setAuthorUserId(actor.userId());
        diary.setAuthorName(actor.displayName());
        diary.setContentMarkdown(content.markdown());
        diary.setTitle(content.title());
        diary.setSummary(content.summary());
        diary.setVisibility(request.visibility().trim());
        diary.setMoodKey(request.moodKey().trim());
        diary.setEntryDate(request.date());
        applySnapshot(diary, request.weatherSnapshot(), user.role());
        diary.setCreatedAt(now);
        diary.setUpdatedAt(now);

        diaryMapper.insertDiary(diary);
        persistReferences(diary.getId(), imagePlan, now);
        return toSummary(diary, imageUrls);
    }

    @Transactional
    public DiaryDetailVo update(AuthenticatedActor actor, Long id, DiaryUpdateDto request) {
        ActorContext user = context(actor);
        DiaryEntry diary = requireExistingDiary(id);
        ensureVisible(diary, user);
        ensureAuthor(diary, actor);
        validateUpdateRequest(request);

        List<DiaryImage> previousImages = diaryMapper.findImagesReferencedByDiary(id);
        DiaryMarkdown content = DiaryMarkdown.read(request.contentMarkdown());
        List<String> imageUrls = content.imageUrls();
        ImageReferencePlan imagePlan = planImageReferences(id, imageUrls, actor.userId());
        LocalDateTime now = now();

        diary.setContentMarkdown(content.markdown());
        diary.setTitle(content.title());
        diary.setSummary(content.summary());
        diary.setMoodKey(request.moodKey().trim());
        diary.setVisibility(request.visibility().trim());
        diary.setUpdatedAt(now);
        diaryMapper.updateDiary(diary);
        persistReferences(id, imagePlan, now);
        cleanupUnreferencedImages(previousImages, now);
        return toDetail(diary, imageUrls);
    }

    @Transactional
    public void delete(AuthenticatedActor actor, Long id) {
        ActorContext user = context(actor);
        DiaryEntry diary = requireExistingDiary(id);
        ensureVisible(diary, user);
        ensureAuthor(diary, actor);
        List<DiaryImage> previousImages = diaryMapper.findImagesReferencedByDiary(id);
        LocalDateTime now = now();
        diaryMapper.softDeleteDiary(id, now);
        diaryMapper.replaceImageReferences(id, List.of());
        cleanupUnreferencedImages(previousImages, now);
    }

    public DiaryImageUploadVo uploadImage(AuthenticatedActor actor, MultipartFile file) {
        ObjectStore.StoredObject stored = images.store(file, IMAGE, actor.userId());
        LocalDateTime now = now();
        DiaryImage image = new DiaryImage();
        image.setUploaderUserId(actor.userId());
        image.setObjectName(stored.objectName());
        image.setUrl(stored.url());
        image.setContentType(stored.contentType());
        image.setSizeBytes(stored.sizeBytes());
        image.setTemporary(true);
        image.setCreatedAt(now);
        diaryMapper.insertImage(image);
        return new DiaryImageUploadVo(image.getId(), image.getUrl());
    }

    @Scheduled(cron = "0 30 * * * *")
    public void cleanupExpiredTemporaryImages() {
        LocalDateTime now = now();
        List<DiaryImage> expiredImages = diaryMapper.findExpiredTemporaryImages(now.minusHours(6));
        for (DiaryImage image : expiredImages) {
            if (diaryMapper.countActiveReferencesForUpload(image.getId()) > 0) {
                continue;
            }
            images.delete(image.getObjectName(), IMAGE);
            diaryMapper.markUploadDeleted(image.getId(), now);
        }
    }

    public Optional<DiaryHighlight> latestShared() {
        return Optional.ofNullable(diaryMapper.findLatestShared())
                .map(diary -> new DiaryHighlight(
                        diary.getId(), diary.getTitle(), diary.getEntryDate(), diary.getSummary(), diary.getMoodKey()));
    }

    private Map<Integer, Map<Integer, Integer>> groupMonthCountsByYear(List<DiaryMonthCount> counts) {
        Map<Integer, Map<Integer, Integer>> grouped = new LinkedHashMap<>();
        for (DiaryMonthCount count : counts) {
            grouped
                    .computeIfAbsent(count.getYear(), ignored -> new LinkedHashMap<>())
                    .put(count.getMonth(), count.getCount());
        }
        return grouped;
    }

    private List<DiaryMonthStatVo> monthsForYear(int year, Map<Integer, Integer> countsByMonth) {
        List<DiaryMonthStatVo> months = new ArrayList<>();
        for (int month = 1; month <= 12; month += 1) {
            YearMonth yearMonth = YearMonth.of(year, month);
            int count = countsByMonth.getOrDefault(month, 0);
            months.add(new DiaryMonthStatVo(yearMonth.toString(), count, count > 0));
        }
        return months;
    }

    private Map<Long, List<String>> findImageUrlsByDiaryId(List<DiaryEntry> diaries) {
        if (diaries.isEmpty()) {
            return Map.of();
        }
        List<Long> diaryIds = diaries.stream()
                .map(DiaryEntry::getId)
                .toList();
        Map<Long, List<String>> imageUrlsByDiaryId = new LinkedHashMap<>();
        for (DiaryImageReference reference : diaryMapper.findImageUrlsByDiaryIds(diaryIds)) {
            imageUrlsByDiaryId
                    .computeIfAbsent(reference.getDiaryId(), ignored -> new ArrayList<>())
                    .add(reference.getImageUrl());
        }
        return imageUrlsByDiaryId;
    }

    private ActorContext context(AuthenticatedActor actor) {
        return new ActorContext(actor.userId(), resolveRole(actor));
    }

    private String resolveRole(AuthenticatedActor actor) {
        if (actor.coupleRole() == null) {
            throw ApplicationFailure.invalidInput("DIARY_ROLE_NOT_CONFIGURED", "账号角色尚未配置");
        }
        return actor.coupleRole();
    }

    private DiaryEntry requireExistingDiary(Long id) {
        DiaryEntry diary = diaryMapper.findDiaryById(id);
        if (diary == null) {
            throw ApplicationFailure.notFound("DIARY_NOT_FOUND", "日记不存在");
        }
        if (diary.isDeleted()) {
            throw ApplicationFailure.gone("DIARY_DELETED", "日记已删除");
        }
        return diary;
    }

    private void ensureVisible(DiaryEntry diary, ActorContext user) {
        if ("private".equals(diary.getVisibility()) && !diary.getAuthorUserId().equals(user.actorId())) {
            throw ApplicationFailure.notFound("DIARY_NOT_FOUND", "日记不存在");
        }
    }

    private void ensureAuthor(DiaryEntry diary, AuthenticatedActor actor) {
        if (!diary.getAuthorUserId().equals(actor.userId())) {
            throw ApplicationFailure.forbidden("DIARY_FORBIDDEN", "只能修改自己的日记");
        }
    }

    private void validateCreateRequest(DiaryCreateDto request) {
        if (request.date() == null || Text.trim(request.contentMarkdown()).isEmpty()) {
            throw ApplicationFailure.invalidInput("DIARY_CONTENT_REQUIRED", "日记内容不能为空");
        }
        validateMood(request.moodKey());
        validateVisibility(request.visibility());
    }

    private void validateUpdateRequest(DiaryUpdateDto request) {
        if (Text.trim(request.contentMarkdown()).isEmpty()) {
            throw ApplicationFailure.invalidInput("DIARY_CONTENT_REQUIRED", "日记内容不能为空");
        }
        validateMood(request.moodKey());
        validateVisibility(request.visibility());
    }

    private void validateMood(String moodKey) {
        if (!MOOD_KEYS.contains(Text.trim(moodKey))) {
            throw ApplicationFailure.invalidInput("DIARY_MOOD_INVALID", "心情不正确");
        }
    }

    private void validateVisibility(String visibility) {
        if (!VISIBILITIES.contains(Text.trim(visibility))) {
            throw ApplicationFailure.invalidInput("DIARY_VISIBILITY_INVALID", "日记可见性不正确");
        }
    }

    private YearMonth parseMonth(String month) {
        try {
            return YearMonth.parse(month);
        } catch (RuntimeException ex) {
            throw ApplicationFailure.invalidInput("DIARY_MONTH_INVALID", "日记月份不正确");
        }
    }

    private int validateYear(int year) {
        if (year < 1970 || year > 2100) {
            throw ApplicationFailure.invalidInput("DIARY_YEAR_INVALID", "日记年份不正确");
        }
        return year;
    }

    private void applySnapshot(DiaryEntry diary, DiaryWeatherSnapshotDto snapshot, String role) {
        DiaryWeatherSnapshotDto resolved = snapshot;
        if (resolved == null) {
            Optional<HomeLocation> stored = memberLocations.of(role);
            if (stored.isPresent()) {
                HomeLocation location = stored.get();
                resolved = new DiaryWeatherSnapshotDto(
                        location.getWeather(),
                        location.getWeather(),
                        location.getTemperature(),
                        null,
                        null,
                        null,
                        location.getProvince(),
                        location.getCity(),
                        location.getDistrict(),
                        location.getDistrict(),
                        location.getLatitude(),
                        location.getLongitude()
                );
            }
        }
        if (resolved == null) {
            return;
        }
        diary.setWeather(Text.trimToNull(resolved.weather()));
        diary.setRawWeather(Text.trimToNull(resolved.rawWeather()));
        diary.setTemperature(resolved.temperature());
        diary.setWindDirection(Text.trimToNull(resolved.windDirection()));
        diary.setWindPower(Text.trimToNull(resolved.windPower()));
        diary.setHumidity(Text.trimToNull(resolved.humidity()));
        diary.setProvince(Text.trimToNull(resolved.province()));
        diary.setCity(Text.trimToNull(resolved.city()));
        diary.setDistrict(Text.trimToNull(resolved.district()));
        diary.setLocationName(Text.trimToNull(resolved.locationName()));
        diary.setLatitude(resolved.latitude());
        diary.setLongitude(resolved.longitude());
    }

    private ImageReferencePlan planImageReferences(Long currentDiaryId, List<String> urls, Long userId) {
        if (urls.size() > MAX_IMAGES_PER_DIARY) {
            throw ApplicationFailure.invalidInput("DIARY_IMAGE_LIMIT_EXCEEDED", "每篇日记最多 20 张图片");
        }
        List<DiaryImage> storedImages = urls.isEmpty() ? List.of() : diaryMapper.findImagesByUrls(urls);
        Map<String, DiaryImage> byUrl = new LinkedHashMap<>();
        storedImages.forEach(image -> byUrl.put(image.getUrl(), image));

        List<Long> permanentIds = new ArrayList<>();
        List<DiaryImageReference> references = new ArrayList<>();
        for (String url : urls) {
            DiaryImage image = byUrl.get(url);
            if (image == null) {
                throw ApplicationFailure.forbidden("DIARY_IMAGE_FORBIDDEN", "不能引用这张图片");
            }
            validateImageReference(image, userId);
            if (image.isTemporary()) {
                permanentIds.add(image.getId());
            }
            DiaryImageReference reference = new DiaryImageReference();
            reference.setDiaryId(currentDiaryId);
            reference.setUploadId(image.getId());
            reference.setImageUrl(url);
            reference.setCreatedAt(now());
            references.add(reference);
        }
        return new ImageReferencePlan(references, permanentIds);
    }

    private void validateImageReference(DiaryImage image, Long userId) {
        if (image.isDeleted()) {
            throw ApplicationFailure.forbidden("DIARY_IMAGE_FORBIDDEN", "不能引用这张图片");
        }
        if (image.isTemporary() && !image.getUploaderUserId().equals(userId)) {
            throw ApplicationFailure.forbidden("DIARY_IMAGE_FORBIDDEN", "不能引用这张图片");
        }
    }

    private void persistReferences(Long diaryId, ImageReferencePlan plan, LocalDateTime now) {
        if (!plan.permanentIds().isEmpty()) {
            diaryMapper.markImagesPermanent(plan.permanentIds(), now);
        }
        plan.references().forEach(reference -> reference.setDiaryId(diaryId));
        diaryMapper.replaceImageReferences(diaryId, plan.references());
    }

    private void cleanupUnreferencedImages(List<DiaryImage> previousImages, LocalDateTime now) {
        for (DiaryImage image : previousImages) {
            if (image.isDeleted() || diaryMapper.countActiveReferencesForUpload(image.getId()) > 0) {
                continue;
            }
            images.delete(image.getObjectName(), IMAGE);
            diaryMapper.markUploadDeleted(image.getId(), now);
        }
    }

    private DiarySummaryVo toSummary(DiaryEntry diary, List<String> imageUrls) {
        return new DiarySummaryVo(
                diary.getId(),
                diary.getRole(),
                diary.getAuthorName(),
                authorAvatar(diary.getRole()),
                diary.getTitle(),
                diary.getSummary(),
                imageUrls,
                diary.getEntryDate(),
                diary.getMoodKey(),
                diary.getLocationName(),
                diary.getWeather(),
                diary.getVisibility(),
                diary.getCreatedAt(),
                diary.getUpdatedAt()
        );
    }

    private DiaryDetailVo toDetail(DiaryEntry diary, List<String> imageUrls) {
        return new DiaryDetailVo(
                diary.getId(),
                diary.getRole(),
                diary.getAuthorName(),
                authorAvatar(diary.getRole()),
                diary.getContentMarkdown(),
                diary.getTitle(),
                diary.getSummary(),
                imageUrls,
                diary.getEntryDate(),
                diary.getMoodKey(),
                diary.getVisibility(),
                diary.getWeather(),
                diary.getRawWeather(),
                diary.getTemperature(),
                diary.getWindDirection(),
                diary.getWindPower(),
                diary.getHumidity(),
                diary.getProvince(),
                diary.getCity(),
                diary.getDistrict(),
                diary.getLocationName(),
                diary.getLatitude(),
                diary.getLongitude(),
                diary.getCreatedAt(),
                diary.getUpdatedAt()
        );
    }

    private String authorAvatar(String role) {
        return ROLE_AVATARS.getOrDefault(role, "");
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private record ActorContext(Long actorId, String role) {
    }

    private record ImageReferencePlan(List<DiaryImageReference> references, List<Long> permanentIds) {
    }
}
