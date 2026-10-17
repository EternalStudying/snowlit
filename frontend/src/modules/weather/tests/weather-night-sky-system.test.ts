import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState, WeatherRuntimeState } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { WEATHER_NIGHT_SKY_BUDGET } from '../core/weatherPerformanceBudget';
import { getSkyProfile } from '../profiles/skyProfiles';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { NightSkySystem } from '../systems/NightSkySystem';
import { getNightSkyRenderProfile } from '../systems/nightSky/nightSkyProfile';

function fileExists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function methodSource(source: string, methodName: string) {
  const methodStart = source.indexOf(`${methodName}(`);
  const nextMethodStart = source.indexOf('\n  dispose()', methodStart);

  return source.slice(methodStart, nextMethodStart);
}

function systemsAssignmentSource(source: string) {
  const assignmentStart = source.indexOf('this.systems = [');
  const assignmentEnd = source.indexOf('];', assignmentStart);

  return source.slice(assignmentStart, assignmentEnd);
}

const frame = (elapsed = 0.24, delta = 0.16): WeatherFrameState => ({
  elapsed,
  delta,
  pointer: { x: 0.04, y: -0.02 },
  scrollY: 24
});

function renderableCount(root: THREE.Object3D) {
  let count = 0;

  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      count += 1;
    }
  });

  return count;
}

function collectRenderables(root: THREE.Object3D) {
  const renderables: Array<THREE.Mesh | THREE.Points | THREE.LineSegments> = [];

  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      renderables.push(object);
    }
  });

  return renderables;
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

function nightProfileFor(input: Parameters<typeof getWeatherProfile>[0]) {
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

  return { scene, camera, controller, profile };
}

function runtimeFor(input: Parameters<typeof getWeatherProfile>[0]): WeatherRuntimeState {
  return new WeatherController(getWeatherProfile(input)).runtimeState;
}

