import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_CLOUD_GENERA, getSkyProfile } from '../profiles/skyProfiles';
import {
  CLOUD_LAYER_PROFILES,
  WEATHER_CLOUD_BUDGET,
  getCloudLayerProfile
} from '../systems/clouds/cloudLayerProfiles';

function fileExists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('procedural-clouds stage 12 cloud profiles', () => {
  it('declares layer profiles for all ten procedural cloud genera', () => {
    expect(fileExists('src/modules/weather/systems/clouds/cloudLayerProfiles.ts')).toBe(true);
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
    const profileSource = readSource('src/modules/weather/systems/clouds/cloudLayerProfiles.ts');

    expect(getCloudLayerProfile('cumulonimbus')).toMatchObject({
      altitudeBand: 'towering'
    });
    expect(getCloudLayerProfile('cirrus')).toMatchObject({
      altitudeBand: 'high'
    });
    expect(getCloudLayerProfile('stratus')).toMatchObject({
      altitudeBand: 'low'
    });
    expect(profileSource).not.toContain('renderStyle');
    expect(profileSource).not.toContain('instanceCount');
    expect(profileSource).not.toContain('verticalBias');
    expect(profileSource).not.toContain('flatBase');
  });

  it('uses a faithful dghez cloud shader and plane mesh instead of old instanced strips', () => {
    const shaderSource = readSource('src/modules/weather/systems/clouds/cloudShaders.ts');
    const layerSource = readSource('src/modules/weather/systems/clouds/CloudSkyLayer.ts');

    expect(shaderSource).toContain('uTxtShape');
    expect(shaderSource).toContain('uTxtCloudNoise');
    expect(shaderSource).toContain('uDisplStrenght1');
    expect(shaderSource).toContain('uDisplStrenght2');
    expect(shaderSource).toContain('fbm3d');
    expect(shaderSource).toContain('snoise3');
    expect(shaderSource).toContain('levels');
    expect(shaderSource).toContain('vec3(0.95, 0.95, 0.95)');
    expect(layerSource).toContain('PlaneGeometry(1, 1, 5, 5)');
    expect(layerSource).toContain('cloud-sky-system');
    expect(layerSource).toContain('depthWrite: false');
    expect(layerSource).toContain('frustumCulled = false');
    expect(layerSource).not.toContain('InstancedBufferGeometry');
  });
});
