package xyz.snowlit.home;

import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Each member's last reported location and weather, looked up by couple role.
 */
@Service
public class MemberLocations {

    private final HomeMapper homeMapper;

    public MemberLocations(HomeMapper homeMapper) {
        this.homeMapper = homeMapper;
    }

    public Optional<HomeLocation> of(String coupleRole) {
        return Optional.ofNullable(homeMapper.findLocationByRole(coupleRole));
    }

    public void save(HomeLocation location) {
        homeMapper.upsertLocation(location);
    }
}
