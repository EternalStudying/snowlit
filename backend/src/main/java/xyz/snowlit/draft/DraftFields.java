package xyz.snowlit.draft;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import xyz.snowlit.failure.ApplicationFailure;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;

/** Validates partial forms without introducing publish-time required fields. */
final class DraftFields {
    private static final Set<String> ALBUM = Set.of("title", "description", "eventDate", "location", "visibility", "pinned");
    private static final Set<String> DIARY = Set.of("contentMarkdown", "date", "moodKey", "visibility", "weatherSnapshot");
    private static final Set<String> MOMENT = Set.of("title", "content", "eventTime", "endTime", "locationName", "address", "longitude", "latitude", "category");
    private static final Set<String> WEATHER = Set.of("weather", "rawWeather", "temperature", "windDirection", "windPower", "humidity", "province", "city", "district", "locationName", "latitude", "longitude");
    private DraftFields() {}

    static String validate(ObjectMapper json, DraftKind kind, JsonNode fields) {
        keys(fields, switch (kind) {
            case ALBUM -> ALBUM; case DIARY -> DIARY; case MOMENT -> MOMENT;
            case ALBUM_EDIT -> throw new IllegalArgumentException("Edit drafts have no client fields");
        });
        switch (kind) {
            case ALBUM -> {
                text(fields, "title", 120); text(fields, "description", 500); text(fields, "location", 120);
                date(fields, "eventDate", false); enumeration(fields, "visibility", Set.of("public", "private"));
                if (present(fields, "pinned") && !fields.get("pinned").isBoolean()) throw invalid();
            }
            case DIARY -> {
                text(fields, "contentMarkdown", 60000); date(fields, "date", false);
                enumeration(fields, "moodKey", Set.of("happy", "miss", "calm", "wronged", "expecting", "tired", "sweet", "secret", "angry", "touched"));
                enumeration(fields, "visibility", Set.of("shared", "private"));
                if (present(fields, "weatherSnapshot")) {
                    JsonNode weather = fields.get("weatherSnapshot");
                    keys(weather, WEATHER);
                    for (String key : WEATHER) {
                        if (Set.of("temperature", "latitude", "longitude").contains(key)) number(weather, key);
                        else text(weather, key, key.equals("locationName") ? 120 : 80);
                    }
                }
            }
            case MOMENT -> {
                text(fields, "title", 160); text(fields, "content", 65535);
                text(fields, "locationName", 160); text(fields, "address", 300);
                date(fields, "eventTime", true); date(fields, "endTime", true);
                number(fields, "longitude"); number(fields, "latitude");
                enumeration(fields, "category", Set.of("daily", "date", "travel", "anniversary", "surprise"));
            }
        }
        try {
            String serialized = json.writeValueAsString(fields);
            bytes(serialized);
            return serialized;
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) { throw invalid(); }
    }

    private static void keys(JsonNode node, Set<String> allowed) {
        if (node == null || !node.isObject()) throw invalid();
        node.fieldNames().forEachRemaining(key -> { if (!allowed.contains(key)) throw invalid(); });
    }

    private static boolean present(JsonNode node, String key) { return node.hasNonNull(key); }

    private static void text(JsonNode node, String key, int max) {
        if (!present(node, key)) return;
        JsonNode value = node.get(key);
        if (!value.isTextual() || value.textValue().codePointCount(0, value.textValue().length()) > max) throw invalid();
        bytes(value.textValue());
    }

    private static void bytes(String value) {
        if (value.getBytes(StandardCharsets.UTF_8).length > 65535) throw invalid();
    }

    private static void enumeration(JsonNode node, String key, Set<String> values) {
        if (present(node, key) && (!node.get(key).isTextual() || !values.contains(node.get(key).textValue()))) throw invalid();
    }

    private static void number(JsonNode node, String key) {
        if (present(node, key) && (!node.get(key).isNumber() || !Double.isFinite(node.get(key).doubleValue()))) throw invalid();
    }

    private static void date(JsonNode node, String key, boolean time) {
        if (!present(node, key)) return;
        if (!node.get(key).isTextual()) throw invalid();
        String value = node.get(key).textValue();
        try {
            if (time) { if (!value.matches("\\d{4}-\\d{2}-\\d{2}T.*")) throw invalid(); LocalDateTime.parse(value); }
            else { if (!value.matches("\\d{4}-\\d{2}-\\d{2}")) throw invalid(); LocalDate.parse(value); }
        } catch (java.time.DateTimeException exception) { throw invalid(); }
    }

    static ApplicationFailure invalid() { return ApplicationFailure.invalidInput("DRAFT_FIELDS_INVALID", "草稿内容不正确，请检查后重试"); }
}
