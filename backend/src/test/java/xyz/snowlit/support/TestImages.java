package xyz.snowlit.support;

import org.springframework.mock.web.MockMultipartFile;

import java.util.Arrays;

/**
 * Multipart files whose content starts with real image signatures.
 */
public final class TestImages {

    private static final byte[] JPEG = {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0, 0x10};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 0x24, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '};
    private static final byte[] GIF = {'G', 'I', 'F', '8', '9', 'a'};

    private TestImages() {
    }

    public static MockMultipartFile jpeg(String part, String filename) {
        return new MockMultipartFile(part, filename, "image/jpeg", JPEG);
    }

    public static MockMultipartFile png(String part, String filename) {
        return new MockMultipartFile(part, filename, "image/png", PNG);
    }

    public static MockMultipartFile webp(String part, String filename) {
        return new MockMultipartFile(part, filename, "image/webp", WEBP);
    }

    public static MockMultipartFile gif(String part, String filename) {
        return new MockMultipartFile(part, filename, "image/gif", GIF);
    }

    public static MockMultipartFile text(String part, String filename) {
        return new MockMultipartFile(part, filename, "text/plain", "plain text".getBytes());
    }

    /**
     * A PNG padded to the given size.
     */
    public static MockMultipartFile pngOfSize(String part, String filename, int size) {
        byte[] content = Arrays.copyOf(PNG, size);
        return new MockMultipartFile(part, filename, "image/png", content);
    }
}
