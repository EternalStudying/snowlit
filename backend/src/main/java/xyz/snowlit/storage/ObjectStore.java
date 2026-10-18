package xyz.snowlit.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * Technology-neutral seam for binary object persistence. Failures surface as dependency ApplicationFailures.
 */
public interface ObjectStore {

    StoredObject put(MultipartFile file, String objectName, String contentType);

    void delete(String objectName);

    record StoredObject(
            String objectName,
            String url,
            String contentType,
            Long sizeBytes
    ) {
    }
}
