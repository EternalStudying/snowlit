package xyz.snowlit.album;

import com.fasterxml.jackson.databind.JsonNode;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.draft.DraftModule;
import xyz.snowlit.draft.DraftVos;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ImageIntake;
import xyz.snowlit.text.Text;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import java.time.*;
import java.util.*;

/** Published-album changes serialize on the album, then its member-owned edit draft. */
@Service
public class AlbumEditor {
    private final AlbumMapper mapper;
    private final DraftModule drafts;
    private final PasswordEncoder passwords;
    private final ImageIntake images;
    private final Clock clock;

    public AlbumEditor(AlbumMapper mapper, DraftModule drafts, PasswordEncoder passwords, ImageIntake images, Clock clock) {
        this.mapper = mapper; this.drafts = drafts; this.passwords = passwords; this.images = images; this.clock = clock;
    }

    @Transactional
    public AlbumVos.AlbumEditVo start(AuthenticatedActor actor, Long albumId) {
        authorize(actor);
        Album album = lock(albumId);
        drafts.startEdit(actor, albumId);
        return new AlbumVos.AlbumEditVo(new AlbumVos.AlbumEditAlbumVo(album.getId(), album.getTitle(),
                album.getDescription(), album.getEventDate(), album.getLocation(), album.getVisibility(),
                album.getPrivatePasswordHash() != null, album.isPinned()),
                mapper.findPhotosByAlbumId(albumId).stream().map(Albums::toPhotoVo).toList());
    }

    @Transactional
    public DraftVos.DraftImageVo upload(AuthenticatedActor actor, Long albumId, MultipartFile file,
                                        MultipartFile original, MultipartFile preview, JsonNode metadata) {
        authorize(actor);
        lock(albumId);
        return drafts.uploadEdit(actor, albumId, mapper.countPhotosByAlbumId(albumId), file, original, preview, metadata);
    }

    @Transactional
    public void remove(AuthenticatedActor actor, Long albumId, String draftImageId) {
        authorize(actor);
        lock(albumId);
        drafts.removeEditImage(actor, albumId, draftImageId);
    }

    public void cancel(AuthenticatedActor actor, Long albumId) {
        authorize(actor);
        drafts.cancelEdit(actor, albumId);
    }

