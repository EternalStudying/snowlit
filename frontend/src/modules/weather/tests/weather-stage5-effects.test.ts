import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystem } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile, getWeatherRenderMode } from '../profiles/weatherProfiles';

import { ElectricalSystem } from '../systems/ElectricalSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { OpticalSystem } from '../systems/OpticalSystem';

const frame = (delta = 0.16): WeatherFrameState => ({
  elapsed: delta,
  delta,
  pointer: { x: 0.12, y: -0.06 },
  scrollY: 64
});

function runtimeFor(input: Parameters<typeof getWeatherProfile>[0]): WeatherRuntimeState {
  return new WeatherController(getWeatherProfile(input)).runtimeState;
}

async function waitForNamedSceneChild(scene: THREE.Scene, childName: string, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (scene.children.some((child) => child.name === childName)) {
      return;
    }

    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
  }

  expect(scene.children.map((child) => child.name)).toContain(childName);
}

async function expectSystemLayer(
  createSystem: (context: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; wind: WindSystem }) => WeatherSystem,
  profileInput: Parameters<typeof getWeatherProfile>[0],
  expectedChildName: string
) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  const wind = new WindSystem();
  const system = createSystem({ scene, camera, wind });
  const profile = getWeatherProfile(profileInput);

  system.setProfile(profile);
  try {
    await waitForNamedSceneChild(scene, expectedChildName);
    system.update(frame(), runtimeFor(profileInput));
    expect(scene.children.some((child) => child.name === expectedChildName)).toBe(true);
  } finally {
    system.dispose();
  }

  expect(scene.children).toHaveLength(0);
}

describe('procedural-weather stage 5 effects', () => {
  it('adds cloudy and aurora Three render modes with the same desktop gates', () => {
    expect(getWeatherRenderMode({ weatherState: 'cloudy', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-cloudy'
    );
    expect(getWeatherRenderMode({ weatherState: 'cloudy', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'cloudy', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
  });

  it('maps stage 5 variants without adding backend render-strength fields', () => {
    const partlyCloudy = getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy' });
    const overcast = getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'overcast' });
    const hailStorm = getWeatherProfile({ weatherState: 'storm', weatherVariant: 'hailStorm' });

    expect(partlyCloudy).toMatchObject({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      renderer: 'three-cloudy',
    });
    expect(overcast).toMatchObject({
      weatherState: 'cloudy',
      weatherVariant: 'overcast',
      renderer: 'three-cloudy',
    });
    expect(overcast.particleIntensity).toBeGreaterThan(partlyCloudy.particleIntensity);
  });

  it('creates and disposes new stage 5 layers through owning systems', async () => {
    await expectSystemLayer(
      (context) => new OpticalSystem(context),
      { weatherState: 'rain', weatherVariant: 'moderateRain' },
      'wet-lens-optical-system'
    );
    await expectSystemLayer(
      (context) => new EnvironmentSystem(context),
      { weatherState: 'rain', weatherVariant: 'moderateRain' },
      'wet-surface-environment-system'
    );
    await expectSystemLayer(
      (context) => new ElectricalSystem(context),
      { weatherState: 'sandstorm', weatherVariant: 'sandstorm' },
      'dust-lightning-electrical-system'
    );
  });
});
