package xyz.snowlit.config;

import xyz.snowlit.infrastructure.storage.LocalDiskObjectStore;
import xyz.snowlit.infrastructure.storage.MinioObjectStore;
import xyz.snowlit.storage.ObjectStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.util.stream.Stream;

/**
 * Chooses the object store: MinIO when it is fully configured, otherwise a served local directory.
 */
@Configuration
public class StorageConfig implements WebMvcConfigurer {

    private static final Logger LOGGER = LoggerFactory.getLogger(StorageConfig.class);

    private final ObjectStore objectStore;

    public StorageConfig(
            @Value("${minio.endpoint:}") String endpoint,
            @Value("${minio.access-key:}") String accessKey,
            @Value("${minio.secret-key:}") String secretKey,
            @Value("${minio.bucket:}") String bucket,
            @Value("${minio.public-base-url:}") String publicBaseUrl,
            @Value("${storage.local.directory:target/local-uploads}") String localDirectory,
            @Value("${storage.local.public-path:/uploads}") String localPublicPath
    ) {
        if (Stream.of(endpoint, accessKey, secretKey, bucket, publicBaseUrl).noneMatch(String::isBlank)) {
            this.objectStore = new MinioObjectStore(endpoint, accessKey, secretKey, bucket, publicBaseUrl);
        } else {
            LOGGER.warn("MinIO is not fully configured; storing uploads under {}", localDirectory);
            this.objectStore = new LocalDiskObjectStore(Path.of(localDirectory), localPublicPath);
        }
    }

    @Bean
    public ObjectStore objectStore() {
        return objectStore;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        if (objectStore instanceof LocalDiskObjectStore local) {
            registry.addResourceHandler(local.publicPath() + "/**")
                    .addResourceLocations("file:" + local.directory() + "/");
        }
    }
}
