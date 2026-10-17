package xyz.snowlit.feedback;

import xyz.snowlit.storage.ObjectStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackImagesTests {

    @TempDir
    Path uploadDirectory;

    @Test
    void fallsBackToLocalStorageWhenObjectStoreIsNotConfigured() throws Exception {
        FeedbackImages images = new FeedbackImages(
                new UnconfiguredObjectStore(),
                "feedback",
                uploadDirectory.toString(),
                "/uploads"
        );
        MockMultipartFile file =
                new MockMultipartFile("file", "shot.png", MediaType.IMAGE_PNG_VALUE, "png".getBytes());

        ObjectStore.StoredObject stored = images.upload(file, 1L);

        assertThat(stored.objectName()).startsWith("feedback/");
        assertThat(stored.objectName()).endsWith(".png");
        assertThat(stored.url()).startsWith("/uploads/feedback/");
        assertThat(stored.contentType()).isEqualTo(MediaType.IMAGE_PNG_VALUE);
        assertThat(stored.sizeBytes()).isEqualTo(3L);
        assertThat(Files.readAllBytes(uploadDirectory.resolve(stored.objectName()))).isEqualTo("png".getBytes());
    }

    private static final class UnconfiguredObjectStore implements ObjectStore {

        @Override
        public StoredObject put(MultipartFile file, String objectName) {
            throw new AssertionError("local fallback should not call the remote object store");
        }

        @Override
        public void delete(String objectName) {
        }

        @Override
        public boolean isConfigured() {
            return false;
        }
    }
}
