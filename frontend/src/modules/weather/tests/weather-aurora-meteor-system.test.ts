import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { WEATHER_METEOR_BUDGET } from '../core/weatherPerformanceBudget';
import { getSkyProfile } from '../profiles/skyProfiles';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { getNightSkyRenderProfile } from '../systems/nightSky/nightSkyProfile';

function absolute(path: string) {
  return resolve(process.cwd(), path);
}

function fileExists(path: string) {
  return existsSync(absolute(path));
}

function readSource(path: string) {
  return readFileSync(absolute(path), 'utf8');
}

const frame = (elapsed = 0.24, delta = 0.16): WeatherFrameState => ({
  elapsed,
  delta,
  pointer: { x: 0.03, y: -0.02 },
  scrollY: 18
});

async function waitForObject(scene: THREE.Scene, name: string, expectPresent = true, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const object = scene.getObjectByName(name);

    if (expectPresent ? Boolean(object) : !object) {
      return object;
    }

    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
  }

  const object = scene.getObjectByName(name);
  if (expectPresent) {
    expect(object, name).toBeDefined();
  } else {
    expect(object, name).toBeUndefined();
  }
  return object;
}

function renderProfileFor(input: Parameters<typeof getWeatherProfile>[0]) {
  const weatherProfile = getWeatherProfile(input);
  const skyProfile = getSkyProfile({
    weatherState: weatherProfile.weatherState,
    weatherVariant: weatherProfile.weatherVariant,
    precipitationKind: weatherProfile.precipitationKind,
    daylightHint: weatherProfile.daylightHint ?? 'unknown'
  });

  return getNightSkyRenderProfile(weatherProfile, skyProfile);
}

function createController(input: Parameters<typeof getWeatherProfile>[0]) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 6);
  const profile = getWeatherProfile(input);
  const controller = new WeatherController(profile, new WindSystem(), { scene, camera });

  return { scene, controller };
}

