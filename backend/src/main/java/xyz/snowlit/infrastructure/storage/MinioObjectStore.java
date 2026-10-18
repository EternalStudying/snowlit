package xyz.snowlit.infrastructure.storage;

import xyz.snowlit.text.Text;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectStore;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public final class MinioObjectStore implements ObjectStore {

    private final String endpoint;
    private final String accessKey;
    private final String secretKey;
    private final String bucket;
    private final String publicBaseUrl;

    public MinioObjectStore(
            @Value("${minio.endpoint:}") String endpoint,
            @Value("${minio.access-key:}") String accessKey,
            @Value("${minio.secret-key:}") String secretKey,
            @Value("${minio.bucket:}") String bucket,
            @Value("${minio.public-base-url:}") String publicBaseUrl
    ) {
        this.endpoint = Text.trim(endpoint);
        this.accessKey = Text.trim(accessKey);
        this.secretKey = Text.trim(secretKey);
        this.bucket = Text.trim(bucket);
        this.publicBaseUrl = Text.trim(publicBaseUrl).replaceAll("/+$", "");
    }

    @Override
    public StoredObject put(MultipartFile file, String objectName) {
        requireConfigured();
        String contentType = Text.trim(file.getContentType());
        try {
            MinioClient client = client();
            ensureBucket(client);
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .contentType(contentType)
                    .stream(file.getInputStream(), file.getSize(), -1L)
                    .build());
            return new StoredObject(
                    objectName,
                    publicBaseUrl + "/" + objectName,
                    contentType,
                    file.getSize()
            );
        } catch (Exception exception) {
            throw ApplicationFailure.dependencyFailure(
                    "OBJECT_STORE_WRITE_FAILED",
                    "对象存储写入失败，请稍后重试",
                    exception
            );
        }
    }

    @Override
    public void delete(String objectName) {
        if (objectName == null || objectName.isBlank()) {
            return;
        }
        requireConfigured();
        try {
            client().removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .build());
        } catch (Exception exception) {
            throw ApplicationFailure.dependencyFailure(
                    "OBJECT_STORE_DELETE_FAILED",
                    "对象存储清理失败，请稍后重试",
                    exception
            );
        }
    }

    @Override
    public boolean isConfigured() {
        return !endpoint.isBlank()
                && !accessKey.isBlank()
                && !secretKey.isBlank()
                && !bucket.isBlank()
                && !publicBaseUrl.isBlank();
    }

    private MinioClient client() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }

    private void ensureBucket(MinioClient client) {
        try {
            if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
        } catch (Exception ignored) {
            // Some deployments allow object writes but not bucket administration.
        }
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw ApplicationFailure.dependencyFailure(
                    "OBJECT_STORE_NOT_CONFIGURED",
                    "对象存储尚未配置",
                    null
            );
        }
    }
}
