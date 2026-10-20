package xyz.snowlit.draft;

import xyz.snowlit.storage.ObjectStore.StoredObject;
import java.time.LocalDate;

/** Internal image ownership, never accepted as a request or serialized as a response. */
record DraftImage(String id, String url, String objectName, String contentType, Long sizeBytes,
                  StoredObject original, Integer width, Integer height, LocalDate takenAt,
                  String location, String caption) {
    DraftVos.DraftImageVo toVo() {
        return new DraftVos.DraftImageVo(id, url, width, height, takenAt, location, caption,
                original == null ? null : original.url());
    }
}
