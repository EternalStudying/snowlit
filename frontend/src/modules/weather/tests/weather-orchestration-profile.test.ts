import { describe, expect, it } from 'vitest';
import {
  blendWeatherOrchestration,
  getWeatherOrchestrationProfile,
  ORCHESTRATION_NUMERIC_FIELDS
} from '../core/weatherOrchestrationProfile';
import { getSkyProfile } from '../profiles/skyProfiles';
import { getWeatherProfile } from '../profiles/weatherProfiles';

function orchestrationFor(input: Parameters<typeof getWeatherProfile>[0]) {
  const weatherProfile = getWeatherProfile(input);
  const skyProfile = getSkyProfile({
    weatherState: weatherProfile.weatherState,
    weatherVariant: weatherProfile.weatherVariant,
    precipitationKind: weatherProfile.precipitationKind,
    daylightHint: weatherProfile.daylightHint ?? 'unknown'
  });

  return getWeatherOrchestrationProfile(weatherProfile, skyProfile);
}

describe('procedural-weather stage 16 unified sky orchestration profile', () => {
  it('maps clear day and clear night into opposing sunny and celestial priorities', () => {
    const clearDay = orchestrationFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const clearNight = orchestrationFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });

    expect(clearDay).toMatchObject({
      dominance: 'clearDay',
      nightSkyVisibility: 0,
      auroraVisibility: 0
    });
    expect(clearDay.sunnyOpticalVisibility).toBeGreaterThan(0.8);
    expect(clearDay.cloudVisibility).toBeGreaterThan(0);
    expect(clearDay.cloudVisibility).toBeLessThan(0.5);

    expect(clearNight).toMatchObject({
      dominance: 'celestial',
      sunnyOpticalVisibility: 0,
      auroraVisibility: 0
    });
    expect(clearNight.nightSkyVisibility).toBeGreaterThan(0.8);
    expect(clearNight.starVisibilityMultiplier).toBeGreaterThan(0.75);
    expect(clearNight.meteorVisibilityMultiplier).toBeGreaterThan(0);
  });

  it('keeps cloudy night cloud-led and prevents meteor shower behavior behind clouds', () => {
    const cloudyNight = orchestrationFor({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'night'
    });

    expect(cloudyNight.dominance).toBe('cloud');
    expect(cloudyNight.cloudVisibility).toBeGreaterThan(cloudyNight.nightSkyVisibility);
    expect(cloudyNight.cloudOcclusion).toBeGreaterThan(0.45);
    expect(cloudyNight.starVisibilityMultiplier).toBeLessThan(0.5);
    expect(cloudyNight.milkyWayVisibilityMultiplier).toBeLessThan(0.25);
    expect(cloudyNight.meteorVisibilityMultiplier).toBe(0);
  });

  it('suppresses night sky and sunny optical under strong weather while preserving primary atmosphere', () => {
    const rain = orchestrationFor({ weatherState: 'rain', weatherVariant: 'moderateRain', daylightHint: 'night' });
    const storm = orchestrationFor({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'night' });
    const fog = orchestrationFor({ weatherState: 'fog', weatherVariant: 'haze', daylightHint: 'night' });
    const sandstorm = orchestrationFor({
      weatherState: 'sandstorm',
      weatherVariant: 'sandstorm',
      daylightHint: 'night'
    });

    [rain, storm, fog, sandstorm].forEach((profile) => {
      expect(profile.dominance).toBe('weather');
      expect(profile.weatherDominance).toBeGreaterThan(0.6);
      expect(profile.sunnyOpticalVisibility).toBe(0);
      expect(profile.nightSkyVisibility).toBeLessThanOrEqual(0.22);
      expect(profile.meteorVisibilityMultiplier).toBe(0);
      expect(profile.atmosphereVisibility).toBeGreaterThan(0.65);
    });
    expect(storm.electricalVisibility).toBeGreaterThan(0.7);
    expect(fog.cloudVisibility).toBeLessThan(0.25);
    expect(sandstorm.cloudVisibility).toBeLessThan(0.1);
  });

  it('lets aurora dominate while keeping a weak night sky behind it', () => {
    const aurora = orchestrationFor({ weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' });

    expect(aurora.dominance).toBe('aurora');
    expect(aurora.auroraVisibility).toBeGreaterThan(0.85);
    expect(aurora.nightSkyVisibility).toBeGreaterThan(0.35);
    expect(aurora.nightSkyVisibility).toBeLessThan(aurora.auroraVisibility);
    expect(aurora.starVisibilityMultiplier).toBeLessThan(0.7);
    expect(aurora.milkyWayVisibilityMultiplier).toBeLessThan(0.6);
    expect(aurora.sunnyOpticalVisibility).toBe(0);
  });

  it('keeps all numeric orchestration fields clamped and blends them linearly', () => {
    const day = orchestrationFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const night = orchestrationFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });
    const halfway = blendWeatherOrchestration(day, night, 0.5);

    ORCHESTRATION_NUMERIC_FIELDS.forEach((field) => {
      expect(day[field], `day.${field}`).toBeGreaterThanOrEqual(0);
      expect(day[field], `day.${field}`).toBeLessThanOrEqual(1);
      expect(night[field], `night.${field}`).toBeGreaterThanOrEqual(0);
      expect(night[field], `night.${field}`).toBeLessThanOrEqual(1);
      expect(halfway[field], `halfway.${field}`).toBeCloseTo((day[field] + night[field]) / 2, 5);
    });

    expect(blendWeatherOrchestration(day, night, 0).dominance).toBe(day.dominance);
    expect(blendWeatherOrchestration(day, night, 1).dominance).toBe(night.dominance);
    expect(halfway.retainCurrentLayersDuringTransition).toBe(true);
  });
});
