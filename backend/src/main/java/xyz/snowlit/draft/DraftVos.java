package xyz.snowlit.draft;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class DraftVos {
    private DraftVos() {}
    public record CurrentDraftVo(DraftVo draft) {}
    public record DraftVo(String kind, JsonNode fields, List<DraftImageVo> images,
                          LocalDateTime createdAt, LocalDateTime updatedAt) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DraftImageVo(String id, String url, Integer width, Integer height,
                               LocalDate takenAt, String location, String caption, String originalUrl) {}
}
