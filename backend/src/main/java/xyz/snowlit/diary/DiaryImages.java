package xyz.snowlit.diary;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectKeys;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public final class DiaryImages {

    private final ObjectStore objects;
    private final String temporaryPrefix;

    public DiaryImages(
            ObjectStore objects,
            @Value("${minio.diary-temp-prefix:diary/tmp}") String temporaryPrefix
    ) {
        this.objects = objects;
        this.temporaryPrefix = temporaryPrefix;
    }

    public ObjectStore.StoredObject uploadTemporary(MultipartFile file, Long userId) {
        try {
            return objects.put(file, ObjectKeys.random(temporaryPrefix, file, userId));
        } catch (ApplicationFailure failure) {
            throw imageFailure(failure);
        }
    }

    public void delete(String objectName) {
        try {
            objects.delete(objectName);
        } catch (ApplicationFailure failure) {
            throw imageFailure(failure);
        }
    }

    private ApplicationFailure imageFailure(ApplicationFailure cause) {
        return ApplicationFailure.dependencyFailure(
                "DIARY_IMAGE_UPLOAD_FAILED",
                "图片上传失败，请稍后重试",
                cause
        );
    }
}