describe('procedural-starfield stage 14 night sky core system', () => {
  it('maps SkyProfile.celestial into night sky render profiles without backend fields', () => {
    const clearNight = nightProfileFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });
    const clearDay = nightProfileFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const cloudyNight = nightProfileFor({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'night'
    });
    const aurora = nightProfileFor({ weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' });
    const stormNight = nightProfileFor({ weatherState: 'storm', weatherVariant: 'hailStorm', daylightHint: 'night' });
    const fogNight = nightProfileFor({ weatherState: 'fog', weatherVariant: 'haze', daylightHint: 'night' });
    const dustNight = nightProfileFor({ weatherState: 'sandstorm', weatherVariant: 'dust', daylightHint: 'night' });

    expect(clearNight).toMatchObject({
      enabled: true,
      mode: 'night'
    });
    expect(clearNight.starCount).toBeGreaterThanOrEqual(1400);
    expect(clearNight.starCount).toBeLessThanOrEqual(WEATHER_NIGHT_SKY_BUDGET.maxStars);
    expect(clearNight.milkyWayOpacity).toBeGreaterThan(0.08);
    expect(clearNight.moonOpacity).toBeGreaterThan(0.3);
    expect(clearNight.skyOpacity).toBeGreaterThan(0.16);

    expect(clearDay.enabled).toBe(false);
    expect(clearDay.starCount).toBe(0);

    expect(cloudyNight.enabled).toBe(true);
    expect(cloudyNight.starCount).toBeLessThan(clearNight.starCount);
    expect(cloudyNight.milkyWayOpacity).toBeLessThan(clearNight.milkyWayOpacity);

    expect(aurora.enabled).toBe(true);
    expect(aurora.mode).toBe('aurora');
    expect(aurora.starCount).toBeGreaterThanOrEqual(800);
    expect(aurora.starCount).toBeLessThan(clearNight.starCount);
    expect(aurora.milkyWayOpacity).toBeGreaterThan(0);
    expect(aurora.milkyWayOpacity).toBeLessThan(clearNight.milkyWayOpacity);
    expect(aurora.moonOpacity).toBeLessThan(clearNight.moonOpacity);

    [stormNight, fogNight, dustNight].forEach((profile) => {
      expect(profile.enabled).toBe(true);
      expect(profile.starCount).toBeLessThanOrEqual(250);
      expect(profile.milkyWayOpacity).toBe(0);
    });
  });

  it('adds NightSkySystem to WeatherController lifecycle before cloud sky and weather layers', () => {
    const controllerSource = readSource('src/modules/weather/core/WeatherController.ts');

    expect(fileExists('src/modules/weather/systems/NightSkySystem.ts')).toBe(true);
    expect(controllerSource).toContain('NightSkySystem');
    expect(controllerSource).toContain('readonly nightSky');
    expect(controllerSource).toContain('new NightSkySystem(systemContext)');
    expect(controllerSource).toContain('this.nightSky');
    const systemsSource = systemsAssignmentSource(controllerSource);
    expect(systemsSource.indexOf('this.electrical')).toBeLessThan(systemsSource.indexOf('this.nightSky'));
    expect(systemsSource.indexOf('this.nightSky')).toBeLessThan(systemsSource.indexOf('this.cloudSky'));
  });

  it('creates clear night sky resources and suppresses daytime sunny optical layers', async () => {
    const { scene, controller } = createController({
      weatherState: 'clear',
      weatherVariant: 'clear',
      daylightHint: 'night'
    });

    try {
      await waitForObject(scene, 'night-sky-system');
      await waitForObject(scene, 'night-sky-dome');
      await waitForObject(scene, 'night-starfield-system');
      await waitForObject(scene, 'night-milky-way-system');
      await waitForObject(scene, 'night-moon-system');
      controller.update(frame());

      const nightSky = scene.getObjectByName('night-sky-system')!;
      expect(renderableCount(nightSky)).toBeLessThanOrEqual(WEATHER_NIGHT_SKY_BUDGET.maxRenderableMeshes);
      expect(scene.getObjectByName('sunny-optical-system')).toBeUndefined();
      expect(scene.getObjectByName('rainbow-optical-system')).toBeUndefined();

      collectRenderables(nightSky).forEach((object) => {
        expect(object.frustumCulled, object.name).toBe(false);
        const material = object.material as THREE.Material | THREE.Material[];
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((item) => {
          expect(item.transparent, object.name).toBe(true);
          expect(item.depthWrite, object.name).toBe(false);
        });
      });
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('keeps clear day out of NightSkySystem while preserving daytime optical behavior', async () => {
    const { scene, controller } = createController({
      weatherState: 'clear',
      weatherVariant: 'clear',
      daylightHint: 'day'
    });

    try {
      await waitForObject(scene, 'night-sky-system', false);
      await waitForObject(scene, 'sunny-optical-system');
      await waitForObject(scene, 'rainbow-optical-system');

      expect(scene.getObjectByName('night-sky-system')).toBeUndefined();
      expect(scene.getObjectByName('sunny-optical-system')).toBeDefined();
      expect(scene.getObjectByName('rainbow-optical-system')).toBeDefined();
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('weakens cloudy night starfield while allowing cloud sky to coexist above it', async () => {
    const clear = createController({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });
    const cloudy = createController({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'night'
    });

    try {
      await waitForObject(clear.scene, 'night-starfield-system');
      await waitForObject(cloudy.scene, 'night-starfield-system');
      await waitForObject(cloudy.scene, 'cloud-sky-system');

      const clearStars = clear.scene.getObjectByName('night-starfield-system') as THREE.Points;
      const cloudyStars = cloudy.scene.getObjectByName('night-starfield-system') as THREE.Points;

      expect(cloudy.scene.getObjectByName('cloud-sky-system')).toBeDefined();
      expect(cloudyStars.geometry.getAttribute('position').count).toBeLessThan(
        clearStars.geometry.getAttribute('position').count
      );
    } finally {
      clear.controller.dispose();
      cloudy.controller.dispose();
    }
  });

  it('lets aurora use NightSkySystem as the only starfield owner', async () => {
    const { scene, controller } = createController({
      weatherState: 'aurora',
      weatherVariant: 'aurora',
      daylightHint: 'night'
    });

    try {
      await waitForObject(scene, 'night-starfield-system');
      await waitForObject(scene, 'aurora-optical-system');

      expect(scene.getObjectByName('night-sky-system')).toBeDefined();
      expect(scene.getObjectByName('aurora-optical-system')).toBeDefined();
      expect(scene.getObjectByName('aurora-star-field')).toBeUndefined();
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('keeps night sky shader resources system-owned, seeded, transparent, and zero per-star JS update', () => {
    const expectedFiles = [
      'src/modules/weather/systems/NightSkySystem.ts',
      'src/modules/weather/systems/nightSky/NightSkyLayer.ts',
      'src/modules/weather/systems/nightSky/nightSkyProfile.ts',
      'src/modules/weather/systems/nightSky/nightSkyShaders.ts',
      'src/modules/weather/systems/nightSky/SkyDomeLayer.ts',
      'src/modules/weather/systems/nightSky/StarfieldLayer.ts',
      'src/modules/weather/systems/nightSky/MilkyWayLayer.ts',
      'src/modules/weather/systems/nightSky/MoonLayer.ts'
    ];

    expectedFiles.forEach((path) => expect(fileExists(path), path).toBe(true));

    const systemSource = readSource('src/modules/weather/systems/NightSkySystem.ts');
    const layerSource = readSource('src/modules/weather/systems/nightSky/NightSkyLayer.ts');
    const starfieldSource = readSource('src/modules/weather/systems/nightSky/StarfieldLayer.ts');
    const shadersSource = readSource('src/modules/weather/systems/nightSky/nightSkyShaders.ts');
    const moonSource = readSource('src/modules/weather/systems/nightSky/MoonLayer.ts');

    expect(systemSource).toContain("import('./nightSky/NightSkyLayer')");
    expect(systemSource).toContain('warnWeatherLayerLoadFailure');
    expect(layerSource).toContain('night-sky-system');
    expect(layerSource).toContain('SkyDomeLayer');
    expect(layerSource).toContain('StarfieldLayer');
    expect(layerSource).toContain('MilkyWayLayer');
    expect(layerSource).toContain('MoonLayer');

    expect(starfieldSource).toContain('THREE.Points');
    expect(starfieldSource).toContain('aStarData');
    expect(starfieldSource).toContain('blackbodyColor');
    expect(starfieldSource).toContain('seededRandom');
    expect(starfieldSource).toContain('Math.acos(2 * random() - 1)');
    expect(methodSource(starfieldSource, 'update')).not.toContain('for (');
    expect(methodSource(starfieldSource, 'update')).not.toContain('.array');
    expect(moonSource).toContain('night-moon-system');
    expect(moonSource).toContain('night-moon-glow');

    expect(shadersSource).toContain('horizonGlow');
    expect(shadersSource).toContain('centerProtection');
    expect(shadersSource).toContain('gl_PointCoord');
    expect(shadersSource).toContain('fbm');
    expect(shadersSource).toContain('dustLanes');
    expect(shadersSource).not.toContain('uniform sampler2D tScene');
    expect(shadersSource).not.toContain('uniform sampler2D tInput');
    expect(shadersSource).not.toContain('scene.background');
    expect(shadersSource).not.toContain('EffectComposer');
  });

  it('can be instantiated and disposed independently as a system-owned night sky layer', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 6);
    const system = new NightSkySystem({ scene, camera, wind: new WindSystem() });
    const profile = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });

    try {
      system.setProfile(profile);
      await waitForObject(scene, 'night-sky-system');
      system.update(frame(), runtimeFor({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' }));

      expect(scene.getObjectByName('night-sky-system')).toBeDefined();
    } finally {
      system.dispose();
    }
    expect(scene.children).toHaveLength(0);
  });
});
