package xyz.snowlit.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * Technology-neutral boundary for binary object persistence.
 */
public interface ObjectStore {

    StoredObject put(MultipartFile file, String objectName);

    void delete(String objectName);

    boolean isConfigured();

    record StoredObject(
            String objectName,
            String url,
            String contentType,
            Long sizeBytes
    ) {
    }
}
