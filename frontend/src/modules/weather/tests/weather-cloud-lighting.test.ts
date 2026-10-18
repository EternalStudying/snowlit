import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { WeatherFrameState } from '../core/types';
import { WeatherController } from '../core/WeatherController';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { getSkyProfile } from '../profiles/skyProfiles';
import { getCloudLightingProfile } from '../systems/clouds/cloudLightingProfile';

const frame = (elapsed = 0.24, delta = 0.16): WeatherFrameState => ({
  elapsed,
  delta,
  pointer: { x: 0.04, y: -0.02 },
  scrollY: 24
});

function lightingFor(input: Parameters<typeof getWeatherProfile>[0]) {
  const profile = getWeatherProfile(input);
  const skyProfile = getSkyProfile({
    weatherState: profile.weatherState,
    weatherVariant: profile.weatherVariant,
    precipitationKind: profile.precipitationKind,
    daylightHint: profile.daylightHint ?? 'unknown'
  });

  return {
    profile,
    skyProfile,
    lighting: getCloudLightingProfile(profile, skyProfile)
  };
}

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

function firstCloudMaterial(scene: THREE.Scene) {
  const group = scene.getObjectByName('cloud-sky-system');
  let material: THREE.ShaderMaterial | null = null;

  group?.traverse((object) => {
    if (!material && object instanceof THREE.Mesh && object.name.startsWith('cloud-sky-')) {
      material = object.material as THREE.ShaderMaterial;
    }
  });

  expect(material).toBeDefined();
  return material!;
}

describe('procedural-weather stage 13 cloud lighting and weather integration', () => {
  it('maps weather, cloud, and daylight semantics to cloud lighting parameters', () => {
    const clearDay = lightingFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const partlyDay = lightingFor({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'day' });
    const overcastDay = lightingFor({ weatherState: 'cloudy', weatherVariant: 'overcast', daylightHint: 'day' });
    const heavyRain = lightingFor({ weatherState: 'heavyRain', weatherVariant: 'heavyRain', daylightHint: 'day' });
    const storm = lightingFor({ weatherState: 'storm', weatherVariant: 'hailStorm', daylightHint: 'day' });
    const snow = lightingFor({ weatherState: 'snow', weatherVariant: 'snow', daylightHint: 'day' });
    const fog = lightingFor({ weatherState: 'fog', weatherVariant: 'haze', daylightHint: 'day' });
    const dust = lightingFor({ weatherState: 'sandstorm', weatherVariant: 'dust', daylightHint: 'day' });
    const aurora = lightingFor({ weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' });
    const cloudyNight = lightingFor({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'night' });

    expect(clearDay.lighting.silverLining).toBeGreaterThan(0.25);
    expect(clearDay.lighting.forwardScatter).toBeGreaterThan(0.25);

    expect(partlyDay.lighting.silverLining).toBeGreaterThan(overcastDay.lighting.silverLining);
    expect(overcastDay.lighting.baseDarkening).toBeGreaterThan(partlyDay.lighting.baseDarkening);

    expect(heavyRain.lighting.forwardScatter).toBeLessThan(partlyDay.lighting.forwardScatter);
    expect(heavyRain.lighting.contrast).toBeLessThan(partlyDay.lighting.contrast);
    expect(storm.lighting.internalLightSensitivity).toBeGreaterThan(0.75);
    expect(snow.lighting.shadowColor[2]).toBeGreaterThan(snow.lighting.shadowColor[0]);
    expect(fog.lighting.contrast).toBeLessThan(0.58);
    expect(dust.lighting.cloudTint[0]).toBeGreaterThan(dust.lighting.cloudTint[2]);
    expect(aurora.lighting.daylightBlend).toBeLessThan(0.15);
    expect(cloudyNight.lighting.cloudTint[2]).toBeGreaterThan(cloudyNight.lighting.cloudTint[0]);
  });

  it('keeps dghez cloudy mesh independent from god rays while storm flash no longer creates clouds', async () => {
    const cloudy = new THREE.Scene();
    const storm = new THREE.Scene();
    const cloudyCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const stormCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    cloudyCamera.position.set(0, 0, 6);
    stormCamera.position.set(0, 0, 6);

    const cloudyController = new WeatherController(
      getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'day' }),
      new WindSystem(),
      { scene: cloudy, camera: cloudyCamera }
    );
    const stormController = new WeatherController(
      getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'day' }),
      new WindSystem(),
      { scene: storm, camera: stormCamera }
    );

    try {
      await waitForObject(cloudy, 'cloud-sky-system');
      await waitForObject(storm, 'storm-lightning-system');

      cloudyController.update(frame(0.4));
      stormController.update(frame(0.4));

      expect(cloudy.getObjectByName('cloud-god-ray-system')).toBeUndefined();
      expect(storm.getObjectByName('cloud-god-ray-system')).toBeUndefined();
      expect(storm.getObjectByName('cloud-sky-system')).toBeUndefined();

      const cloudyMaterial = firstCloudMaterial(cloudy);
      expect(cloudyMaterial.uniforms.internalLight).toBeUndefined();

      const lightningLayer = (
        stormController.electrical as unknown as { layers: { get(key: string): { strike(value: number): void } } }
      ).layers.get('storm-lightning');
      lightningLayer.strike(1);
      stormController.update(frame(0.56, 0.16));

      expect(stormController.visualSignals.stormFlash).toBeGreaterThan(0);
      expect(storm.getObjectByName('cloud-sky-system')).toBeUndefined();
      expect(cloudyMaterial.uniforms.internalLight).toBeUndefined();
    } finally {
      cloudyController.dispose();
      stormController.dispose();
    }

    expect(cloudy.children).toHaveLength(0);
    expect(storm.children).toHaveLength(0);
  });
});
