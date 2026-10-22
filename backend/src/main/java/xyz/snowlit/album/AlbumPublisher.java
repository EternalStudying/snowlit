package xyz.snowlit.album;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.*;
import xyz.snowlit.text.Text;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

/** Album validation, upload policies and the final insertion; draft ownership lives in DraftModule. */
@Service
public final class AlbumPublisher {
    public static final int MAX_PHOTOS = 50;
    public static final ImagePolicy ORIGINAL_IMAGE =
            ImagePolicy.standard("ALBUM", "album", false, "相册图片上传失败，请稍后重试");
    public static final ImagePolicy.Rejection PREVIEW_NOT_WEBP =
            new ImagePolicy.Rejection("ALBUM_PREVIEW_TYPE_INVALID", "预览图必须是 WebP");
    public static final ImagePolicy PREVIEW_IMAGE = new ImagePolicy(
            "album",
            false,
            Set.of(ImageFormat.WEBP),
            ImagePolicy.TEN_MEGABYTES,
            PREVIEW_NOT_WEBP,
            PREVIEW_NOT_WEBP,
            ORIGINAL_IMAGE.tooLarge(),
            ORIGINAL_IMAGE.storeFailed()
    );


    private final AlbumMapper mapper;
    private final PasswordEncoder passwords;
    private final Clock clock;
    public AlbumPublisher(AlbumMapper mapper, PasswordEncoder passwords, Clock clock) {
        this.mapper = mapper; this.passwords = passwords; this.clock = clock;
    }

    public AlbumVos.AlbumDetailVo create(AuthenticatedActor actor, AlbumDtos.AlbumCreateDto request, List<AlbumPhoto> photos) {
        actor.requireManager("ALBUM_FORBIDDEN", "只有站点主人可以管理相册");
        validateFields(request);
        if ("private".equals(request.visibility()) && Text.trim(request.privatePassword()).isBlank()) throw ApplicationFailure.invalidInput("ALBUM_PRIVATE_PASSWORD_REQUIRED", "私密相册密码不能为空");
        if (photos.isEmpty()) throw ApplicationFailure.invalidInput("ALBUM_PHOTO_REQUIRED", "发布相册前至少上传 1 张照片");
        if (photos.size() > MAX_PHOTOS) throw ApplicationFailure.invalidInput("ALBUM_PHOTO_LIMIT_EXCEEDED", "每本相册最多 50 张照片");
        LocalDateTime now = LocalDateTime.now(clock);
        Album album = new Album();
        album.setTitle(Text.trim(request.title())); album.setDescription(Text.trim(request.description()));
        album.setEventDate(request.eventDate()); album.setLocation(Text.trim(request.location()));
        album.setVisibility(request.visibility()); album.setPinned(Boolean.TRUE.equals(request.pinned()));
        album.setPrivatePasswordHash("private".equals(request.visibility()) ? passwords.encode(Text.trim(request.privatePassword())) : null);
        album.setCreatedByUserId(actor.userId()); album.setAuthorName(actor.displayName());
        album.setCreatedAt(now); album.setPublishedAt(now); album.setStatus("published");
        album.setSortOrder(Boolean.TRUE.equals(request.pinned()) ? 10 : 100); album.setViewCount(0L); album.setLikeCount(0L);
        album.setPhotoCount(photos.size()); album.setCoverPhotoUrl(photos.get(0).getPreviewUrl());
        mapper.insertAlbum(album);
        for (int i = 0; i < photos.size(); i++) {
            AlbumPhoto photo = photos.get(i);
            photo.setAlbumId(album.getId()); photo.setSortOrder(i + 1);
            preparePhoto(photo, request.eventDate());
            mapper.insertPhoto(photo);
        }
        var vos = photos.stream().map(Albums::toPhotoVo).toList();
        return new AlbumVos.AlbumDetailVo(Albums.toAlbumVo(album, false, vos.stream().limit(9).toList(), false), vos, actor.manager());
    }
    static void validateFields(AlbumDtos.AlbumCreateDto request) {
        if (Text.trim(request.title()).isBlank()) throw ApplicationFailure.invalidInput("ALBUM_TITLE_REQUIRED", "相册标题不能为空");
        if (request.eventDate() == null) throw ApplicationFailure.invalidInput("ALBUM_EVENT_DATE_REQUIRED", "相册日期不能为空");
        if (!Set.of("public", "private").contains(Text.trim(request.visibility()))) throw ApplicationFailure.invalidInput("ALBUM_VISIBILITY_INVALID", "相册可见性不正确");
        length(request.title(), 120, "ALBUM_TITLE_TOO_LONG", "相册标题最多 120 个字");
        length(request.description(), 500, "ALBUM_DESCRIPTION_TOO_LONG", "相册描述最多 500 个字");
        length(request.location(), 120, "ALBUM_LOCATION_TOO_LONG", "相册地点最多 120 个字");
    }

    private static void length(String value, int max, String code, String message) {
        String text = Text.trim(value);
        if (text.codePointCount(0, text.length()) > max) throw ApplicationFailure.invalidInput(code, message);
    }

    static void preparePhoto(AlbumPhoto photo, LocalDate eventDate) {
        if (photo.getTakenAt() == null) photo.setTakenAt(eventDate);
        photo.setCaption(Text.trim(photo.getCaption()).isBlank() ? "未命名照片" : Text.trim(photo.getCaption()));
        photo.setDescription(""); photo.setLocation(Text.trim(photo.getLocation()));
    }
}
