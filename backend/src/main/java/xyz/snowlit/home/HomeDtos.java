package xyz.snowlit.home;

public final class HomeDtos {

    private HomeDtos() {
    }

    public record HomeLocationUpdateDto(
            Double latitude,
            Double longitude,
            String city,
            String district,
            String province,
            String country,
            String weather,
            Double temperature
    ) {
    }
}
