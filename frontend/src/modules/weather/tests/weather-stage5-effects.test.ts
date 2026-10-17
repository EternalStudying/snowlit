import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystem } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile, getWeatherRenderMode } from '../profiles/weatherProfiles';
import { CloudSkySystem } from '../systems/CloudSkySystem';
import { ElectricalSystem } from '../systems/ElectricalSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { OpticalSystem } from '../systems/OpticalSystem';
import { PrecipitationSystem } from '../systems/PrecipitationSystem';

function fileExists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function readSource(path: string) {
  const absolutePath = resolve(process.cwd(), path);

  return fileExists(path) ? readFileSync(absolutePath, 'utf8') : '';
}

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
    const coreTypes = readSource('src/modules/weather/core/types.ts');
    const weatherAtmosphere = readSource('src/modules/weather/WeatherAtmosphere.vue');

    expect(coreTypes).toContain("'three-cloudy'");
    expect(coreTypes).toContain("'three-aurora'");
    expect(weatherAtmosphere).toContain("renderMode === 'three-cloudy'");
    expect(weatherAtmosphere).toContain("renderMode === 'three-aurora'");
    expect(getWeatherRenderMode({ weatherState: 'cloudy', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-cloudy'
    );
    expect(getWeatherRenderMode({ weatherState: 'cloudy', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'cloudy', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'aurora', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-aurora'
    );
    expect(getWeatherRenderMode({ weatherState: 'aurora', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'aurora', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
  });

  it('maps stage 5 variants without adding backend render-strength fields', () => {
    const partlyCloudy = getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy' });
    const overcast = getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'overcast' });
    const hailStorm = getWeatherProfile({ weatherState: 'storm', weatherVariant: 'hailStorm' });
    const hailKind = getWeatherProfile({
      weatherState: 'rain',
      weatherVariant: 'moderateRain',
      precipitationKind: 'hail'
    });
    const aurora = getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora' });
    const frontendTypes = readSource('src/modules/weather/model.ts');
    const coreTypes = readSource('src/modules/weather/core/types.ts');

    expect(partlyCloudy).toMatchObject({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      renderer: 'three-cloudy',
      legacyKind: 'cloudy'
    });
    expect(overcast).toMatchObject({
      weatherState: 'cloudy',
      weatherVariant: 'overcast',
      renderer: 'three-cloudy',
      legacyKind: 'cloudy'
    });
    expect(overcast.particleIntensity).toBeGreaterThan(partlyCloudy.particleIntensity);
    expect(hailStorm).toMatchObject({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      renderer: 'three-storm',
      precipitationKind: 'hail'
    });
    expect(hailKind).toMatchObject({
      weatherState: 'rain',
      renderer: 'three-rain',
      precipitationKind: 'hail'
    });
    expect(aurora).toMatchObject({
      weatherState: 'aurora',
      weatherVariant: 'aurora',
      renderer: 'three-aurora',
      legacyKind: 'night'
    });
    expect(frontendTypes).not.toContain('wetLensLevel');
    expect(frontendTypes).not.toContain('frostLevel');
    expect(frontendTypes).not.toContain('splashLevel');
    expect(coreTypes).toContain('precipitationKind?: PrecipitationKind');
  });

  it('lazy-loads cloudy and aurora thin adapters without moving resources back to scenes', () => {
    const layerSource = readSource('src/modules/weather/components/ThreeWeatherLayer.vue');
    const cloudyScene = readSource('src/modules/weather/effects/cloudy/CloudyWeatherScene.ts');
    const auroraScene = readSource('src/modules/weather/effects/aurora/AuroraWeatherScene.ts');

    expect(fileExists('src/modules/weather/effects/cloudy/CloudyWeatherScene.ts')).toBe(true);
    expect(fileExists('src/modules/weather/effects/aurora/AuroraWeatherScene.ts')).toBe(true);
    expect(fileExists('src/modules/weather/effects/aurora/auroraShaders.ts')).toBe(true);
    expect(layerSource).toContain("import('../effects/cloudy/CloudyWeatherScene')");
    expect(layerSource).toContain("import('../effects/aurora/AuroraWeatherScene')");
    expect(layerSource).toContain('props.weather.precipitationKind');

    [cloudyScene, auroraScene].forEach((source) => {
      expect(source).toContain('setProfile(profile: WeatherProfile)');
      expect(source).toContain('update(_frame: WeatherFrameState, _runtime: WeatherRuntimeState)');
      expect(source).toContain('dispose()');
      expect(source).not.toContain('new THREE.ShaderMaterial');
      expect(source).not.toContain('new THREE.BufferGeometry');
      expect(source).not.toContain('new THREE.PlaneGeometry');
    });
  });

  it('declares every new stage 5 system-owned layer and shader', () => {
    const expectedFiles = [
      'src/modules/weather/systems/CloudSkySystem.ts',
      'src/modules/weather/systems/clouds/CloudSkyLayer.ts',
      'src/modules/weather/systems/clouds/cloudLayerProfiles.ts',
      'src/modules/weather/systems/clouds/cloudShaders.ts',
      'src/modules/weather/systems/precipitation/HailPrecipitationLayer.ts',
      'src/modules/weather/systems/precipitation/RainSplashLayer.ts',
      'src/modules/weather/systems/optical/WetLensOverlayLayer.ts',
      'src/modules/weather/systems/optical/FrostOverlayLayer.ts',
      'src/modules/weather/systems/optical/AuroraOpticalLayer.ts',
      'src/modules/weather/systems/optical/RainbowOpticalLayer.ts',
      'src/modules/weather/systems/environment/WetSurfaceLayer.ts',
      'src/modules/weather/systems/environment/SnowAccumulationLayer.ts',
      'src/modules/weather/systems/environment/SandstormTintLayer.ts',
      'src/modules/weather/systems/electrical/DustLightningLayer.ts',
      'src/modules/weather/effects/hail/hailShaders.ts',
      'src/modules/weather/effects/rain/rainSplashShaders.ts',
      'src/modules/weather/effects/optical/wetLensShaders.ts',
      'src/modules/weather/effects/optical/frostShaders.ts',
      'src/modules/weather/effects/optical/rainbowShaders.ts',
      'src/modules/weather/effects/environment/wetSurfaceShaders.ts',
      'src/modules/weather/effects/environment/snowAccumulationShaders.ts',
      'src/modules/weather/effects/environment/sandstormTintShaders.ts'
    ];

    expectedFiles.forEach((path) => expect(fileExists(path), path).toBe(true));

    expect(readSource('src/modules/weather/systems/PrecipitationSystem.ts')).toContain('RainSplashLayer');
    expect(readSource('src/modules/weather/systems/PrecipitationSystem.ts')).toContain('HailPrecipitationLayer');
    expect(readSource('src/modules/weather/systems/CloudSkySystem.ts')).toContain('CloudSkyLayer');
    expect(readSource('src/modules/weather/systems/CloudSkySystem.ts')).toContain('getSkyProfile');
    expect(readSource('src/modules/weather/systems/OpticalSystem.ts')).toContain('WetLensOverlayLayer');
    expect(readSource('src/modules/weather/systems/OpticalSystem.ts')).toContain('FrostOverlayLayer');
    expect(readSource('src/modules/weather/systems/OpticalSystem.ts')).toContain('AuroraOpticalLayer');
    expect(readSource('src/modules/weather/systems/OpticalSystem.ts')).toContain('RainbowOpticalLayer');
    expect(readSource('src/modules/weather/systems/EnvironmentSystem.ts')).toContain('WetSurfaceLayer');
    expect(readSource('src/modules/weather/systems/EnvironmentSystem.ts')).toContain('SnowAccumulationLayer');
    expect(readSource('src/modules/weather/systems/EnvironmentSystem.ts')).toContain('SandstormTintLayer');
    expect(readSource('src/modules/weather/systems/ElectricalSystem.ts')).toContain('DustLightningLayer');
  });

  it('keeps shader-heavy resources in system layers with disposal', () => {
    const cloud = readSource('src/modules/weather/systems/clouds/CloudSkyLayer.ts');
    const hail = readSource('src/modules/weather/systems/precipitation/HailPrecipitationLayer.ts');
    const splash = readSource('src/modules/weather/systems/precipitation/RainSplashLayer.ts');
    const splashShader = readSource('src/modules/weather/effects/rain/rainSplashShaders.ts');
    const wetLens = readSource('src/modules/weather/systems/optical/WetLensOverlayLayer.ts');
    const frost = readSource('src/modules/weather/systems/optical/FrostOverlayLayer.ts');
    const aurora = readSource('src/modules/weather/systems/optical/AuroraOpticalLayer.ts');
    const rainbow = readSource('src/modules/weather/systems/optical/RainbowOpticalLayer.ts');
    const wetSurface = readSource('src/modules/weather/systems/environment/WetSurfaceLayer.ts');
    const accumulation = readSource('src/modules/weather/systems/environment/SnowAccumulationLayer.ts');
    const tint = readSource('src/modules/weather/systems/environment/SandstormTintLayer.ts');
    const dustLightning = readSource('src/modules/weather/systems/electrical/DustLightningLayer.ts');
    const sunny = readSource('src/modules/weather/systems/optical/SunnyOpticalLayer.ts');

    expect(cloud).toContain('PlaneGeometry(1, 1, 5, 5)');
    expect(cloud).toContain('cloud-sky-system');
    expect(cloud).toContain('cloudSkyFragmentShader');
    expect(cloud).toContain('uTxtShape');
    expect(cloud).toContain('dispose()');
    expect(hail).toContain('Points');
    expect(hail).toContain('aSeed');
    expect(hail).toContain('hailVertexShader');
    expect(hail).toContain('windForce');
    expect(hail).toContain('depthWrite: false');
    expect(hail).toContain('frustumCulled = false');
    expect(splash).toContain('rainSplashFragmentShader');
    expect(splashShader).toContain('gl_PointCoord');
    expect(wetLens).toContain('wetLensFragmentShader');
    expect(wetLens).toContain('PlaneGeometry');
    expect(frost).toContain('frostFragmentShader');
    expect(frost).toContain('centerProtection');
    expect(aurora).toContain('auroraVertexShader');
    expect(aurora).toContain('AdditiveBlending');
    expect(rainbow).toContain('rainbowFragmentShader');
    expect(rainbow).toContain('TorusGeometry');
    expect(wetSurface).toContain('wetSurfaceFragmentShader');
    expect(accumulation).toContain('snowAccumulationFragmentShader');
    expect(tint).toContain('sandstormTintFragmentShader');
    expect(dustLightning).toContain('DustLightningLayer');
    expect(dustLightning).toContain('runtime.lightningIntensity');
    expect(sunny).not.toContain('TorusGeometry');
    expect(sunny).not.toContain('sunnyRainbowFragmentShader');
  });

  it('creates and disposes new stage 5 layers through owning systems', async () => {
    await expectSystemLayer(
      (context) => new CloudSkySystem(context),
      { weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'day' },
      'cloud-sky-system'
    );
    await expectSystemLayer(
      (context) => new PrecipitationSystem(context),
      { weatherState: 'storm', weatherVariant: 'hailStorm' },
      'hail-precipitation-system'
    );
    await expectSystemLayer(
      (context) => new PrecipitationSystem(context),
      { weatherState: 'rain', weatherVariant: 'moderateRain' },
      'rain-splash-precipitation-system'
    );
    await expectSystemLayer(
      (context) => new OpticalSystem(context),
      { weatherState: 'rain', weatherVariant: 'moderateRain' },
      'wet-lens-optical-system'
    );
    await expectSystemLayer(
      (context) => new OpticalSystem(context),
      { weatherState: 'snow', weatherVariant: 'snow' },
      'frost-optical-system'
    );
    await expectSystemLayer(
      (context) => new OpticalSystem(context),
      { weatherState: 'aurora', weatherVariant: 'aurora' },
      'aurora-optical-system'
    );
    await expectSystemLayer(
      (context) => new OpticalSystem(context),
      { weatherState: 'clear', weatherVariant: 'clear' },
      'rainbow-optical-system'
    );
    await expectSystemLayer(
      (context) => new EnvironmentSystem(context),
      { weatherState: 'rain', weatherVariant: 'moderateRain' },
      'wet-surface-environment-system'
    );
    await expectSystemLayer(
      (context) => new EnvironmentSystem(context),
      { weatherState: 'snow', weatherVariant: 'snow' },
      'snow-accumulation-environment-system'
    );
    await expectSystemLayer(
      (context) => new EnvironmentSystem(context),
      { weatherState: 'sandstorm', weatherVariant: 'sandstorm' },
      'sandstorm-tint-environment-system'
    );
    await expectSystemLayer(
      (context) => new ElectricalSystem(context),
      { weatherState: 'sandstorm', weatherVariant: 'sandstorm' },
      'dust-lightning-electrical-system'
    );
  });
});
