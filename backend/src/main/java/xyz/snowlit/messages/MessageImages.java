package xyz.snowlit.messages;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectKeys;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public final class MessageImages {

    private final ObjectStore objects;
    private final String prefix;

    public MessageImages(
            ObjectStore objects,
            @Value("${minio.messages-prefix:messages}") String prefix
    ) {
        this.objects = objects;
        this.prefix = prefix;
    }

    public ObjectStore.StoredObject upload(MultipartFile file, Long userId) {
        try {
            return objects.put(file, ObjectKeys.dated(prefix, userId, file));
        } catch (ApplicationFailure failure) {
            throw ApplicationFailure.dependencyFailure(
                    "MESSAGE_IMAGE_UPLOAD_FAILED",
                    "留言图片上传失败，请稍后重试",
                    failure
            );
        }
    }

    public void deleteBestEffort(String objectName) {
        try {
            objects.delete(objectName);
        } catch (ApplicationFailure ignored) {
            // Message deletion is soft-delete first; object cleanup is best-effort.
        }
    }
}
