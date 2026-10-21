package xyz.snowlit.draft;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import xyz.snowlit.album.*;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.diary.*;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.*;
import xyz.snowlit.story.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;

/** Owns draft rows and their objects; target modules alone insert published business records. */
@Service
public class DraftModule {
    private final DraftMapper mapper;
    private final ObjectMapper json;
    private final ImageIntake images;
    private final AlbumModule albums;
    private final DiaryModule diaries;
    private final StoryModule moments;
    private final Clock clock;
    private final TransactionTemplate transactions;

    public DraftModule(DraftMapper mapper, ObjectMapper json, ImageIntake images, AlbumModule albums,
                       DiaryModule diaries, StoryModule moments, Clock clock, PlatformTransactionManager manager) {
        this.mapper = mapper; this.json = json; this.images = images; this.albums = albums;
        this.diaries = diaries; this.moments = moments; this.clock = clock;
        this.transactions = new TransactionTemplate(manager);
    }

    public DraftVos.CurrentDraftVo current(AuthenticatedActor actor, DraftKind kind) {
        authorize(actor, kind);
        Draft draft = mapper.find(actor.userId(), kind.path());
        return new DraftVos.CurrentDraftVo(draft == null ? null : toVo(draft));
    }

    public DraftVos.DraftVo save(AuthenticatedActor actor, DraftKind kind, JsonNode fields) {
        authorize(actor, kind);
        String serialized = DraftFields.validate(json, kind, fields);
        return transaction(() -> {
            Draft draft = ensure(actor, kind);
            saveFields(draft, serialized);
            return toVo(draft);
        });
    }

    public void discard(AuthenticatedActor actor, DraftKind kind) {
        authorize(actor, kind);
        transaction(() -> {
            Draft draft = mapper.lock(actor.userId(), kind.path());
            if (draft != null) {
                List<DraftImage> owned = readImages(draft);
                mapper.delete(draft.getId());
                afterCommit(() -> cleanup(owned));
            }
            return null;
        });
    }

    public DraftVos.DraftImageVo upload(AuthenticatedActor actor, DraftKind kind, MultipartFile file,
                                        MultipartFile original, MultipartFile preview, JsonNode metadata) {
        authorize(actor, kind);
        AlbumDtos.AlbumPhotoMetadataDto albumMetadata = kind == DraftKind.ALBUM ? albumMetadata(metadata) : null;
        List<ObjectStore.StoredObject> stored = new ArrayList<>();
        try {
            return transaction(() -> {
                Draft draft = ensure(actor, kind);
                List<DraftImage> owned = new ArrayList<>(readImages(draft));
                limit(kind, owned.size());
                ObjectStore.StoredObject display;
                ObjectStore.StoredObject source = null;
                if (kind == DraftKind.ALBUM) {
                    boolean mobile = file != null;
                    if ((!mobile && (original == null || preview == null)) || (mobile && (original != null || preview != null))) {
                        throw ApplicationFailure.invalidInput("ALBUM_PHOTO_REQUIRED", "请选择要上传的照片");
                    }
                    MultipartFile sourceFile = mobile ? file : original;
                    MultipartFile displayFile = mobile ? file : preview;
                    ImagePolicy displayPolicy = mobile ? AlbumPublisher.ORIGINAL_IMAGE : AlbumPublisher.PREVIEW_IMAGE;
                    images.verify(sourceFile, AlbumPublisher.ORIGINAL_IMAGE);
                    images.verify(displayFile, displayPolicy);
                    source = images.store(sourceFile, AlbumPublisher.ORIGINAL_IMAGE, draft.getId(), "original", actor.userId());
                    stored.add(source);
                    display = images.store(displayFile, displayPolicy, draft.getId(), "preview", actor.userId());
                } else {
                    if (file == null) throw ApplicationFailure.invalidInput(kind == DraftKind.DIARY ? "DIARY_IMAGE_REQUIRED" : "STORY_IMAGE_REQUIRED", "请选择要上传的图片");
                    display = images.store(file, kind == DraftKind.DIARY ? DiaryModule.IMAGE : StoryModule.IMAGE, actor.userId());
                }
                stored.add(display);
                DraftImage image = new DraftImage(UUID.randomUUID().toString(), display.url(), display.objectName(),
                        display.contentType(), display.sizeBytes(), source,
                        albumMetadata == null ? null : albumMetadata.width(), albumMetadata == null ? null : albumMetadata.height(),
                        albumMetadata == null ? null : albumMetadata.takenAt(), albumMetadata == null ? null : albumMetadata.location(),
                        albumMetadata == null ? null : albumMetadata.caption());
                owned.add(image);
                mapper.saveImages(draft.getId(), serialize(owned), now());
                return image.toVo();
            });
        } catch (RuntimeException exception) {
            stored.forEach(object -> images.deleteBestEffort(object.objectName()));
            throw exception;
        }
    }

