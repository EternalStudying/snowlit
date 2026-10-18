package xyz.snowlit.text;

/**
 * Normalizes optional user-entered text: absent values become blank, surrounding whitespace is dropped.
 */
public final class Text {

    private Text() {
    }

    public static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public static String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed.isEmpty() ? null : trimmed;
    }
}
