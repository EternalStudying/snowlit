package xyz.snowlit.album;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectKeys;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public final class AlbumAssets {

    private final ObjectStore objects;
    private final String prefix;

    public AlbumAssets(
            ObjectStore objects,
            @Value("${minio.album-prefix:album}") String prefix
    ) {
        this.objects = objects;
        this.prefix = prefix;
    }

    public ObjectStore.StoredObject uploadOriginal(MultipartFile file, Long albumId, Long userId) {
        return upload(file, albumId, userId, "original");
    }

    public ObjectStore.StoredObject uploadPreview(MultipartFile file, Long albumId, Long userId) {
        return upload(file, albumId, userId, "preview");
    }

    public void deleteBestEffort(String objectName) {
        try {
            objects.delete(objectName);
        } catch (ApplicationFailure ignored) {
            // Draft cancellation remains successful when object cleanup is temporarily unavailable.
        }
    }

    private ObjectStore.StoredObject upload(MultipartFile file, Long albumId, Long userId, String kind) {
        try {
            return objects.put(file, ObjectKeys.random(prefix, file, albumId, kind, userId));
        } catch (ApplicationFailure failure) {
            throw ApplicationFailure.dependencyFailure(
                    "ALBUM_IMAGE_UPLOAD_FAILED",
                    "相册图片上传失败，请稍后重试",
                    failure
            );
        }
    }
}
