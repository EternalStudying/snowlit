package xyz.snowlit.infrastructure.places;

import xyz.snowlit.story.PlaceSearch;
import xyz.snowlit.text.Text;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Worldwide place search through Geoapify, using the same key and base URL as reverse geocoding.
 * Only the search text is sent; no member location leaves the server.
 */
@Component
public final class GeoapifyPlaceSearch implements PlaceSearch {

    private static final String DEFAULT_BASE_URL = "https://api.geoapify.com";
    private static final int LIMIT = 8;

    private final RestClient client;
    private final String baseUrl;
    private final String key;

    @Autowired
    public GeoapifyPlaceSearch(RestClient.Builder builder,
            @Value("${geoapify.key:}") String key,
            @Value("${geoapify.base-url:https://api.geoapify.com}") String baseUrl) {
        this(configuredClient(builder), key, baseUrl);
    }

    GeoapifyPlaceSearch(RestClient client, String key, String baseUrl) {
        this.client = client;
        String trimmed = Text.trim(baseUrl);
        this.baseUrl = (trimmed.isBlank() ? DEFAULT_BASE_URL : trimmed).replaceAll("/+$", "");
        this.key = Text.trim(key);
    }

    private static RestClient configuredClient(RestClient.Builder builder) {
        var httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(5));
        return builder.clone().requestFactory(factory).build();
    }

    @Override
    public Optional<List<FoundPlace>> search(String text) {
        if (key.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode response = client.get()
                    .uri(baseUrl + "/v1/geocode/search?text={text}&format=json&lang=zh&limit={limit}&apiKey={key}",
                            text, LIMIT, key)
                    .retrieve().body(JsonNode.class);
            JsonNode results = response == null ? null : response.get("results");
            if (results == null || !results.isArray()) {
                return Optional.of(List.of());
            }
            List<FoundPlace> places = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            for (JsonNode result : results) {
                Double latitude = number(result, "lat");
                Double longitude = number(result, "lon");
                if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
                    continue;
                }
                String name = firstText(result, "name", "address_line1", "formatted");
                String address = firstText(result, "address_line2", "formatted");
                if (name.isBlank() || !seen.add(name + "\n" + address)) {
                    continue;
                }
                places.add(new FoundPlace(name, address.equals(name) ? "" : address, latitude, longitude,
                        text(result, "country_code")));
            }
            return Optional.of(places);
        } catch (RuntimeException ex) {
            // Provider errors may include URLs with credentials; never log the exception or URL.
            return Optional.empty();
        }
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (!value.isBlank()) {
                // OSM names may contain simplified/traditional aliases separated by semicolons.
                return java.util.Arrays.stream(value.split("[;；]"))
                        .map(String::trim).filter(name -> !name.isBlank()).findFirst().orElse("");
            }
        }
        return "";
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? Text.trim(value.asText()) : "";
    }

    private static Double number(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isNumber() && Double.isFinite(value.asDouble()) ? value.asDouble() : null;
    }
}
