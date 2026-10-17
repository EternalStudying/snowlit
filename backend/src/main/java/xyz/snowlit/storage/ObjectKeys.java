package xyz.snowlit.storage;

import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;

public final class ObjectKeys {

    private ObjectKeys() {
    }

    public static String dated(String prefix, Long userId, MultipartFile file) {
        LocalDate today = LocalDate.now();
        return random(
                prefix,
                file,
                Integer.toString(today.getYear()),
                "%02d".formatted(today.getMonthValue()),
                userId
        );
    }

    public static String random(String prefix, MultipartFile file, Object... segments) {
        String path = Arrays.stream(segments)
                .map(String::valueOf)
                .map(ObjectKeys::trimSlashes)
                .filter(segment -> !segment.isBlank())
                .collect(Collectors.joining("/"));
        String base = trimSlashes(prefix);
        if (!path.isBlank()) {
            base = base + "/" + path;
        }
        return base + "/" + UUID.randomUUID() + "." + extension(file);
    }

    private static String extension(MultipartFile file) {
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().trim().toLowerCase();
        int dot = filename.lastIndexOf('.');
        return dot >= 0 && dot < filename.length() - 1 ? filename.substring(dot + 1) : "jpg";
    }

    private static String trimSlashes(String value) {
        return value == null ? "" : value.trim().replaceAll("^/+", "").replaceAll("/+$", "");
    }
}
