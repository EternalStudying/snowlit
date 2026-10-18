import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile } from '../profiles/weatherProfiles';

const frame = (elapsed = 0.24, delta = 0.16): WeatherFrameState => ({
  elapsed,
  delta,
  pointer: { x: 0.03, y: -0.02 },
  scrollY: 18
});

function createController(input: Parameters<typeof getWeatherProfile>[0]) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 6);
  const profile = getWeatherProfile(input);
  const controller = new WeatherController(profile, new WindSystem(), { scene, camera });
  controller.transitionSpeed = 1;

  return { scene, camera, controller, profile };
}

async function waitForObject(scene: THREE.Scene, name: string, expectPresent = true, timeoutMs = 1800) {
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

async function settle(controller: WeatherController, scene: THREE.Scene, finalStateName?: string) {
  for (let index = 0; index < 8; index += 1) {
    controller.update(frame(1 + index, 1));
    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));

    if (!finalStateName || controller.targetProfile.weatherState === finalStateName) {
      if (controller.transitionProgress >= 1) {
        return scene;
      }
    }
  }

  return scene;
}

function sceneObjects(scene: THREE.Scene, name: string) {
  const matches: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (object.name === name) {
      matches.push(object);
    }
  });
  return matches;
}

describe('procedural-weather stage 16 unified system orchestration', () => {
  it('adds orchestration to controller runtime and interpolates day/night visibility', () => {
    const { controller } = createController({
      weatherState: 'clear',
      weatherVariant: 'clear',
      daylightHint: 'day'
    });

    try {
      expect(controller.runtimeState.orchestration).toMatchObject({
        dominance: 'clearDay',
        nightSkyVisibility: 0
      });
      expect(controller.runtimeState.orchestration.sunnyOpticalVisibility).toBeGreaterThan(0.8);

      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' })
      );
      const runtime = controller.update(frame(0.5, 0.5));

      expect(runtime.orchestration.sunnyOpticalVisibility).toBeGreaterThan(0.1);
      expect(runtime.orchestration.sunnyOpticalVisibility).toBeLessThan(0.8);
      expect(runtime.orchestration.nightSkyVisibility).toBeGreaterThan(0.2);
      expect(runtime.orchestration.nightSkyVisibility).toBeLessThan(0.8);
    } finally {
      controller.dispose();
    }
  });

  it('keeps cloudy day to night on one cloud-sky-system while night sky remains behind cloud occlusion', async () => {
    const { scene, controller } = createController({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'day'
    });

    try {
      const dayCloud = await waitForObject(scene, 'cloud-sky-system');
      controller.setWeatherProfile(
        getWeatherProfile({
          weatherState: 'cloudy',
          weatherVariant: 'partlyCloudy',
          daylightHint: 'night'
        })
      );
      await waitForObject(scene, 'cloud-sky-system');
      controller.update(frame(0.4, 0.4));

      expect(sceneObjects(scene, 'cloud-sky-system')).toHaveLength(1);
      expect(scene.getObjectByName('cloud-sky-system')).toBe(dayCloud);
      expect(controller.runtimeState.orchestration.cloudVisibility).toBeGreaterThan(
        controller.runtimeState.orchestration.nightSkyVisibility
      );
      expect(controller.runtimeState.orchestration.cloudOcclusion).toBeGreaterThan(0.45);
    } finally {
      controller.dispose();
    }
  });

  it('fades aurora out toward clear night without losing the night-sky-system', async () => {
    const { scene, controller } = createController({
      weatherState: 'aurora',
      weatherVariant: 'aurora',
      daylightHint: 'night'
    });

    try {
      await waitForObject(scene, 'night-sky-system');
      await waitForObject(scene, 'aurora-optical-system');

      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' })
      );
      controller.update(frame(0.35, 0.35));
      expect(controller.runtimeState.orchestration.auroraVisibility).toBeGreaterThan(0);
      expect(scene.getObjectByName('night-sky-system')).toBeDefined();

      await settle(controller, scene, 'clear');
      await waitForObject(scene, 'aurora-optical-system', false);
      expect(scene.getObjectByName('night-sky-system')).toBeDefined();
      expect(controller.runtimeState.orchestration.dominance).toBe('celestial');
    } finally {
      controller.dispose();
    }
  });

  it('lets storm clear to the requested night profile and removes lightning without permanent sky suppression', async () => {
    const { scene, controller } = createController({
      weatherState: 'storm',
      weatherVariant: 'thunderstorm',
      daylightHint: 'night'
    });

    try {
      await waitForObject(scene, 'storm-lightning-system');
      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' })
      );
      await settle(controller, scene, 'clear');
      await waitForObject(scene, 'storm-lightning-system', false);
      await waitForObject(scene, 'night-sky-system');

      expect(controller.targetProfile).toMatchObject({
        weatherState: 'clear',
        daylightHint: 'night'
      });
      expect(controller.runtimeState.orchestration.nightSkyVisibility).toBeGreaterThan(0.8);
      expect(controller.runtimeState.orchestration.electricalVisibility).toBe(0);
    } finally {
      controller.dispose();
    }
  });

  it('keeps fog and sandstorm atmosphere visually dominant over cloud and night sky', async () => {
    const fog = createController({ weatherState: 'fog', weatherVariant: 'haze', daylightHint: 'night' });
    const sandstorm = createController({ weatherState: 'sandstorm', weatherVariant: 'sandstorm', daylightHint: 'night' });

    try {
      await waitForObject(fog.scene, 'fog-atmosphere-system');
      await waitForObject(sandstorm.scene, 'dust-atmosphere-system');
      fog.controller.update(frame());
      sandstorm.controller.update(frame());

      expect(fog.controller.runtimeState.orchestration.atmosphereVisibility).toBeGreaterThan(0.8);
      expect(fog.controller.runtimeState.orchestration.cloudVisibility).toBeLessThan(0.25);
      expect(fog.controller.runtimeState.orchestration.nightSkyVisibility).toBeLessThan(0.2);
      expect(sandstorm.controller.runtimeState.orchestration.atmosphereVisibility).toBeGreaterThan(0.85);
      expect(sandstorm.controller.runtimeState.orchestration.cloudVisibility).toBeLessThan(0.1);
      expect(sandstorm.controller.runtimeState.orchestration.nightSkyVisibility).toBeLessThan(0.08);
    } finally {
      fog.controller.dispose();
      sandstorm.controller.dispose();
    }
  });

  it('does not leave duplicate sky, cloud, or aurora groups after rapid switches', async () => {
    const { scene, controller } = createController({
      weatherState: 'clear',
      weatherVariant: 'clear',
      daylightHint: 'day'
    });

    try {
      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' })
      );
      controller.update(frame(0.2, 0.2));
      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' })
      );
      controller.update(frame(0.4, 0.2));
      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'night' })
      );
      controller.update(frame(0.6, 0.2));
      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' })
      );
      await settle(controller, scene, 'clear');

      expect(sceneObjects(scene, 'night-sky-system').length).toBeLessThanOrEqual(1);
      expect(sceneObjects(scene, 'cloud-sky-system').length).toBeLessThanOrEqual(1);
      expect(sceneObjects(scene, 'aurora-optical-system').length).toBeLessThanOrEqual(1);
    } finally {
      controller.dispose();
    }
  });
});
