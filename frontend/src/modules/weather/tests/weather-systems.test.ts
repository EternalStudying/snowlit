import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState, WeatherRuntimeState, WeatherSystem } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { AtmosphereSystem } from '../systems/AtmosphereSystem';
import { CloudSkySystem } from '../systems/CloudSkySystem';
import { ElectricalSystem } from '../systems/ElectricalSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { NightSkySystem } from '../systems/NightSkySystem';
import { OpticalSystem } from '../systems/OpticalSystem';
import { PrecipitationSystem } from '../systems/PrecipitationSystem';

const frame = (delta = 0.16): WeatherFrameState => ({
  elapsed: delta,
  delta,
  pointer: { x: 0.1, y: -0.05 },
  scrollY: 48
});

function runtimeFor(weatherState: Parameters<typeof getWeatherProfile>[0]): WeatherRuntimeState {
  return new WeatherController(getWeatherProfile(weatherState)).runtimeState;
}

async function waitForSceneChildren(scene: THREE.Scene, minimumChildren = 1, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (scene.children.length >= minimumChildren) {
      return;
    }

    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
  }

  expect(scene.children.length).toBeGreaterThanOrEqual(minimumChildren);
}

async function expectSystemOwnsDisposableResources(
  createSystem: (context: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; wind: WindSystem }) => WeatherSystem,
  profileInput: Parameters<typeof getWeatherProfile>[0],
  minimumChildren = 1
) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  const wind = new WindSystem();
  const system = createSystem({ scene, camera, wind });
  const profile = getWeatherProfile(profileInput);

  system.setProfile(profile);
  try {
    await waitForSceneChildren(scene, minimumChildren);
    system.update(frame(), runtimeFor(profileInput));
    expect(scene.children.length).toBeGreaterThanOrEqual(minimumChildren);
  } finally {
    system.dispose();
  }

  expect(scene.children).toHaveLength(0);
}

describe('Unified weather systems architecture', () => {
  it('creates and disposes resources through the owning systems', async () => {
    await expectSystemOwnsDisposableResources(
      (context) => new NightSkySystem(context),
      { weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new CloudSkySystem(context),
      { weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'day' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new PrecipitationSystem(context),
      { weatherState: 'rain', weatherVariant: 'moderateRain' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new PrecipitationSystem(context),
      { weatherState: 'snow', weatherVariant: 'snow' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new AtmosphereSystem(context),
      { weatherState: 'fog', weatherVariant: 'mist' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new AtmosphereSystem(context),
      { weatherState: 'sandstorm', weatherVariant: 'dust' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new ElectricalSystem(context),
      { weatherState: 'storm', weatherVariant: 'thunderstorm' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new OpticalSystem(context),
      { weatherState: 'clear', weatherVariant: 'clear' }
    );
    await expectSystemOwnsDisposableResources(
      (context) => new EnvironmentSystem(context),
      { weatherState: 'storm', weatherVariant: 'thunderstorm' }
    );
  });
});
