package xyz.snowlit.infrastructure.storage;

import xyz.snowlit.storage.ObjectStore;
import xyz.snowlit.support.TestImages;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalDiskObjectStoreTests {

    @TempDir
    Path directory;

    @Test
    void writesUnderDirectoryAndReturnsServedUrl() throws Exception {
        LocalDiskObjectStore store = new LocalDiskObjectStore(directory, "/uploads/");
        MockMultipartFile file = TestImages.png("file", "shot.png");

        ObjectStore.StoredObject stored = store.put(file, "feedback/2026/05/1/shot.png", "image/png");

        assertThat(stored.url()).isEqualTo("/uploads/feedback/2026/05/1/shot.png");
        assertThat(stored.sizeBytes()).isEqualTo(file.getSize());
        assertThat(Files.readAllBytes(directory.resolve("feedback/2026/05/1/shot.png"))).isEqualTo(file.getBytes());

        store.delete("feedback/2026/05/1/shot.png");
        assertThat(directory.resolve("feedback/2026/05/1/shot.png")).doesNotExist();
    }

    @Test
    void refusesObjectNamesOutsideTheDirectory() {
        LocalDiskObjectStore store = new LocalDiskObjectStore(directory, "/uploads");

        assertThatThrownBy(() -> store.put(TestImages.png("file", "x.png"), "../escape.png", "image/png"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
