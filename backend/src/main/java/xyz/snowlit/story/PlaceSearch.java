package xyz.snowlit.story;

import java.util.List;
import java.util.Optional;

/**
 * Finds places by name anywhere in the world. Coordinates are WGS84 as the provider returns them.
 */
public interface PlaceSearch {

    /** Matching places, best first; empty when the provider is unavailable or not configured. */
    Optional<List<FoundPlace>> search(String text);

    record FoundPlace(String name, String address, double latitude, double longitude, String countryCode) {
    }
}
