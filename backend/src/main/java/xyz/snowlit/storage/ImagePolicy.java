package xyz.snowlit.storage;

import java.util.Set;

/**
 * What one business flow accepts as an image, where it is stored, and how each rejection is reported.
 *
 * @param keyPrefix   first segment of every object key
 * @param datedKeys   whether keys insert year/month after the prefix
 * @param formats     accepted formats, detected from file content
 * @param maxBytes    largest accepted file size
 * @param missing     reported for an empty upload
 * @param wrongType   reported when the content is not an accepted format
 * @param tooLarge    reported (HTTP 413) when the file exceeds maxBytes
 * @param storeFailed reported when the object store cannot write or delete
 */
public record ImagePolicy(
        String keyPrefix,
        boolean datedKeys,
        Set<ImageFormat> formats,
        long maxBytes,
        Rejection missing,
        Rejection wrongType,
        Rejection tooLarge,
        Rejection storeFailed
) {

    public static final long TEN_MEGABYTES = 10L * 1024L * 1024L;

    public record Rejection(String code, String message) {
    }

    /**
     * Any supported format up to 10MB, reported with {@code <codePrefix>_IMAGE_*} codes.
     */
    public static ImagePolicy standard(String codePrefix, String keyPrefix, boolean datedKeys, String uploadFailedMessage) {
        Rejection wrongType = new Rejection(codePrefix + "_IMAGE_TYPE_INVALID", "只支持 jpg、png、webp、gif 图片");
        return new ImagePolicy(
                keyPrefix,
                datedKeys,
                Set.of(ImageFormat.values()),
                TEN_MEGABYTES,
                wrongType,
                wrongType,
                new Rejection(codePrefix + "_IMAGE_TOO_LARGE", "单张图片不能超过 10MB"),
                new Rejection(codePrefix + "_IMAGE_UPLOAD_FAILED", uploadFailedMessage)
        );
    }
}
