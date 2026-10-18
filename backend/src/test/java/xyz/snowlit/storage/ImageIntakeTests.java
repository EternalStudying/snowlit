package xyz.snowlit.storage;

import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.support.InMemoryObjectStore;
import xyz.snowlit.support.TestImages;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageIntakeTests {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-05-17T04:00:00Z"), ZoneId.of("UTC"));
    private static final ImagePolicy STANDARD = ImagePolicy.standard("STORY", "story", true, "图片上传失败，请稍后重试");

    private final InMemoryObjectStore objects = new InMemoryObjectStore();
    private final ImageIntake intake = new ImageIntake(objects, CLOCK);

    @Test
    void detectsEveryFormatFromContentAndStoresWithDetectedTypeAndExtension() {
        intake.store(TestImages.jpeg("file", "a.jpg"), STANDARD, 1L);
        intake.store(TestImages.png("file", "a.png"), STANDARD, 1L);
        intake.store(TestImages.webp("file", "a.webp"), STANDARD, 1L);
        intake.store(TestImages.gif("file", "a.gif"), STANDARD, 1L);

        assertThat(objects.stored()).extracting(ObjectStore.StoredObject::contentType)
                .containsExactly("image/jpeg", "image/png", "image/webp", "image/gif");
        assertThat(objects.stored()).extracting(ObjectStore.StoredObject::objectName)
                .allSatisfy(name -> assertThat(name).matches("story/2026/05/1/[0-9a-f-]+\\.(jpg|png|webp|gif)"));
    }

    @Test
    void acceptsWeChatFilesWithoutExtensionOrWithGenericType() {
        MockMultipartFile png = TestImages.png("file", "tmp");
        MockMultipartFile generic = new MockMultipartFile("file", "tmp", "application/octet-stream", readBytes(png));

        ObjectStore.StoredObject stored = intake.store(generic, STANDARD, 1L);

        assertThat(stored.contentType()).isEqualTo("image/png");
        assertThat(stored.objectName()).endsWith(".png");
    }

    @Test
    void rejectsNonImagesEvenWhenClientClaimsAnImageType() {
        MockMultipartFile disguised = new MockMultipartFile("file", "a.jpg", "image/jpeg", "not an image".getBytes());

        assertRejected(() -> intake.store(disguised, STANDARD, 1L), "STORY_IMAGE_TYPE_INVALID", ApplicationFailure.Kind.INVALID_INPUT);
        assertThat(objects.stored()).isEmpty();
    }

    @Test
    void reportsEmptyAndOversizedFilesWithPolicyCodes() {
        MockMultipartFile empty = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);
        MockMultipartFile huge = TestImages.pngOfSize("file", "a.png", (int) ImagePolicy.TEN_MEGABYTES + 1);

        assertRejected(() -> intake.verify(empty, STANDARD), "STORY_IMAGE_TYPE_INVALID", ApplicationFailure.Kind.INVALID_INPUT);
        assertRejected(() -> intake.verify(huge, STANDARD), "STORY_IMAGE_TOO_LARGE", ApplicationFailure.Kind.PAYLOAD_TOO_LARGE);
    }

    @Test
    void restrictsFormatsToThePolicy() {
        ImagePolicy webpOnly = new ImagePolicy(
                "album", false, Set.of(ImageFormat.WEBP), ImagePolicy.TEN_MEGABYTES,
                STANDARD.missing(), new ImagePolicy.Rejection("ALBUM_PREVIEW_TYPE_INVALID", "预览图必须是 WebP"),
                STANDARD.tooLarge(), STANDARD.storeFailed()
        );

        assertThat(intake.verify(TestImages.webp("preview", "p.webp"), webpOnly)).isEqualTo(ImageFormat.WEBP);
        assertRejected(() -> intake.verify(TestImages.jpeg("preview", "p.webp"), webpOnly),
                "ALBUM_PREVIEW_TYPE_INVALID", ApplicationFailure.Kind.INVALID_INPUT);
    }

    @Test
    void translatesStoreFailuresIntoThePolicyFailure() {
        objects.becomeUnavailable();

        assertRejected(() -> intake.store(TestImages.png("file", "a.png"), STANDARD, 1L),
                "STORY_IMAGE_UPLOAD_FAILED", ApplicationFailure.Kind.DEPENDENCY_FAILURE);
        assertRejected(() -> intake.delete("story/a.png", STANDARD),
                "STORY_IMAGE_UPLOAD_FAILED", ApplicationFailure.Kind.DEPENDENCY_FAILURE);
        assertThatCode(() -> intake.deleteBestEffort("story/a.png")).doesNotThrowAnyException();
    }

    @Test
    void bestEffortDeleteSkipsRecordsWithoutStoredObject() {
        intake.deleteBestEffort(null);

        assertThat(objects.deleted()).isEmpty();
    }

    private static void assertRejected(Runnable action, String code, ApplicationFailure.Kind kind) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApplicationFailure.class, failure -> {
            assertThat(failure.code()).isEqualTo(code);
            assertThat(failure.kind()).isEqualTo(kind);
        });
    }

    private static byte[] readBytes(MockMultipartFile file) {
        try {
            return file.getBytes();
        } catch (java.io.IOException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
