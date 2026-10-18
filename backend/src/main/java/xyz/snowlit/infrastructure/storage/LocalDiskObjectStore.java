package xyz.snowlit.infrastructure.storage;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectStore;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Stores objects in a local directory that the application serves under its public path.
 * Used when no object storage service is configured.
 */
public final class LocalDiskObjectStore implements ObjectStore {

    private final Path directory;
    private final String publicPath;

    public LocalDiskObjectStore(Path directory, String publicPath) {
        this.directory = directory.toAbsolutePath().normalize();
        this.publicPath = publicPath.replaceAll("/+$", "");
    }

    public Path directory() {
        return directory;
    }

    public String publicPath() {
        return publicPath;
    }

    @Override
    public StoredObject put(MultipartFile file, String objectName, String contentType) {
        Path destination = resolve(objectName);
        try (InputStream input = file.getInputStream()) {
            Files.createDirectories(destination.getParent());
            Files.copy(input, destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw ApplicationFailure.dependencyFailure("OBJECT_STORE_WRITE_FAILED", "本地存储写入失败，请稍后重试", exception);
        }
        return new StoredObject(objectName, publicPath + "/" + objectName, contentType, file.getSize());
    }

    @Override
    public void delete(String objectName) {
        try {
            Files.deleteIfExists(resolve(objectName));
        } catch (IOException exception) {
            throw ApplicationFailure.dependencyFailure("OBJECT_STORE_DELETE_FAILED", "本地存储清理失败，请稍后重试", exception);
        }
    }

    private Path resolve(String objectName) {
        Path path = directory.resolve(objectName).normalize();
        if (!path.startsWith(directory)) {
            throw new IllegalArgumentException("Object name escapes the storage directory: " + objectName);
        }
        return path;
    }
}
