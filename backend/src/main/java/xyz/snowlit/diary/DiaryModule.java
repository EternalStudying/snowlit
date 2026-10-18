package xyz.snowlit.diary;

import xyz.snowlit.text.Text;
import xyz.snowlit.diary.DiaryDtos.DiaryCreateDto;
import xyz.snowlit.diary.DiaryDtos.DiaryUpdateDto;
import xyz.snowlit.diary.DiaryDtos.DiaryWeatherSnapshotDto;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.home.HomeLocation;
import xyz.snowlit.home.HomeMapper;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DiaryModule {

    private static final Set<String> VISIBILITIES = Set.of("shared", "private");
    private static final Set<String> MOOD_KEYS = Set.of(
            "happy", "miss", "calm", "wronged", "expecting",
            "tired", "sweet", "secret", "angry", "touched"
    );
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> IMAGE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");
    private static final long MAX_IMAGE_SIZE = 10L * 1024L * 1024L;
    private static final int MAX_IMAGES_PER_DIARY = 20;
    private static final Pattern H1_PATTERN = Pattern.compile("(?m)^#\\s+(.+?)\\s*$");
    private static final Pattern MARKDOWN_IMAGE_PATTERN = Pattern.compile("!\\[[^\\]]*]\\(([^)\\s]+)(?:\\s+\"[^\"]*\")?\\)");
    private static final Pattern HTML_IMAGE_PATTERN = Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Map<String, String> ROLE_AVATARS = Map.of(
            "boyfriend", "/assets/home-avatars/partner-a.webp",
            "girlfriend", "/assets/home-avatars/partner-b.webp"
    );

    private final DiaryMapper diaryMapper;
    private final HomeMapper homeMapper;
    private final DiaryImages imageStorageService;
    private final Clock clock;

    @Autowired
    public DiaryModule(
            DiaryMapper diaryMapper,
            HomeMapper homeMapper,
            DiaryImages imageStorageService
    ) {
        this(diaryMapper, homeMapper, imageStorageService, Clock.systemDefaultZone());
    }

    DiaryModule(
            DiaryMapper diaryMapper,
            HomeMapper homeMapper,
            DiaryImages imageStorageService,
            Clock clock
    ) {
        this.diaryMapper = diaryMapper;
        this.homeMapper = homeMapper;
        this.imageStorageService = imageStorageService;
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

        String content = request.contentMarkdown().trim();
        List<String> imageUrls = extractImageUrls(content);
        ImageReferencePlan imagePlan = planImageReferences(null, imageUrls, actor.userId());
        LocalDateTime now = now();
        DiaryEntry diary = new DiaryEntry();
        diary.setRole(user.role());
        diary.setAuthorUserId(actor.userId());
        diary.setAuthorName(actor.displayName());
        diary.setContentMarkdown(content);
        diary.setTitle(extractTitle(content));
        diary.setSummary(extractSummary(content));
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
        String content = request.contentMarkdown().trim();
        List<String> imageUrls = extractImageUrls(content);
        ImageReferencePlan imagePlan = planImageReferences(id, imageUrls, actor.userId());
        LocalDateTime now = now();

        diary.setContentMarkdown(content);
        diary.setTitle(extractTitle(content));
        diary.setSummary(extractSummary(content));
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
        validateImage(file);
        ObjectStore.StoredObject stored = imageStorageService.uploadTemporary(file, actor.userId());
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
            imageStorageService.delete(image.getObjectName());
            diaryMapper.markUploadDeleted(image.getId(), now);
        }
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
            HomeLocation location = homeMapper.findLocationByRole(role);
            if (location != null) {
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

    private void cleanupUnreferencedImages(List<DiaryImage> images, LocalDateTime now) {
        for (DiaryImage image : images) {
            if (image.isDeleted() || diaryMapper.countActiveReferencesForUpload(image.getId()) > 0) {
                continue;
            }
            imageStorageService.delete(image.getObjectName());
            diaryMapper.markUploadDeleted(image.getId(), now);
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApplicationFailure.invalidInput("DIARY_IMAGE_TYPE_INVALID", "只支持 jpg、png、webp、gif 图片");
        }
        String contentType = Text.trim(file.getContentType()).toLowerCase();
        if (!IMAGE_TYPES.contains(contentType) && !hasAllowedExtension(file) && !hasImageSignature(file)) {
            throw ApplicationFailure.invalidInput("DIARY_IMAGE_TYPE_INVALID", "只支持 jpg、png、webp、gif 图片");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw ApplicationFailure.payloadTooLarge("DIARY_IMAGE_TOO_LARGE", "单张图片不能超过 10MB");
        }
    }

    private boolean hasAllowedExtension(MultipartFile file) {
        String filename = Text.trim(file.getOriginalFilename()).toLowerCase();
        return IMAGE_EXTENSIONS.stream().anyMatch(filename::endsWith);
    }

    private boolean hasImageSignature(MultipartFile file) {
        byte[] header = new byte[12];
        int length;
        try (InputStream input = file.getInputStream()) {
            length = input.read(header);
        } catch (IOException ex) {
            return false;
        }
        if (length < 4) {
            return false;
        }
        boolean jpeg = unsigned(header[0]) == 0xff && unsigned(header[1]) == 0xd8 && unsigned(header[2]) == 0xff;
        boolean png = unsigned(header[0]) == 0x89 && header[1] == 0x50 && header[2] == 0x4e && header[3] == 0x47;
        boolean gif = header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46;
        boolean webp = length >= 12
                && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
                && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50;
        return jpeg || png || gif || webp;
    }

    private int unsigned(byte value) {
        return value & 0xff;
    }

    private String extractTitle(String content) {
        Matcher matcher = H1_PATTERN.matcher(content);
        if (matcher.find()) {
            String title = cleanMarkdownText(matcher.group(1));
            if (!title.isEmpty()) {
                return truncate(title, 120);
            }
        }
        return "未命名日记";
    }

    private String extractSummary(String content) {
        String withoutImages = MARKDOWN_IMAGE_PATTERN.matcher(content).replaceAll("");
        withoutImages = withoutImages.replaceAll("(?m)^#\\s+.+$", "");
        String text = cleanMarkdownText(withoutImages);
        return truncate(text, 120);
    }

    private String cleanMarkdownText(String source) {
        return Text.trim(source)
                .replaceAll("<[^>]+>", "")
                .replaceAll("\\[[^\\]]+\\]\\([^)]+\\)", "")
                .replaceAll("[*_`~=>#-]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private List<String> extractImageUrls(String content) {
        Set<String> urls = new LinkedHashSet<>();
        Matcher markdown = MARKDOWN_IMAGE_PATTERN.matcher(content);
        while (markdown.find()) {
            urls.add(markdown.group(1));
        }
        Matcher html = HTML_IMAGE_PATTERN.matcher(content);
        while (html.find()) {
            urls.add(html.group(1));
        }
        return List.copyOf(urls);
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

    private String truncate(String value, int max) {
        String text = Text.trim(value);
        return text.length() <= max ? text : text.substring(0, max);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private record ActorContext(Long actorId, String role) {
    }

    private record ImageReferencePlan(List<DiaryImageReference> references, List<Long> permanentIds) {
    }
}
