package xyz.snowlit.feedback;

import xyz.snowlit.text.Text;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectKeys;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
public final class FeedbackImages {

    private final ObjectStore objects;
    private final String prefix;
    private final Path localUploadDirectory;
    private final String localPublicPrefix;

    public FeedbackImages(
            ObjectStore objects,
            @Value("${minio.feedback-prefix:feedback}") String prefix,
            @Value("${feedback.local-upload-dir:${FEEDBACK_LOCAL_UPLOAD_DIR:target/local-uploads}}")
            String localUploadDirectory,
            @Value("${feedback.local-public-prefix:${FEEDBACK_LOCAL_PUBLIC_PREFIX:/uploads}}")
            String localPublicPrefix
    ) {
        this.objects = objects;
        this.prefix = Text.trim(prefix);
        this.localUploadDirectory = Path.of(defaultText(localUploadDirectory, "target/local-uploads"));
        this.localPublicPrefix = defaultText(localPublicPrefix, "/uploads").replaceAll("/+$", "");
    }

    public ObjectStore.StoredObject upload(MultipartFile file, Long userId) {
        String objectName = ObjectKeys.dated(prefix, userId, file);
        if (!objects.isConfigured()) {
            return uploadLocal(file, objectName);
        }
        try {
            return objects.put(file, objectName);
        } catch (ApplicationFailure failure) {
            throw uploadFailure(failure);
        }
    }

    private ObjectStore.StoredObject uploadLocal(MultipartFile file, String objectName) {
        Path destination = localUploadDirectory.resolve(objectName).normalize();
        if (!destination.startsWith(localUploadDirectory.normalize())) {
            throw uploadFailure(null);
        }
        try {
            Files.createDirectories(destination.getParent());
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
            return new ObjectStore.StoredObject(
                    objectName,
                    localPublicPrefix + "/" + objectName,
                    Text.trim(file.getContentType()),
                    file.getSize()
            );
        } catch (Exception exception) {
            throw uploadFailure(exception);
        }
    }

    private ApplicationFailure uploadFailure(Throwable cause) {
        return ApplicationFailure.dependencyFailure(
                "FEEDBACK_SCREENSHOT_UPLOAD_FAILED",
                "截图上传失败，请稍后重试",
                cause
        );
    }

    private static String defaultText(String value, String fallback) {
        String cleaned = Text.trim(value);
        return cleaned.isBlank() ? fallback : cleaned;
    }
}
