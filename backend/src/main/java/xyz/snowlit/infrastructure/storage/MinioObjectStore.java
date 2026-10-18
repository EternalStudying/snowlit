package xyz.snowlit.infrastructure.storage;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.ObjectStore;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.web.multipart.MultipartFile;

/**
 * Stores objects in a MinIO/S3 bucket and serves them from its public base URL.
 */
public final class MinioObjectStore implements ObjectStore {

    private final MinioClient client;
    private final String bucket;
    private final String publicBaseUrl;

    public MinioObjectStore(String endpoint, String accessKey, String secretKey, String bucket, String publicBaseUrl) {
        this.client = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    @Override
    public StoredObject put(MultipartFile file, String objectName, String contentType) {
        try {
            ensureBucket();
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .contentType(contentType)
                    .stream(file.getInputStream(), file.getSize(), -1L)
                    .build());
            return new StoredObject(objectName, publicBaseUrl + "/" + objectName, contentType, file.getSize());
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
        try {
            client.removeObject(RemoveObjectArgs.builder()
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

    private void ensureBucket() {
        try {
            if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
        } catch (Exception ignored) {
            // Some deployments allow object writes but not bucket administration.
        }
    }
}