    public void removeImage(AuthenticatedActor actor, DraftKind kind, String imageId) {
        authorize(actor, kind);
        transaction(() -> {
            Draft draft = mapper.lock(actor.userId(), kind.path());
            List<DraftImage> owned = draft == null ? List.of() : readImages(draft);
            DraftImage removed = owned.stream().filter(image -> image.id().equals(imageId)).findFirst()
                    .orElseThrow(() -> ApplicationFailure.notFound("DRAFT_IMAGE_NOT_FOUND", "草稿图片不存在"));
            mapper.saveImages(draft.getId(), serialize(owned.stream().filter(image -> !image.id().equals(imageId)).toList()), now());
            afterCommit(() -> cleanup(List.of(removed)));
            return null;
        });
    }

    public Object publish(AuthenticatedActor actor, DraftKind kind, DraftDtos.PublishDto request) {
        authorize(actor, kind);
        String fields = DraftFields.validate(json, kind, request.fields());
        if (kind != DraftKind.ALBUM && request.privatePassword() != null) throw DraftFields.invalid();
        Publication result = transaction(() -> {
            Draft draft = mapper.lock(actor.userId(), kind.path());
            if (draft == null) throw ApplicationFailure.notFound("DRAFT_NOT_FOUND", "草稿不存在");
            saveFields(draft, fields);
            List<DraftImage> owned = readImages(draft);
            Object published;
            try {
                published = switch (kind) {
                    case ALBUM -> albums.createFromDraft(actor, albumRequest(request), owned.stream().map(this::albumPhoto).toList());
                    case DIARY -> diaries.createFromDraft(actor, convert(request.fields(), DiaryDtos.DiaryCreateDto.class), owned.stream().map(image -> diaryImage(actor, image)).toList());
                    case MOMENT -> moments.createFromDraft(actor, momentRequest(request.fields(), owned));
                };
            } catch (ApplicationFailure failure) {
                // Expected validation/conflict failures happen before domain writes. Commit the latest fields,
                // then throw outside the transaction so the member can correct and retry the saved draft.
                if (Set.of(ApplicationFailure.Kind.INVALID_INPUT, ApplicationFailure.Kind.CONFLICT, ApplicationFailure.Kind.FORBIDDEN).contains(failure.kind())) {
                    return new Publication(null, failure);
                }
                throw failure;
            }
            mapper.delete(draft.getId());
            if (kind == DraftKind.DIARY) {
                Set<String> referenced = new HashSet<>(diaries.draftImageUrls(request.fields().path("contentMarkdown").asText("")));
                afterCommit(() -> cleanup(owned.stream().filter(image -> !referenced.contains(image.url())).toList()));
            }
            return new Publication(published, null);
        });
        if (result.failure() != null) throw result.failure();
        return result.value();
    }

    private void authorize(AuthenticatedActor actor, DraftKind kind) {
        switch (kind) {
            case ALBUM -> actor.requireManager("ALBUM_FORBIDDEN", "只有站点主人可以管理相册");
            case MOMENT -> actor.requireManager("STORY_FORBIDDEN", "只有站点主人可以管理点滴");
            case DIARY -> diaries.resolveRole(actor);
        }
    }

    private Draft ensure(AuthenticatedActor actor, DraftKind kind) {
        mapper.ensure(actor.userId(), kind.path(), now());
        return mapper.lock(actor.userId(), kind.path());
    }

    private void saveFields(Draft draft, String fields) {
        draft.setFieldsJson(fields); draft.setUpdatedAt(now());
        mapper.saveFields(draft.getId(), fields, draft.getUpdatedAt());
    }

    private DraftVos.DraftVo toVo(Draft draft) {
        return new DraftVos.DraftVo(draft.getKind(), parse(draft.getFieldsJson()),
                readImages(draft).stream().map(DraftImage::toVo).toList(), draft.getCreatedAt(), draft.getUpdatedAt());
    }

    private List<DraftImage> readImages(Draft draft) {
        try { return json.readValue(draft.getImagesJson(), new TypeReference<List<DraftImage>>() {}); }
        catch (Exception exception) { throw new IllegalStateException("Stored draft images cannot be read", exception); }
    }

