import { existsSync, readFileSync } from 'node:fs';
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
  it('declares the shared system context and controller owns seven real systems including night and cloud sky', () => {
    const typesSource = readSource('src/modules/weather/core/types.ts');
    const controllerSource = readSource('src/modules/weather/core/WeatherController.ts');

    expect(typesSource).toContain('interface WeatherSystemContext');
    expect(typesSource).toContain('scene: import(\'three\').Scene');
    expect(typesSource).toContain('camera: import(\'three\').PerspectiveCamera');
    expect(typesSource).toContain('wind: WindSystem');
    expect(controllerSource).toContain('CloudSkySystem');
    expect(controllerSource).toContain('NightSkySystem');
    expect(controllerSource).toContain('readonly nightSky');
    expect(controllerSource).toContain('readonly cloudSky');
    expect(controllerSource).toContain('EnvironmentSystem');
    expect(controllerSource).toContain('readonly environment');
    expect(controllerSource).toContain('systemContext');
    expect(controllerSource).toContain('new NightSkySystem(systemContext)');
    expect(controllerSource).toContain('new CloudSkySystem(systemContext)');
    expect(controllerSource).toContain('new PrecipitationSystem(systemContext)');
    expect(controllerSource).toContain('new AtmosphereSystem(systemContext)');
    expect(controllerSource).toContain('new ElectricalSystem(systemContext)');
    expect(controllerSource).toContain('new OpticalSystem(systemContext)');
    expect(controllerSource).toContain('new EnvironmentSystem(systemContext)');
    expect(controllerSource).toContain('this.nightSky');
    expect(controllerSource).toContain('this.cloudSky');
    expect(controllerSource).toContain('this.environment');
    expect(controllerSource).not.toContain('../effects/');
    expect(controllerSource).not.toContain('RainWeatherScene');
    expect(controllerSource).not.toContain('SunnyWeatherScene');
  });

  it('moves resource ownership into dedicated system layers instead of weather scenes', () => {
    const expectedLayerFiles = [
      'src/modules/weather/systems/EnvironmentSystem.ts',
      'src/modules/weather/systems/NightSkySystem.ts',
      'src/modules/weather/systems/CloudSkySystem.ts',
      'src/modules/weather/systems/nightSky/NightSkyLayer.ts',
      'src/modules/weather/systems/nightSky/nightSkyProfile.ts',
      'src/modules/weather/systems/nightSky/nightSkyShaders.ts',
      'src/modules/weather/systems/nightSky/SkyDomeLayer.ts',
      'src/modules/weather/systems/nightSky/StarfieldLayer.ts',
      'src/modules/weather/systems/nightSky/MilkyWayLayer.ts',
      'src/modules/weather/systems/nightSky/MoonLayer.ts',
      'src/modules/weather/systems/clouds/CloudSkyLayer.ts',
      'src/modules/weather/systems/clouds/cloudLayerProfiles.ts',
      'src/modules/weather/systems/clouds/cloudShaders.ts',
      'src/modules/weather/systems/precipitation/RainPrecipitationLayer.ts',
      'src/modules/weather/systems/precipitation/RainSplashLayer.ts',
      'src/modules/weather/systems/precipitation/SnowPrecipitationLayer.ts',
      'src/modules/weather/systems/precipitation/HailPrecipitationLayer.ts',
      'src/modules/weather/systems/atmosphere/RainHazeLayer.ts',
      'src/modules/weather/systems/atmosphere/SnowVeilLayer.ts',
      'src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts',
      'src/modules/weather/systems/atmosphere/DustAtmosphereLayer.ts',
      'src/modules/weather/systems/electrical/LightningLayer.ts',
      'src/modules/weather/systems/electrical/DustLightningLayer.ts',
      'src/modules/weather/systems/optical/SunnyOpticalLayer.ts',
      'src/modules/weather/systems/optical/RainbowOpticalLayer.ts',
      'src/modules/weather/systems/optical/WetLensOverlayLayer.ts',
      'src/modules/weather/systems/optical/FrostOverlayLayer.ts',
      'src/modules/weather/systems/optical/AuroraOpticalLayer.ts',
      'src/modules/weather/systems/environment/WetSurfaceLayer.ts',
      'src/modules/weather/systems/environment/SnowAccumulationLayer.ts',
      'src/modules/weather/systems/environment/SandstormTintLayer.ts'
    ];

    expectedLayerFiles.forEach((path) => expect(fileExists(path), path).toBe(true));

    const precipitationSource = readSource('src/modules/weather/systems/PrecipitationSystem.ts');
    const nightSkySource = readSource('src/modules/weather/systems/NightSkySystem.ts');
    const cloudSkySource = readSource('src/modules/weather/systems/CloudSkySystem.ts');
    const atmosphereSource = readSource('src/modules/weather/systems/AtmosphereSystem.ts');
    const electricalSource = readSource('src/modules/weather/systems/ElectricalSystem.ts');
    const opticalSource = readSource('src/modules/weather/systems/OpticalSystem.ts');
    const environmentSource = readSource('src/modules/weather/systems/EnvironmentSystem.ts');

    expect(nightSkySource).toContain('activeLayer');
    expect(nightSkySource).toContain('loadToken');
    expect(nightSkySource).toContain("import('./nightSky/NightSkyLayer')");
    expect(nightSkySource).toContain('getSkyProfile');
    expect(nightSkySource).toContain('getNightSkyRenderProfile');
    expect(nightSkySource).toContain('this.activeLayer?.update(frame, runtime)');
    expect(nightSkySource).not.toContain('return this.profile');

    expect(cloudSkySource).toContain('activeLayer');
    expect(cloudSkySource).toContain('loadToken');
    expect(cloudSkySource).toContain("import('./clouds/CloudSkyLayer')");
    expect(cloudSkySource).toContain('getSkyProfile');
    expect(cloudSkySource).toContain('this.activeLayer?.update(frame, runtime)');
    expect(cloudSkySource).not.toContain('return this.profile');

    expect(precipitationSource).toContain('activeLayer');
    expect(precipitationSource).toContain('activeLayers');
    expect(precipitationSource).toContain('loadToken');
    expect(precipitationSource).toContain("import('./precipitation/RainPrecipitationLayer')");
    expect(precipitationSource).toContain("import('./precipitation/SnowPrecipitationLayer')");
    expect(precipitationSource).toContain("import('./precipitation/HailPrecipitationLayer')");
    expect(precipitationSource).toContain("import('./precipitation/RainSplashLayer')");
    expect(precipitationSource).toContain('precipitationVisibility');
    expect(precipitationSource).toContain('this.activeLayers.forEach((layer) => layer.update(frame, effectiveRuntime))');
    expect(precipitationSource).not.toContain('return this.profile');

    expect(atmosphereSource).toContain('activeLayer');
    expect(atmosphereSource).toContain('loadToken');
    expect(atmosphereSource).toContain("import('./atmosphere/RainHazeLayer')");
    expect(atmosphereSource).toContain("import('./atmosphere/SnowVeilLayer')");
    expect(atmosphereSource).toContain("import('./atmosphere/FogAtmosphereLayer')");
    expect(atmosphereSource).toContain("import('./atmosphere/DustAtmosphereLayer')");
    expect(atmosphereSource).toContain('atmosphereVisibility');
    expect(atmosphereSource).toContain('this.activeLayer?.update(frame, effectiveRuntime)');
    expect(atmosphereSource).not.toContain('return this.profile');

    expect(electricalSource).toContain('activeLayer');
    expect(electricalSource).toContain('loadToken');
    expect(electricalSource).toContain("import('./electrical/LightningLayer')");
    expect(electricalSource).toContain('electricalVisibility');
    expect(electricalSource).toContain('this.activeLayer?.update(frame, effectiveRuntime)');
    expect(electricalSource).not.toContain('return this.profile');

    expect(opticalSource).toContain('activeLayer');
    expect(opticalSource).toContain('activeLayers');
    expect(opticalSource).toContain('loadToken');
    expect(opticalSource).toContain("import('./optical/SunnyOpticalLayer')");
    expect(opticalSource).toContain("import('./optical/RainbowOpticalLayer')");
    expect(opticalSource).toContain("import('./optical/WetLensOverlayLayer')");
    expect(opticalSource).toContain("import('./optical/FrostOverlayLayer')");
    expect(opticalSource).toContain("import('./optical/AuroraOpticalLayer')");
    expect(opticalSource).toContain('this.activeLayers.forEach((layer) => layer.update(frame, runtime))');
    expect(opticalSource).not.toContain('return this.profile');

    expect(environmentSource).toContain('HemisphereLight');
    expect(environmentSource).toContain('DirectionalLight');
    expect(environmentSource).toContain('runtime.ambientWarmth');
    expect(environmentSource).toContain('runtime.skyDarkness');
    expect(environmentSource).toContain('this.group.removeFromParent()');
    expect(environmentSource).not.toContain('scene.background');
  });

  it('keeps scene files as thin lazy-loaded adapters only', () => {
    const adapterFiles = [
      'src/modules/weather/effects/sunny/SunnyWeatherScene.ts',
      'src/modules/weather/effects/rain/RainWeatherScene.ts',
      'src/modules/weather/effects/storm/StormWeatherScene.ts',
      'src/modules/weather/effects/snow/SnowWeatherScene.ts',
      'src/modules/weather/effects/fog/FogWeatherScene.ts',
      'src/modules/weather/effects/sandstorm/SandstormWeatherScene.ts'
    ];

    adapterFiles.forEach((path) => {
      const source = readSource(path);

      expect(source, path).toContain('setProfile(profile: WeatherProfile)');
      expect(source, path).toContain('update(_frame: WeatherFrameState, _runtime: WeatherRuntimeState)');
      expect(source, path).toContain('dispose()');
      expect(source, path).not.toContain('new THREE.BufferGeometry');
      expect(source, path).not.toContain('new THREE.ShaderMaterial');
      expect(source, path).not.toContain('new THREE.LineSegments');
      expect(source, path).not.toContain('new THREE.Points');
      expect(source, path).not.toContain('new THREE.PlaneGeometry');
      expect(source, path).not.toContain('group.traverse');
      expect(source, path).not.toContain('geometry?.dispose()');
      expect(source, path).not.toContain('material?.dispose()');
    });
  });

  it('keeps shader and geometry ownership in system layers', () => {
    const rainLayer = readSource('src/modules/weather/systems/precipitation/RainPrecipitationLayer.ts');
    const nightLayer = readSource('src/modules/weather/systems/nightSky/NightSkyLayer.ts');
    const nightProfile = readSource('src/modules/weather/systems/nightSky/nightSkyProfile.ts');
    const nightShaders = readSource('src/modules/weather/systems/nightSky/nightSkyShaders.ts');
    const starfieldLayer = readSource('src/modules/weather/systems/nightSky/StarfieldLayer.ts');
    const milkyWayLayer = readSource('src/modules/weather/systems/nightSky/MilkyWayLayer.ts');
    const moonLayer = readSource('src/modules/weather/systems/nightSky/MoonLayer.ts');
    const cloudLayer = readSource('src/modules/weather/systems/clouds/CloudSkyLayer.ts');
    const cloudProfiles = readSource('src/modules/weather/systems/clouds/cloudLayerProfiles.ts');
    const cloudShaders = readSource('src/modules/weather/systems/clouds/cloudShaders.ts');
    const snowLayer = readSource('src/modules/weather/systems/precipitation/SnowPrecipitationLayer.ts');
    const rainHazeLayer = readSource('src/modules/weather/systems/atmosphere/RainHazeLayer.ts');
    const snowVeilLayer = readSource('src/modules/weather/systems/atmosphere/SnowVeilLayer.ts');
    const fogLayer = readSource('src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts');
    const fogSpriteLayer = readSource('src/modules/weather/systems/atmosphere/FogSpriteLayer.ts');
    const fogSpriteShaders = readSource('src/modules/weather/systems/atmosphere/fogSpriteShaders.ts');
    const dustLayer = readSource('src/modules/weather/systems/atmosphere/DustAtmosphereLayer.ts');
    const lightningLayer = readSource('src/modules/weather/systems/electrical/LightningLayer.ts');
    const sunnyLayer = readSource('src/modules/weather/systems/optical/SunnyOpticalLayer.ts');
    const rainbowLayer = readSource('src/modules/weather/systems/optical/RainbowOpticalLayer.ts');

    expect(nightLayer).toContain('night-sky-system');
    expect(nightLayer).toContain('SkyDomeLayer');
    expect(nightLayer).toContain('StarfieldLayer');
    expect(nightLayer).toContain('MilkyWayLayer');
    expect(nightLayer).toContain('MoonLayer');
    expect(nightProfile).toContain('NightSkyRenderProfile');
    expect(nightProfile).toContain('WEATHER_NIGHT_SKY_BUDGET');
    expect(nightShaders).toContain('gl_PointCoord');
    expect(nightShaders).toContain('horizonGlow');
    expect(nightShaders).toContain('dustLanes');
    expect(starfieldLayer).toContain('THREE.Points');
    expect(starfieldLayer).toContain('aStarData');
    expect(milkyWayLayer).toContain('night-milky-way-system');
    expect(moonLayer).toContain('night-moon-system');

    expect(cloudLayer).toContain('PlaneGeometry(1, 1, 5, 5)');
    expect(cloudLayer).toContain('cloud-sky-system');
    expect(cloudLayer).toContain('depthWrite: false');
    expect(cloudLayer).toContain('frustumCulled = false');
    expect(cloudProfiles).toContain('cumulonimbus');
    expect(cloudProfiles).toContain('cirrocumulus');
    expect(cloudShaders).toContain('uTxtShape');
    expect(cloudShaders).toContain('uTxtCloudNoise');

    expect(rainLayer).toContain('LineSegments');
    expect(rainLayer).toContain('WEATHER_PARTICLE_COUNTS.rain');
    expect(rainLayer).toContain('rainVertexShader');
    expect(rainLayer).toContain('runtime.rainIntensity');
    expect(rainLayer).toContain('geometry.dispose()');
    expect(rainLayer).toContain('material.dispose()');

    expect(snowLayer).toContain('Points');
    expect(snowLayer).toContain('aSeed');
    expect(snowLayer).toContain('snowVertexShader');
    expect(snowLayer).toContain('runtime.snowIntensity');
    expect(snowLayer).toContain('frustumCulled = false');

    expect(rainHazeLayer).toContain('rainHaze');
    expect(rainHazeLayer).toContain('PlaneGeometry');
    expect(rainHazeLayer).toContain('runtime.rainIntensity');

    expect(snowVeilLayer).toContain('snowVeil');
    expect(snowVeilLayer).toContain('PlaneGeometry');
    expect(snowVeilLayer).toContain('runtime.snowIntensity');

    expect(fogLayer).toContain('FogSpriteLayer');
    expect(fogLayer).toContain('runtime.fogDensity');
    expect(fogLayer).toContain("weatherVariant === 'haze'");
    expect(fogSpriteLayer).toContain('InstancedBufferGeometry');
    expect(fogSpriteLayer).toContain('PlaneGeometry');
    expect(fogSpriteLayer).toContain('ShaderMaterial');
    expect(fogSpriteLayer).toContain('TextureLoader');
    expect(fogSpriteShaders).toContain('uniform sampler2D fogMap');
    expect(fogSpriteShaders).toContain('windOffset');

    expect(dustLayer).toContain('Points');
    expect(dustLayer).toContain('dustColor');
    expect(dustLayer).toContain('gust');
    expect(dustLayer).toContain('runtime.particleIntensity');

    expect(lightningLayer).toContain('LineSegments');
    expect(lightningLayer).toContain('PointLight');
    expect(lightningLayer).toContain('burstRemaining');
    expect(lightningLayer).toContain('runtime.lightningIntensity');

    expect(sunnyLayer).toContain('sunnyRadialRayFragmentShader');
    expect(sunnyLayer).toContain('sunnyHaloFragmentShader');
    expect(sunnyLayer).toContain('WEATHER_PARTICLE_COUNTS.sunnyDust');
    expect(rainbowLayer).toContain('rainbowFragmentShader');
    expect(rainbowLayer).toContain('TorusGeometry');
  });

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
