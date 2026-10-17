import { describe, expect, it } from 'vitest';
import {
  ALL_CLOUD_GENERA,
  getSkyProfile,
  type CloudGenus
} from '../profiles/skyProfiles';

const ALL_GENERA: CloudGenus[] = [
  'cumulus',
  'stratus',
  'stratocumulus',
  'cumulonimbus',
  'altocumulus',
  'altostratus',
  'nimbostratus',
  'cirrus',
  'cirrostratus',
  'cirrocumulus'
];

describe('stage 11 sky semantic profile resolver', () => {
  it('publishes all 10 procedural-clouds genera', () => {
    expect(ALL_CLOUD_GENERA).toEqual(ALL_GENERA);
  });

  it('maps clear daylight and night to distinct cloud and celestial semantics', () => {
    const clearDay = getSkyProfile({
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      daylightHint: 'day'
    });
    const clearNight = getSkyProfile({
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const clearTwilight = getSkyProfile({
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      daylightHint: 'unknown'
    });

    expect(clearDay.cloud).toMatchObject({
      enabled: true,
      mood: 'clearDay',
      primary: 'cumulus',
      secondary: 'cirrus',
      silverLiningEligible: true
    });
    expect(clearDay.celestial).toMatchObject({
      enabled: false,
      mode: 'off',
      starVisibility: 0,
      milkyWayVisibility: 0,
      moonVisibility: 0
    });

    expect(clearNight.cloud).toMatchObject({
      mood: 'nightVeil',
      primary: 'cirrus',
      secondary: undefined
    });
    expect(clearNight.cloud.coverage).toBeLessThan(clearDay.cloud.coverage);
    expect(clearNight.celestial).toMatchObject({
      enabled: true,
      mode: 'night',
      milkyWayVisibility: 0.18,
      moonVisibility: 0.45
    });
    expect(clearNight.celestial.starVisibility).toBeGreaterThan(0.8);
    expect(clearNight.preferCelestialDominance).toBe(true);

    expect(clearTwilight.cloud).toMatchObject({
      primary: 'cirrus',
      secondary: 'cirrostratus'
    });
    expect(clearTwilight.celestial.mode).toBe('off');
  });

  it('maps cloudy variants to partly-cloudy and overcast cloud profiles', () => {
    const partlyCloudy = getSkyProfile({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      precipitationKind: 'none',
      daylightHint: 'day'
    });
    const overcast = getSkyProfile({
      weatherState: 'cloudy',
      weatherVariant: 'overcast',
      precipitationKind: 'none',
      daylightHint: 'day'
    });
    const cloudyNight = getSkyProfile({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      precipitationKind: 'none',
      daylightHint: 'night'
    });

    expect(partlyCloudy.cloud).toMatchObject({
      mood: 'partlyCloudy',
      primary: 'cumulus',
      secondary: 'stratocumulus'
    });
    expect(overcast.cloud).toMatchObject({
      mood: 'overcast',
      primary: 'stratus',
      secondary: 'altostratus'
    });
    expect(overcast.cloud.coverage).toBeGreaterThan(partlyCloudy.cloud.coverage);
    expect(overcast.cloud.density).toBeGreaterThan(partlyCloudy.cloud.density);
    expect(partlyCloudy.preferCloudDominance).toBe(true);
    expect(cloudyNight.celestial.mode).toBe('night');
    expect(cloudyNight.celestial.starVisibility).toBeLessThan(clearNightStarVisibility());
  });

  it('maps rain family and storm hail semantics to rain-bearing and storm clouds', () => {
    const drizzle = getSkyProfile({
      weatherState: 'drizzle',
      weatherVariant: 'lightRain',
      precipitationKind: 'rain',
      daylightHint: 'day'
    });
    const rain = getSkyProfile({
      weatherState: 'rain',
      weatherVariant: 'moderateRain',
      precipitationKind: 'rain',
      daylightHint: 'day'
    });
    const heavyRain = getSkyProfile({
      weatherState: 'heavyRain',
      weatherVariant: 'heavyRain',
      precipitationKind: 'rain',
      daylightHint: 'day'
    });
    const hailStorm = getSkyProfile({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      precipitationKind: 'hail',
      daylightHint: 'night'
    });

    expect(drizzle.cloud).toMatchObject({
      mood: 'rainBearing',
      primary: 'stratus',
      secondary: 'nimbostratus'
    });
    expect(rain.cloud).toMatchObject({
      mood: 'rainBearing',
      primary: 'nimbostratus',
      secondary: 'stratus'
    });
    expect(heavyRain.cloud).toMatchObject({
      mood: 'rainBearing',
      primary: 'nimbostratus',
      secondary: 'cumulonimbus'
    });
    expect(heavyRain.cloud.coverage).toBeGreaterThan(rain.cloud.coverage);
    expect(heavyRain.cloud.density).toBeGreaterThan(rain.cloud.density);
    expect(hailStorm.cloud).toMatchObject({
      mood: 'stormTower',
      primary: 'cumulonimbus',
      secondary: 'nimbostratus',
      altitude: 'towering',
      internalLightningEligible: true
    });
    expect(hailStorm.preferWeatherDominance).toBe(true);
    expect(hailStorm.celestial.starVisibility).toBeLessThanOrEqual(0.12);
    expect(hailStorm.celestial.meteorRate).toBe(0);
  });

  it('maps snow family with blizzard as the strongest snow ceiling', () => {
    const lightSnow = getSkyProfile({
      weatherState: 'lightSnow',
      weatherVariant: 'lightSnow',
      precipitationKind: 'snow',
      daylightHint: 'day'
    });
    const snow = getSkyProfile({
      weatherState: 'snow',
      weatherVariant: 'snow',
      precipitationKind: 'snow',
      daylightHint: 'day'
    });
    const blizzard = getSkyProfile({
      weatherState: 'blizzard',
      weatherVariant: 'heavySnow',
      precipitationKind: 'snow',
      daylightHint: 'night'
    });

    expect(lightSnow.cloud).toMatchObject({
      mood: 'snowCeiling',
      primary: 'altostratus',
      secondary: 'cirrostratus'
    });
    expect(snow.cloud).toMatchObject({
      mood: 'snowCeiling',
      primary: 'altostratus',
      secondary: 'nimbostratus'
    });
    expect(blizzard.cloud).toMatchObject({
      mood: 'snowCeiling',
      primary: 'nimbostratus',
      secondary: 'altostratus'
    });
    expect(blizzard.cloud.coverage).toBeGreaterThan(snow.cloud.coverage);
    expect(snow.cloud.coverage).toBeGreaterThan(lightSnow.cloud.coverage);
    expect(blizzard.preferWeatherDominance).toBe(true);
    expect(blizzard.celestial.starVisibility).toBeLessThanOrEqual(0.12);
  });

  it('keeps fog and sandstorm weather-dominant without strong starfield stacking', () => {
    const mist = getSkyProfile({
      weatherState: 'fog',
      weatherVariant: 'mist',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const haze = getSkyProfile({
      weatherState: 'fog',
      weatherVariant: 'haze',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const dust = getSkyProfile({
      weatherState: 'sandstorm',
      weatherVariant: 'dust',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const sandstorm = getSkyProfile({
      weatherState: 'sandstorm',
      weatherVariant: 'sandstorm',
      precipitationKind: 'none',
      daylightHint: 'night'
    });

    expect(mist.cloud).toMatchObject({
      mood: 'fogVeil',
      primary: 'stratus',
      secondary: undefined,
      suppressByWeather: true
    });
    expect(haze.cloud).toMatchObject({
      mood: 'fogVeil',
      primary: 'stratus',
      secondary: 'altostratus',
      suppressByWeather: true
    });
    expect(mist.preferWeatherDominance).toBe(true);
    expect(haze.celestial.starVisibility).toBeLessThanOrEqual(0.12);

    expect(dust.cloud).toMatchObject({
      mood: 'dustSuppressed',
      primary: 'altostratus',
      suppressByWeather: true
    });
    expect(sandstorm.cloud.enabled).toBe(false);
    expect(sandstorm.cloud.opacity).toBeLessThan(dust.cloud.opacity);
    expect(sandstorm.preferWeatherDominance).toBe(true);
    expect(sandstorm.celestial.starVisibility).toBeLessThanOrEqual(0.12);
  });

  it('forces aurora into night-sky semantics and keeps the resolver deterministic', () => {
    const input = {
      weatherState: 'aurora' as const,
      weatherVariant: 'aurora' as const,
      precipitationKind: 'none' as const,
      daylightHint: 'day' as const
    };
    const aurora = getSkyProfile(input);

    expect(aurora.daylight).toBe('night');
    expect(aurora.cloud).toMatchObject({
      mood: 'nightVeil',
      primary: 'cirrus',
      suppressByWeather: true
    });
    expect(aurora.celestial).toMatchObject({
      enabled: true,
      mode: 'aurora',
      starVisibility: 0.7,
      milkyWayVisibility: 0.12,
      moonVisibility: 0.18,
      meteorRate: 0.06,
      auroraIntegration: true
    });
    expect(aurora.preferCelestialDominance).toBe(true);
    expect(getSkyProfile(input)).toEqual(aurora);
  });
});

function clearNightStarVisibility() {
  return getSkyProfile({
    weatherState: 'clear',
    weatherVariant: 'clear',
    precipitationKind: 'none',
    daylightHint: 'night'
  }).celestial.starVisibility;
}
