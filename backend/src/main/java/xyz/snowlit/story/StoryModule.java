package xyz.snowlit.story;

import xyz.snowlit.text.Text;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.storage.ImagePolicy;
import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.story.StoryDtos.StoryMomentUpsertDto;
import xyz.snowlit.story.StoryVos.StoryImageUploadVo;
import xyz.snowlit.story.StoryVos.StoryMomentListVo;
import xyz.snowlit.story.StoryVos.StoryMomentVo;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public final class StoryModule {

    private static final Set<String> CATEGORIES = Set.of("daily", "date", "travel", "anniversary", "surprise");
    public static final ImagePolicy IMAGE = ImagePolicy.standard("STORY", "story", true, "图片上传失败，请稍后重试");
    private static final int MAX_IMAGES = 3;

    private final StoryMapper storyMapper;
    private final ImageIntake images;
    private final Clock clock;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public StoryModule(StoryMapper storyMapper, ImageIntake images, Clock clock) {
        this.storyMapper = storyMapper;
        this.images = images;
        this.clock = clock;
    }

    public StoryMomentListVo listMoments(AuthenticatedActor actor, String category, Integer year) {
        String resolvedCategory = Text.trimToNull(category);
        if (resolvedCategory != null && !CATEGORIES.contains(resolvedCategory)) {
            throw ApplicationFailure.invalidInput("STORY_CATEGORY_INVALID", "点滴类型不正确");
        }
        Integer resolvedYear = validateOptionalYear(year);
        List<StoryMomentVo> items = storyMapper.findMoments(resolvedCategory, resolvedYear)
                .stream()
                .map(this::toVo)
                .toList();
        return new StoryMomentListVo(items, storyMapper.findAvailableYears(), canManage(actor));
    }

    public StoryMomentVo getMoment(Long id) {
        StoryMoment moment = requireActiveMoment(id);
        return toVo(moment);
    }

    public StoryMomentVo create(AuthenticatedActor actor, StoryMomentUpsertDto request) {
        requireManager(actor);
        List<String> images = validateRequest(request);
        LocalDateTime now = now();
        StoryMoment moment = new StoryMoment();
        applyRequest(moment, request, images);
        moment.setCreatedByUserId(actor.userId());
        moment.setCreatedAt(now);
        moment.setUpdatedAt(now);
        storyMapper.insertMoment(moment);
        return toVo(moment);
    }

    public StoryMomentVo createFromDraft(AuthenticatedActor actor, StoryMomentUpsertDto request) {
        return create(actor, request);
    }

    public StoryMomentVo update(AuthenticatedActor actor, Long id, StoryMomentUpsertDto request) {
        requireManager(actor);
        StoryMoment moment = requireActiveMoment(id);
        List<String> images = validateRequest(request);
        applyRequest(moment, request, images);
        moment.setUpdatedAt(now());
        storyMapper.updateMoment(moment);
        return toVo(moment);
    }

    public void delete(AuthenticatedActor actor, Long id) {
        requireManager(actor);
        requireActiveMoment(id);
        storyMapper.softDeleteMoment(id, now());
    }

    public StoryImageUploadVo uploadImage(AuthenticatedActor actor, MultipartFile file) {
        requireManager(actor);
        ObjectStore.StoredObject stored = images.store(file, IMAGE, actor.userId());
        return new StoryImageUploadVo(stored.url());
    }

    private void applyRequest(StoryMoment moment, StoryMomentUpsertDto request, List<String> images) {
        moment.setTitle(Text.trim(request.title()));
        moment.setContent(Text.trim(request.content()));
        moment.setEventTime(request.eventTime());
        moment.setEndTime(request.endTime());
        moment.setLocationName(Text.trim(request.locationName()));
        moment.setAddress(Text.trimToNull(request.address()));
        moment.setLongitude(request.longitude());
        moment.setLatitude(request.latitude());
        moment.setCategory(Text.trim(request.category()));
        moment.setImagesJson(toJson(images));
    }

    private List<String> validateRequest(StoryMomentUpsertDto request) {
        if (Text.trim(request.title()).isBlank()) {
            throw ApplicationFailure.invalidInput("STORY_TITLE_REQUIRED", "点滴标题不能为空");
        }
        if (request.eventTime() == null) {
            throw ApplicationFailure.invalidInput("STORY_EVENT_TIME_REQUIRED", "点滴时间不能为空");
        }
        if (Text.trim(request.locationName()).isBlank()) {
            throw ApplicationFailure.invalidInput("STORY_LOCATION_REQUIRED", "点滴地点不能为空");
        }
        if (request.longitude() == null || request.latitude() == null) {
            throw ApplicationFailure.invalidInput("STORY_COORDINATE_REQUIRED", "点滴坐标不能为空");
        }
        if (!CATEGORIES.contains(Text.trim(request.category()))) {
            throw ApplicationFailure.invalidInput("STORY_CATEGORY_INVALID", "点滴类型不正确");
        }
        return sanitizeImages(request.images());
    }

    private List<String> sanitizeImages(List<String> images) {
        if (images == null) {
            return List.of();
        }
        LinkedHashSet<String> sanitized = new LinkedHashSet<>();
        for (String image : images) {
            String cleaned = Text.trim(image);
            if (!cleaned.isBlank()) {
                sanitized.add(cleaned);
            }
        }
        if (sanitized.size() > MAX_IMAGES) {
            throw ApplicationFailure.invalidInput("STORY_IMAGE_LIMIT_EXCEEDED", "每条点滴最多 3 张图片");
        }
        return List.copyOf(sanitized);
    }

    private StoryMoment requireActiveMoment(Long id) {
        StoryMoment moment = storyMapper.findMomentById(id);
        if (moment == null || moment.getDeletedAt() != null) {
            throw ApplicationFailure.notFound("STORY_MOMENT_NOT_FOUND", "点滴不存在");
        }
        return moment;
    }

    private void requireManager(AuthenticatedActor actor) {
        actor.requireManager("STORY_FORBIDDEN", "只有站点主人可以管理点滴");
    }

    private boolean canManage(AuthenticatedActor actor) {
        return actor != null && actor.manager();
    }

    private StoryMomentVo toVo(StoryMoment moment) {
        return new StoryMomentVo(
                moment.getId(),
                moment.getTitle(),
                moment.getContent(),
                moment.getEventTime(),
                moment.getEndTime(),
                moment.getLocationName(),
                moment.getAddress(),
                moment.getLongitude(),
                moment.getLatitude(),
                moment.getCategory(),
                parseImages(moment.getImagesJson()),
                moment.getCreatedByUserId(),
                moment.getCreatedAt(),
                moment.getUpdatedAt()
        );
    }

    private List<String> parseImages(String imagesJson) {
        try {
            return objectMapper.readValue(imagesJson, new TypeReference<>() {
            });
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Stored story images are not a JSON array", ex);
        }
    }

    private String toJson(List<String> images) {
        try {
            return objectMapper.writeValueAsString(images);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Story images cannot be serialized", ex);
        }
    }

    private Integer validateOptionalYear(Integer year) {
        if (year == null) {
            return null;
        }
        if (year < 1970 || year > 2100) {
            throw ApplicationFailure.invalidInput("STORY_YEAR_INVALID", "点滴年份不正确");
        }
        return year;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }


}
