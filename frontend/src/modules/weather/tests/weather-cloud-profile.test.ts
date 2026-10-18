import { describe, expect, it } from 'vitest';
import { ALL_CLOUD_GENERA, getSkyProfile } from '../profiles/skyProfiles';
import { CLOUD_LAYER_PROFILES, WEATHER_CLOUD_BUDGET, getCloudLayerProfile } from '../systems/clouds/cloudLayerProfiles';

describe('procedural-clouds stage 12 cloud profiles', () => {
  it('declares layer profiles for all ten procedural cloud genera', () => {
    expect(Object.keys(CLOUD_LAYER_PROFILES).sort()).toEqual([...ALL_CLOUD_GENERA].sort());
    expect(WEATHER_CLOUD_BUDGET).toMatchObject({
      maxRenderableMeshes: 7,
      maxGeneraPerSky: 2
    });
  });

  it('keeps profile parameters as semantic opacity and coverage hints only', () => {
    ALL_CLOUD_GENERA.forEach((genus) => {
      const profile = getCloudLayerProfile(genus);

      expect(profile.genus).toBe(genus);
      expect(profile.altitudeBand).toMatch(/^(low|mid|high|towering)$/);
      expect(profile.coverage).toBeGreaterThanOrEqual(0);
      expect(profile.coverage).toBeLessThanOrEqual(1);
      expect(profile.density).toBeGreaterThanOrEqual(0);
      expect(profile.density).toBeLessThanOrEqual(1);
      expect(profile.opacity).toBeGreaterThanOrEqual(0);
      expect(profile.opacity).toBeLessThanOrEqual(1);
      expect(profile.driftSpeed).toBeGreaterThanOrEqual(0);
      expect(profile.morphSpeed).toBeGreaterThanOrEqual(0);
    });
  });

  it('maps stage 11 sky semantics to concrete cloud layer profiles', () => {
    const cases = [
      { weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day', expected: ['cumulus', 'cirrus'] },
      {
        weatherState: 'cloudy',
        weatherVariant: 'partlyCloudy',
        daylightHint: 'day',
        expected: ['cumulus', 'stratocumulus']
      },
      { weatherState: 'cloudy', weatherVariant: 'overcast', daylightHint: 'day', expected: ['stratus', 'altostratus'] },
      { weatherState: 'rain', weatherVariant: 'moderateRain', daylightHint: 'day', expected: ['nimbostratus', 'stratus'] },
      {
        weatherState: 'heavyRain',
        weatherVariant: 'heavyRain',
        daylightHint: 'day',
        expected: ['nimbostratus', 'cumulonimbus']
      },
      {
        weatherState: 'storm',
        weatherVariant: 'thunderstorm',
        daylightHint: 'day',
        expected: ['cumulonimbus', 'nimbostratus']
      },
      { weatherState: 'snow', weatherVariant: 'snow', daylightHint: 'day', expected: ['altostratus', 'nimbostratus'] },
      {
        weatherState: 'blizzard',
        weatherVariant: 'heavySnow',
        daylightHint: 'day',
        expected: ['nimbostratus', 'altostratus']
      },
      { weatherState: 'fog', weatherVariant: 'mist', daylightHint: 'day', expected: ['stratus'] },
      { weatherState: 'sandstorm', weatherVariant: 'dust', daylightHint: 'day', expected: ['altostratus'] },
      { weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night', expected: ['cirrus'] }
    ] as const;

    cases.forEach((input) => {
      const sky = getSkyProfile({
        weatherState: input.weatherState,
        weatherVariant: input.weatherVariant,
        precipitationKind: 'none',
        daylightHint: input.daylightHint
      });
      const genera = [sky.cloud.primary, sky.cloud.secondary].filter(Boolean);

      expect(genera).toEqual(input.expected);
      genera.forEach((genus) => expect(getCloudLayerProfile(genus!)).toBeDefined());
    });
  });

  it('keeps altitude semantics without preserving old shape or instance layout controls', () => {
    expect(getCloudLayerProfile('cumulonimbus')).toMatchObject({
      altitudeBand: 'towering'
    });
    expect(getCloudLayerProfile('cirrus')).toMatchObject({
      altitudeBand: 'high'
    });
    expect(getCloudLayerProfile('stratus')).toMatchObject({
      altitudeBand: 'low'
    });
  });
});