    @Transactional
    public AlbumVos.AlbumDetailVo save(AuthenticatedActor actor, Long albumId, AlbumDtos.AlbumSaveDto request) {
        authorize(actor);
        Album album = lock(albumId);
        AlbumPublisher.validateFields(request.fields());
        String oldHash = album.getPrivatePasswordHash();
        String hash = null;
        if ("private".equals(request.visibility())) {
            if (!Text.trim(request.privatePassword()).isBlank()) hash = passwords.encode(Text.trim(request.privatePassword()));
            else if (Albums.isPrivate(album)) hash = oldHash;
            else throw ApplicationFailure.invalidInput("ALBUM_PRIVATE_PASSWORD_REQUIRED", "私密相册密码不能为空");
        }
        var entries = request.photos();
        if (entries == null || entries.isEmpty()) throw ApplicationFailure.invalidInput("ALBUM_PHOTO_REQUIRED", "相册至少保留 1 张照片");
        if (entries.size() > AlbumPublisher.MAX_PHOTOS) throw ApplicationFailure.invalidInput("ALBUM_PHOTO_LIMIT_EXCEEDED", "每本相册最多 50 张照片");
        Set<Long> photoIds = new HashSet<>();
        Set<String> draftImageIds = new HashSet<>();
        for (var entry : entries) {
            if (entry == null || (entry.photoId() == null) == (entry.draftImageId() == null)) throw invalidPhotos();
            if (entry.photoId() != null ? !photoIds.add(entry.photoId()) : !draftImageIds.add(entry.draftImageId())) throw invalidPhotos();
        }
        List<AlbumPhoto> existing = mapper.findPhotosByAlbumId(albumId);
        Map<Long, AlbumPhoto> byId = new HashMap<>();
        existing.forEach(photo -> byId.put(photo.getId(), photo));
        if (!byId.keySet().containsAll(photoIds)) throw invalidPhotos();
        DraftModule.EditDraft editDraft = drafts.editDraft(actor, albumId, !draftImageIds.isEmpty());
        Map<String, AlbumPhoto> uploaded = new HashMap<>();
        if (editDraft != null) editDraft.images().forEach(image -> uploaded.put(image.id(), DraftModule.albumPhoto(image)));
        if (!uploaded.keySet().containsAll(draftImageIds)) throw invalidPhotos();
        List<AlbumPhoto> ordered = entries.stream().map(entry -> entry.photoId() != null ? byId.get(entry.photoId()) : uploaded.get(entry.draftImageId())).toList();
        List<AlbumPhoto> removed = existing.stream().filter(photo -> !photoIds.contains(photo.getId())).toList();

        // All validation finishes before any domain writes or cleanup registrations.
        album.setTitle(Text.trim(request.title())); album.setDescription(Text.trim(request.description()));
        album.setEventDate(request.eventDate()); album.setLocation(Text.trim(request.location()));
        album.setVisibility(request.visibility()); album.setPrivatePasswordHash(hash);
        album.setPinned(Boolean.TRUE.equals(request.pinned())); album.setSortOrder(album.isPinned() ? 10 : 100);
        album.setCoverPhotoUrl(ordered.get(0).getPreviewUrl()); album.setPhotoCount(ordered.size());
        mapper.updateAlbum(album);
        if (!Objects.equals(oldHash, hash)) mapper.clearAlbumUnlockFailures(albumId);
        removed.forEach(photo -> mapper.deletePhoto(photo.getId()));
        for (int i = 0; i < ordered.size(); i++) {
            AlbumPhoto photo = ordered.get(i);
            photo.setSortOrder(i + 1);
            if (photo.getId() == null) {
                photo.setAlbumId(albumId);
                AlbumPublisher.preparePhoto(photo, request.eventDate());
                mapper.insertPhoto(photo);
            } else mapper.updatePhotoOrder(photo.getId(), i + 1);
        }
        if (editDraft != null) drafts.finishEdit(editDraft, draftImageIds);
        cleanupAfterCommit(removed);
        var photos = ordered.stream().map(Albums::toPhotoVo).toList();
        boolean liked = Boolean.TRUE.equals(mapper.findDailyLikeActive(albumId, actor.userId(), LocalDate.now(clock.withZone(ZoneOffset.UTC))));
        return new AlbumVos.AlbumDetailVo(Albums.toAlbumVo(album, false, List.of(), liked), photos, true);
    }

    @Transactional
    public void delete(AuthenticatedActor actor, Long albumId) {
        authorize(actor);
        lock(albumId);
        List<AlbumPhoto> photos = mapper.findPhotosByAlbumId(albumId);
        mapper.deleteAlbum(albumId);
        cleanupAfterCommit(photos);
    }

    private Album lock(Long albumId) {
        Album album = mapper.lockAlbum(albumId);
        if (album == null || !"published".equals(album.getStatus())) throw ApplicationFailure.notFound("ALBUM_NOT_FOUND", "相册不存在");
        return album;
    }

    private void authorize(AuthenticatedActor actor) { actor.requireManager("ALBUM_FORBIDDEN", "只有站点主人可以管理相册"); }
    private ApplicationFailure invalidPhotos() { return ApplicationFailure.invalidInput("ALBUM_PHOTOS_INVALID", "照片列表不正确"); }
    private void cleanupAfterCommit(List<AlbumPhoto> photos) {
        Set<String> names = new LinkedHashSet<>();
        for (AlbumPhoto photo : photos) {
            if (photo.getOriginalObjectName() != null) names.add(photo.getOriginalObjectName());
            if (photo.getPreviewObjectName() != null) names.add(photo.getPreviewObjectName());
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { names.forEach(images::deleteBestEffort); }
        });
    }
}
