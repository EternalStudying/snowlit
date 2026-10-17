package xyz.snowlit.wishes;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectKeys;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public final class WishImages {

    private final ObjectStore objects;
    private final String prefix;

    public WishImages(
            ObjectStore objects,
            @Value("${minio.wish-prefix:wish}") String prefix
    ) {
        this.objects = objects;
        this.prefix = prefix;
    }

    public ObjectStore.StoredObject upload(MultipartFile file, Long userId) {
        try {
            return objects.put(file, ObjectKeys.dated(prefix, userId, file));
        } catch (ApplicationFailure failure) {
            throw ApplicationFailure.dependencyFailure(
                    "WISH_IMAGE_UPLOAD_FAILED",
                    "清单图片上传失败，请稍后重试",
                    failure
            );
        }
    }
}
