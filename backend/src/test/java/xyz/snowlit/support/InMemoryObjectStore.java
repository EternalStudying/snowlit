package xyz.snowlit.support;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ObjectStore adapter for tests: keeps stored objects in memory and can simulate an unavailable store.
 */
public final class InMemoryObjectStore implements ObjectStore {

    public static final String BASE_URL = "https://objects.test/";

    private final Map<String, StoredObject> objects = new LinkedHashMap<>();
    private final List<String> deleted = new ArrayList<>();
    private boolean unavailable;

    @Override
    public StoredObject put(MultipartFile file, String objectName, String contentType) {
        if (unavailable) {
            throw ApplicationFailure.dependencyFailure("OBJECT_STORE_WRITE_FAILED", "对象存储写入失败，请稍后重试", null);
        }
        StoredObject stored = new StoredObject(objectName, BASE_URL + objectName, contentType, file.getSize());
        objects.put(objectName, stored);
        return stored;
    }

    @Override
    public void delete(String objectName) {
        if (unavailable) {
            throw ApplicationFailure.dependencyFailure("OBJECT_STORE_DELETE_FAILED", "对象存储清理失败，请稍后重试", null);
        }
        objects.remove(objectName);
        deleted.add(objectName);
    }

    public void becomeUnavailable() {
        unavailable = true;
    }

    public List<StoredObject> stored() {
        return List.copyOf(objects.values());
    }

    public StoredObject onlyStored() {
        if (objects.size() != 1) {
            throw new AssertionError("expected exactly one stored object but found " + objects.keySet());
        }
        return objects.values().iterator().next();
    }

    public List<String> deleted() {
        return List.copyOf(deleted);
    }
}
