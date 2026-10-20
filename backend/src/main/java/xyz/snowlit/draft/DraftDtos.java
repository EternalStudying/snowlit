package xyz.snowlit.draft;

import com.fasterxml.jackson.databind.JsonNode;

public final class DraftDtos {
    private DraftDtos() {}
    public record SaveDto(JsonNode fields) {}
    public record PublishDto(JsonNode fields, String privatePassword) {}
}
