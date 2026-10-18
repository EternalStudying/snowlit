package xyz.snowlit.diary;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What the backend reads from a diary's Markdown: the title (first level-one heading), a plain-text summary,
 * and the image URLs it references (Markdown or HTML images), in order and without duplicates.
 */
record DiaryMarkdown(String markdown, String title, String summary, List<String> imageUrls) {

    private static final int MAX_TEXT_LENGTH = 120;
    private static final String UNTITLED = "未命名日记";
    private static final Pattern H1 = Pattern.compile("(?m)^#\\s+(.+?)\\s*$");
    private static final Pattern MARKDOWN_IMAGE = Pattern.compile("!\\[[^\\]]*]\\(([^)\\s]+)(?:\\s+\"[^\"]*\")?\\)");
    private static final Pattern HTML_IMAGE = Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);

    static DiaryMarkdown read(String source) {
        String markdown = source.trim();
        return new DiaryMarkdown(markdown, title(markdown), summary(markdown), imageUrls(markdown));
    }

    private static String title(String markdown) {
        Matcher matcher = H1.matcher(markdown);
        if (matcher.find()) {
            String title = plainText(matcher.group(1));
            if (!title.isEmpty()) {
                return truncate(title);
            }
        }
        return UNTITLED;
    }

    private static String summary(String markdown) {
        String withoutImages = MARKDOWN_IMAGE.matcher(markdown).replaceAll("");
        String withoutTitle = withoutImages.replaceAll("(?m)^#\\s+.+$", "");
        return truncate(plainText(withoutTitle));
    }

    private static List<String> imageUrls(String markdown) {
        Set<String> urls = new LinkedHashSet<>();
        Matcher markdownImages = MARKDOWN_IMAGE.matcher(markdown);
        while (markdownImages.find()) {
            urls.add(markdownImages.group(1));
        }
        Matcher htmlImages = HTML_IMAGE.matcher(markdown);
        while (htmlImages.find()) {
            urls.add(htmlImages.group(1));
        }
        return List.copyOf(urls);
    }

    private static String plainText(String source) {
        return source.trim()
                .replaceAll("<[^>]+>", "")
                .replaceAll("\\[[^\\]]+\\]\\([^)]+\\)", "")
                .replaceAll("[*_`~=>#-]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static String truncate(String text) {
        return text.length() <= MAX_TEXT_LENGTH ? text : text.substring(0, MAX_TEXT_LENGTH);
    }
}
