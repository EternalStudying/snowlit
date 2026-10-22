package xyz.snowlit.draft;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public final class DraftDtos {
    private DraftDtos() {}
    public record SaveDto(JsonNode fields) {}
    public record PublishDto(JsonNode fields, String privatePassword, List<String> imageOrder) {}
    public record ImageOrderDto(List<String> ids) {}
}
