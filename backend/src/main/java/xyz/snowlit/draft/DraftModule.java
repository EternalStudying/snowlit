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
        return upload(actor, kind, file, original, preview, metadata, 0, null);
    }

    private DraftVos.DraftImageVo upload(AuthenticatedActor actor, DraftKind kind, MultipartFile file,
                                       MultipartFile original, MultipartFile preview, JsonNode metadata,
                                       int existingPhotoCount, Long albumId) {
        authorize(actor, kind);
        AlbumDtos.AlbumPhotoMetadataDto albumMetadata = isAlbum(kind) ? albumMetadata(metadata) : null;
        List<ObjectStore.StoredObject> stored = new ArrayList<>();
        try {
            return transaction(() -> {
                Draft draft = kind == DraftKind.ALBUM_EDIT ? requireEdit(actor, albumId) : ensure(actor, kind);
                List<DraftImage> owned = new ArrayList<>(readImages(draft));
                limit(kind, owned.size() + existingPhotoCount);
                ObjectStore.StoredObject display;
                ObjectStore.StoredObject source = null;
                if (isAlbum(kind)) {
                    source = storeAlbumPhoto(actor, draft, file, original, preview, stored);
                    display = stored.get(stored.size() - 1);
                } else {
                    if (file == null) throw ApplicationFailure.invalidInput(kind == DraftKind.DIARY ? "DIARY_IMAGE_REQUIRED" : "STORY_IMAGE_REQUIRED", "请选择要上传的图片");
                    display = images.store(file, kind == DraftKind.DIARY ? DiaryModule.IMAGE : StoryModule.IMAGE, actor.userId());
                    stored.add(display);
                }
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
            List<DraftImage> owned = kind == DraftKind.ALBUM ? ordered(readImages(draft), request.imageOrder()) : readImages(draft);
            Object published;
            try {
                published = switch (kind) {
                    case ALBUM -> albums.createFromDraft(actor, albumRequest(request), owned.stream().map(DraftModule::albumPhoto).toList());
                    case DIARY -> diaries.createFromDraft(actor, convert(request.fields(), DiaryDtos.DiaryCreateDto.class), owned.stream().map(image -> diaryImage(actor, image)).toList());
                    case MOMENT -> moments.createFromDraft(actor, momentRequest(request.fields(), owned));
                    case ALBUM_EDIT -> throw new IllegalArgumentException("Internal edit drafts cannot be published");
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

    public DraftVos.DraftVo reorder(AuthenticatedActor actor, List<String> ids) {
        authorize(actor, DraftKind.ALBUM);
        return transaction(() -> {
            Draft draft = mapper.lock(actor.userId(), "album");
            if (draft == null) throw ApplicationFailure.notFound("DRAFT_NOT_FOUND", "草稿不存在");
            draft.setImagesJson(serialize(ordered(readImages(draft), ids)));
            draft.setUpdatedAt(now());
            mapper.saveImages(draft.getId(), draft.getImagesJson(), draft.getUpdatedAt());
            return toVo(draft);
        });
    }

    private List<DraftImage> ordered(List<DraftImage> owned, List<String> ids) {
        if (ids == null) return owned;
        Map<String, DraftImage> remaining = new LinkedHashMap<>();
        owned.forEach(image -> remaining.put(image.id(), image));
        List<DraftImage> result = new ArrayList<>();
        for (String id : ids) {
            DraftImage image = remaining.remove(id);
            if (image != null) result.add(image);
        }
        result.addAll(remaining.values());
        return result;
    }

    public void startEdit(AuthenticatedActor actor, Long albumId) {
        transaction(() -> {
            Draft previous = ensure(actor, DraftKind.ALBUM_EDIT);
            List<DraftImage> owned = readImages(previous);
            mapper.delete(previous.getId());
            afterCommit(() -> cleanup(owned));
            Draft next = ensure(actor, DraftKind.ALBUM_EDIT);
            saveFields(next, serialize(Map.of("albumId", albumId)));
            return null;
        });
    }

    public record EditDraft(Long id, List<DraftImage> images) {}

    public EditDraft editDraft(AuthenticatedActor actor, Long albumId, boolean required) {
        Draft draft = mapper.lock(actor.userId(), DraftKind.ALBUM_EDIT.path());
        if (draft == null || parse(draft.getFieldsJson()).path("albumId").asLong() != albumId) {
            if (required) throw editExpired();
            return null;
        }
        return new EditDraft(draft.getId(), readImages(draft));
    }

    private Draft requireEdit(AuthenticatedActor actor, Long albumId) {
        editDraft(actor, albumId, true);
        return mapper.lock(actor.userId(), DraftKind.ALBUM_EDIT.path());
    }

    public DraftVos.DraftImageVo uploadEdit(AuthenticatedActor actor, Long albumId, int photoCount,
                                           MultipartFile file, MultipartFile original, MultipartFile preview, JsonNode metadata) {
        return upload(actor, DraftKind.ALBUM_EDIT, file, original, preview, metadata, photoCount, albumId);
    }

    public void removeEditImage(AuthenticatedActor actor, Long albumId, String imageId) {
        transaction(() -> {
            requireEdit(actor, albumId);
            removeImage(actor, DraftKind.ALBUM_EDIT, imageId);
            return null;
        });
    }

    public void cancelEdit(AuthenticatedActor actor, Long albumId) {
        transaction(() -> {
            EditDraft draft = editDraft(actor, albumId, false);
            if (draft != null) finishEdit(draft, Set.of());
            return null;
        });
    }

    public void finishEdit(EditDraft draft, Set<String> usedIds) {
        mapper.delete(draft.id());
        afterCommit(() -> cleanup(draft.images().stream().filter(image -> !usedIds.contains(image.id())).toList()));
    }

    private ApplicationFailure editExpired() {
        return ApplicationFailure.conflict("ALBUM_EDIT_EXPIRED", "编辑已失效，请重新打开相册编辑");
    }

    private boolean isAlbum(DraftKind kind) { return kind == DraftKind.ALBUM || kind == DraftKind.ALBUM_EDIT; }

    private ObjectStore.StoredObject storeAlbumPhoto(AuthenticatedActor actor, Draft draft, MultipartFile file,
                                                      MultipartFile original, MultipartFile preview,
                                                      List<ObjectStore.StoredObject> stored) {
        boolean mobile = file != null;
        if ((!mobile && (original == null || preview == null)) || (mobile && (original != null || preview != null))) {
            throw ApplicationFailure.invalidInput("ALBUM_PHOTO_REQUIRED", "请选择要上传的照片");
        }
        MultipartFile sourceFile = mobile ? file : original;
        MultipartFile displayFile = mobile ? file : preview;
        ImagePolicy displayPolicy = mobile ? AlbumPublisher.ORIGINAL_IMAGE : AlbumPublisher.PREVIEW_IMAGE;
        images.verify(sourceFile, AlbumPublisher.ORIGINAL_IMAGE);
        images.verify(displayFile, displayPolicy);
        ObjectStore.StoredObject source = images.store(sourceFile, AlbumPublisher.ORIGINAL_IMAGE, draft.getId(), "original", actor.userId());
        stored.add(source);
        stored.add(images.store(displayFile, displayPolicy, draft.getId(), "preview", actor.userId()));
        return source;
    }

    private void authorize(AuthenticatedActor actor, DraftKind kind) {
        switch (kind) {
            case ALBUM, ALBUM_EDIT -> actor.requireManager("ALBUM_FORBIDDEN", "只有站点主人可以管理相册");
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

    public static AlbumPhoto albumPhoto(DraftImage image) {
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
        int max = switch (kind) { case ALBUM, ALBUM_EDIT -> AlbumPublisher.MAX_PHOTOS; case DIARY -> 20; case MOMENT -> 3; };
        if (count >= max) throw ApplicationFailure.invalidInput(switch (kind) {
            case ALBUM, ALBUM_EDIT -> "ALBUM_PHOTO_LIMIT_EXCEEDED"; case DIARY -> "DIARY_IMAGE_LIMIT_EXCEEDED"; case MOMENT -> "STORY_IMAGE_LIMIT_EXCEEDED";
        }, switch (kind) {
            case ALBUM, ALBUM_EDIT -> "每本相册最多 50 张照片";
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