describe('procedural-weather stage 15 aurora and meteor night sky enhancement', () => {
  it('maps meteor rates only to clear night and aurora, with shower override kept scoped', () => {
    const clearNight = renderProfileFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });
    const clearDay = renderProfileFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const clearShower = renderProfileFor({
      weatherState: 'clear',
      weatherVariant: 'clear',
      daylightHint: 'night',
      meteorShower: true
    });
    const aurora = renderProfileFor({ weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' });
    const auroraShower = renderProfileFor({
      weatherState: 'aurora',
      weatherVariant: 'aurora',
      daylightHint: 'night',
      meteorShower: true
    });
    const cloudyNight = renderProfileFor({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'night'
    });
    const stormNight = renderProfileFor({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'night' });
    const fogNight = renderProfileFor({ weatherState: 'fog', weatherVariant: 'mist', daylightHint: 'night' });
    const stormShower = renderProfileFor({
      weatherState: 'storm',
      weatherVariant: 'thunderstorm',
      daylightHint: 'night',
      meteorShower: true
    });

    expect(clearNight.meteorRate).toBeGreaterThan(0);
    expect(clearNight.meteorMaxActive).toBe(2);
    expect(clearNight.meteorShower).toBe(false);
    expect(clearDay.meteorRate).toBe(0);

    expect(clearShower.meteorShower).toBe(true);
    expect(clearShower.meteorRate).toBeGreaterThan(clearNight.meteorRate * 6);
    expect(clearShower.meteorMaxActive).toBe(WEATHER_METEOR_BUDGET.maxActiveMeteors);

    expect(aurora.meteorRate).toBeGreaterThan(0);
    expect(aurora.auroraBlend).toBeGreaterThan(0);
    expect(aurora.starOpacity).toBeLessThan(clearNight.starOpacity);
    expect(aurora.milkyWayOpacity).toBeGreaterThan(0);
    expect(aurora.milkyWayOpacity).toBeLessThan(clearNight.milkyWayOpacity);
    expect(aurora.moonOpacity).toBeLessThan(clearNight.moonOpacity);
    expect(auroraShower.meteorRate).toBeGreaterThan(aurora.meteorRate * 5);

    [cloudyNight, stormNight, fogNight, stormShower].forEach((profile) => {
      expect(profile.meteorRate).toBe(0);
      expect(profile.meteorMaxActive).toBe(0);
      expect(profile.meteorShower).toBe(false);
    });
  });

  it('creates MeteorLayer as a NightSkySystem-owned child and disposes it on strong-weather switch', async () => {
    const { scene, controller } = createController({
      weatherState: 'clear',
      weatherVariant: 'clear',
      daylightHint: 'night',
      meteorShower: true
    });

    try {
      await waitForObject(scene, 'night-sky-system');
      await waitForObject(scene, 'night-meteor-system');
      controller.update(frame(0.32, 0.16));

      const meteorGroup = scene.getObjectByName('night-meteor-system')!;
      const meteorRenderables = meteorGroup.children.filter(
        (child) => child instanceof THREE.LineSegments || child instanceof THREE.Points
      );

      expect(meteorGroup.parent?.name).toBe('night-sky-system');
      expect(meteorRenderables).toHaveLength(2);
      expect(scene.getObjectByName('night-meteor-trail-pool')).toBeDefined();
      expect(scene.getObjectByName('night-meteor-head-pool')).toBeDefined();

      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'night' })
      );
      await waitForObject(scene, 'night-meteor-system', false);
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('keeps meteor resources pooled, capped, transparent, and free of independent timers', () => {
    expect(fileExists('src/modules/weather/systems/nightSky/MeteorLayer.ts')).toBe(true);
    expect(fileExists('src/modules/weather/systems/nightSky/meteorShaders.ts')).toBe(true);

    const profileSource = readSource('src/modules/weather/systems/nightSky/nightSkyProfile.ts');
    const layerSource = readSource('src/modules/weather/systems/nightSky/NightSkyLayer.ts');
    const meteorSource = readSource('src/modules/weather/systems/nightSky/MeteorLayer.ts');
    const shaderSource = readSource('src/modules/weather/systems/nightSky/meteorShaders.ts');
    const atmosphereSource = readSource('src/modules/weather/WeatherAtmosphere.vue');
    const auroraSource = readSource('src/modules/weather/systems/optical/AuroraOpticalLayer.ts');

    expect(profileSource).toContain('meteorRate');
    expect(profileSource).toContain('meteorShower');
    expect(profileSource).toContain('auroraBlend');
    expect(layerSource).toContain('MeteorLayer');
    expect(layerSource).toContain('profile.meteorRate > 0');

    expect(meteorSource).toContain('WEATHER_METEOR_BUDGET.maxActiveMeteors');
    expect(meteorSource).toContain('LineSegments');
    expect(meteorSource).toContain('Points');
    expect(meteorSource).toContain('night-meteor-system');
    expect(meteorSource).toContain('night-meteor-trail-pool');
    expect(meteorSource).toContain('night-meteor-head-pool');
    expect(meteorSource).toContain('depthWrite: false');
    expect(meteorSource).toContain('frustumCulled = false');
    expect(meteorSource).toContain('dispose()');
    expect(meteorSource).toContain('geometry.dispose()');
    expect(meteorSource).toContain('material.dispose()');
    expect(meteorSource).not.toContain('setInterval');
    expect(meteorSource).not.toContain('setTimeout');

    const updateStart = meteorSource.indexOf('update(frame');
    const disposeStart = meteorSource.indexOf('dispose()', updateStart);
    const updateSource = meteorSource.slice(updateStart, disposeStart);
    expect(updateSource).not.toContain('new THREE');
    expect(updateSource).not.toContain('new Float32Array');

    expect(shaderSource).toContain('gl_PointCoord');
    expect(shaderSource).toContain('vAlpha');
    expect(shaderSource).not.toContain('uniform sampler2D tScene');
    expect(shaderSource).not.toContain('uniform sampler2D tInput');

    expect(atmosphereSource).not.toContain("params.get('meteor')");
    expect(atmosphereSource).not.toContain('meteorShowerOverride');
    expect(atmosphereSource).not.toContain("meteor !== 'shower'");
    expect(auroraSource).not.toContain('aurora-star-field');
  });
});
