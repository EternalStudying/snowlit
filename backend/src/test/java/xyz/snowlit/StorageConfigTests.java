package xyz.snowlit;

import xyz.snowlit.config.StorageConfig;
import xyz.snowlit.infrastructure.storage.LocalDiskObjectStore;
import xyz.snowlit.infrastructure.storage.MinioObjectStore;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StorageConfigTests {

    @Test
    void usesMinioOnlyWhenEveryConnectionSettingIsPresent() {
        StorageConfig configured = new StorageConfig(
                "http://127.0.0.1:9000", "access", "secret", "bucket", "http://127.0.0.1:9000/bucket",
                "target/test-uploads", "/uploads"
        );
        StorageConfig missingSecret = new StorageConfig(
                "http://127.0.0.1:9000", "access", "", "bucket", "http://127.0.0.1:9000/bucket",
                "target/test-uploads", "/uploads"
        );

        assertThat(configured.objectStore()).isInstanceOf(MinioObjectStore.class);
        assertThat(missingSecret.objectStore()).isInstanceOf(LocalDiskObjectStore.class);
    }
}