    private JsonNode parse(String value) {
        try { return json.readTree(value); } catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private String serialize(Object value) {
        try { return json.writeValueAsString(value); } catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private <T> T convert(JsonNode value, Class<T> type) {
        try { return json.treeToValue(value, type); } catch (Exception exception) { throw DraftFields.invalid(); }
    }

    private AlbumDtos.AlbumCreateDto albumRequest(DraftDtos.PublishDto request) {
        var fields = convert(request.fields(), AlbumDtos.AlbumCreateDto.class);
        return new AlbumDtos.AlbumCreateDto(fields.title(), fields.description(), fields.eventDate(), fields.location(),
                fields.visibility(), request.privatePassword(), fields.pinned());
    }

    private StoryDtos.StoryMomentUpsertDto momentRequest(JsonNode fields, List<DraftImage> owned) {
        var form = convert(fields, StoryDtos.StoryMomentUpsertDto.class);
        return new StoryDtos.StoryMomentUpsertDto(form.title(), form.content(), form.eventTime(), form.endTime(),
                form.locationName(), form.address(), form.longitude(), form.latitude(), form.category(), owned.stream().map(DraftImage::url).toList());
    }

    private AlbumPhoto albumPhoto(DraftImage image) {
        AlbumPhoto photo = new AlbumPhoto();
        photo.setCaption(image.caption()); photo.setTakenAt(image.takenAt()); photo.setLocation(image.location());
        photo.setWidth(image.width()); photo.setHeight(image.height());
        photo.setPreviewUrl(image.url()); photo.setPreviewObjectName(image.objectName());
        photo.setPreviewContentType(image.contentType()); photo.setPreviewSizeBytes(image.sizeBytes());
        // Every album draft image has an original: mobile uploads store the one file twice.
        ObjectStore.StoredObject original = image.original();
        photo.setOriginalUrl(original.url());
        photo.setOriginalObjectName(original.objectName());
        photo.setOriginalContentType(original.contentType());
        photo.setOriginalSizeBytes(original.sizeBytes());
        return photo;
    }

    private DiaryImage diaryImage(AuthenticatedActor actor, DraftImage image) {
        DiaryImage upload = new DiaryImage();
        upload.setUploaderUserId(actor.userId()); upload.setObjectName(image.objectName()); upload.setUrl(image.url());
        upload.setContentType(image.contentType()); upload.setSizeBytes(image.sizeBytes());
        return upload;
    }

    private AlbumDtos.AlbumPhotoMetadataDto albumMetadata(JsonNode node) {
        if (node == null || !node.isObject()) throw metadataInvalid();
        node.fieldNames().forEachRemaining(key -> {
            if (!Set.of("caption", "takenAt", "location", "width", "height").contains(key)) throw metadataInvalid();
        });
        try {
            for (String key : List.of("caption", "location")) {
                if (node.hasNonNull(key) && (!node.get(key).isTextual() || node.get(key).textValue().codePointCount(0, node.get(key).textValue().length()) > 120)) throw metadataInvalid();
            }
            for (String key : List.of("width", "height")) {
                if (!node.hasNonNull(key) || !node.get(key).isIntegralNumber() || !node.get(key).canConvertToInt() || node.get(key).intValue() < 1) throw metadataInvalid();
            }
            if (node.hasNonNull("takenAt") && (!node.get("takenAt").isTextual() || !node.get("takenAt").textValue().matches("\\d{4}-\\d{2}-\\d{2}"))) throw metadataInvalid();
            return convert(node, AlbumDtos.AlbumPhotoMetadataDto.class);
        } catch (RuntimeException exception) { throw metadataInvalid(); }
    }

    private ApplicationFailure metadataInvalid() { return ApplicationFailure.invalidInput("ALBUM_PHOTO_METADATA_INVALID", "照片信息不正确"); }

    private void limit(DraftKind kind, int count) {
        int max = switch (kind) { case ALBUM -> AlbumPublisher.MAX_PHOTOS; case DIARY -> 20; case MOMENT -> 3; };
        if (count >= max) throw ApplicationFailure.invalidInput(switch (kind) {
            case ALBUM -> "ALBUM_PHOTO_LIMIT_EXCEEDED"; case DIARY -> "DIARY_IMAGE_LIMIT_EXCEEDED"; case MOMENT -> "STORY_IMAGE_LIMIT_EXCEEDED";
        }, switch (kind) {
            case ALBUM -> "每本相册最多 50 张照片";
            case DIARY -> "每篇日记最多 20 张图片";
            case MOMENT -> "每条点滴最多 3 张图片";
        });
    }

    private void cleanup(List<DraftImage> owned) {
        Set<String> names = new LinkedHashSet<>();
        for (DraftImage image : owned) {
            names.add(image.objectName());
            if (image.original() != null) names.add(image.original().objectName());
        }
        names.forEach(images::deleteBestEffort);
    }

    private void afterCommit(Runnable action) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { action.run(); }
        });
    }

    private <T> T transaction(Supplier<T> action) { return transactions.execute(status -> action.get()); }
    private LocalDateTime now() { return LocalDateTime.now(clock); }
    private record Publication(Object value, ApplicationFailure failure) {}
}
