package xyz.snowlit.storage;

import xyz.snowlit.failure.ApplicationFailure;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Accepts user images for every business flow: verifies the content against a policy, names the object,
 * stores it, and removes it again. Business modules keep their own references and limits per record.
 */
@Service
public class ImageIntake {

    private final ObjectStore objects;
    private final Clock clock;

    public ImageIntake(ObjectStore objects) {
        this(objects, Clock.systemDefaultZone());
    }

    ImageIntake(ObjectStore objects, Clock clock) {
        this.objects = objects;
        this.clock = clock;
    }

    /**
     * Rejects the file unless it is a non-empty image the policy accepts.
     */
    public ImageFormat verify(MultipartFile file, ImagePolicy policy) {
        if (file.isEmpty()) {
            throw reject(policy.missing());
        }
        byte[] header = header(file);
        ImageFormat format = ImageFormat.detect(header, header.length)
                .filter(policy.formats()::contains)
                .orElseThrow(() -> reject(policy.wrongType()));
        if (file.getSize() > policy.maxBytes()) {
            throw ApplicationFailure.payloadTooLarge(policy.tooLarge().code(), policy.tooLarge().message());
        }
        return format;
    }

    /**
     * Verifies and stores the file under {@code keyPrefix[/yyyy/MM]/segments.../<uuid>.<ext>}.
     */
    public ObjectStore.StoredObject store(MultipartFile file, ImagePolicy policy, Object... pathSegments) {
        ImageFormat format = verify(file, policy);
        try {
            return objects.put(file, objectName(policy, format, pathSegments), format.contentType());
        } catch (ApplicationFailure failure) {
            throw storeFailure(policy, failure);
        }
    }

    public void delete(String objectName, ImagePolicy policy) {
        try {
            objects.delete(objectName);
        } catch (ApplicationFailure failure) {
            throw storeFailure(policy, failure);
        }
    }

    /**
     * Removes an object whose record is already gone; an unavailable store leaves the object behind.
     * A null name means the record never had a stored object (seed data, image-less messages).
     */
    public void deleteBestEffort(String objectName) {
        if (objectName == null) {
            return;
        }
        try {
            objects.delete(objectName);
        } catch (ApplicationFailure ignored) {
            // The business change has already succeeded; an orphaned object is acceptable.
        }
    }

    private String objectName(ImagePolicy policy, ImageFormat format, Object[] pathSegments) {
        List<String> segments = new ArrayList<>();
        segments.add(policy.keyPrefix());
        if (policy.datedKeys()) {
            LocalDate today = LocalDate.now(clock);
            segments.add(Integer.toString(today.getYear()));
            segments.add("%02d".formatted(today.getMonthValue()));
        }
        for (Object segment : pathSegments) {
            segments.add(String.valueOf(segment));
        }
        segments.add(UUID.randomUUID() + "." + format.extension());
        return String.join("/", segments);
    }

    private static byte[] header(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return input.readNBytes(ImageFormat.HEADER_LENGTH);
        } catch (IOException exception) {
            throw new IllegalStateException("Uploaded file cannot be read", exception);
        }
    }

    private static ApplicationFailure reject(ImagePolicy.Rejection rejection) {
        return ApplicationFailure.invalidInput(rejection.code(), rejection.message());
    }

    private static ApplicationFailure storeFailure(ImagePolicy policy, ApplicationFailure cause) {
        return ApplicationFailure.dependencyFailure(policy.storeFailed().code(), policy.storeFailed().message(), cause);
    }
}
