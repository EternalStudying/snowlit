package xyz.snowlit.storage;

import java.util.Optional;

/**
 * Image formats recognised from their leading bytes; client-supplied MIME types and file names are not trusted.
 */
public enum ImageFormat {
    JPEG("jpg", "image/jpeg"),
    PNG("png", "image/png"),
    WEBP("webp", "image/webp"),
    GIF("gif", "image/gif");

    static final int HEADER_LENGTH = 12;

    private final String extension;
    private final String contentType;

    ImageFormat(String extension, String contentType) {
        this.extension = extension;
        this.contentType = contentType;
    }

    public String extension() {
        return extension;
    }

    public String contentType() {
        return contentType;
    }

    static Optional<ImageFormat> detect(byte[] header, int length) {
        if (length >= 3 && unsigned(header[0]) == 0xff && unsigned(header[1]) == 0xd8 && unsigned(header[2]) == 0xff) {
            return Optional.of(JPEG);
        }
        if (length >= 4 && unsigned(header[0]) == 0x89 && header[1] == 'P' && header[2] == 'N' && header[3] == 'G') {
            return Optional.of(PNG);
        }
        if (length >= 3 && header[0] == 'G' && header[1] == 'I' && header[2] == 'F') {
            return Optional.of(GIF);
        }
        if (length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P') {
            return Optional.of(WEBP);
        }
        return Optional.empty();
    }

    private static int unsigned(byte value) {
        return value & 0xff;
    }
}
