import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getWeatherProfile, getWeatherRenderMode } from '../profiles/weatherProfiles';

function fileExists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function readSource(path: string) {
  const absolutePath = resolve(process.cwd(), path);

  return fileExists(path) ? readFileSync(absolutePath, 'utf8') : '';
}

describe('Three.js weather atmosphere', () => {
  it('adds three as the weather rendering dependency', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.three).toMatch(/^\^/);
  });

  it('uses the backend semantic weather contract in frontend types and API', () => {
    const weatherTypes = readSource('src/modules/weather/model.ts');
    const apiTest = readSource('src/modules/weather/tests/httpWeatherGateway.test.ts');

    expect(weatherTypes).toContain('export type WeatherState');
    expect(weatherTypes).toContain("| 'aurora'");
    expect(weatherTypes).toContain('export type WeatherVariant');
    expect(weatherTypes).toContain("| 'aurora'");
    expect(weatherTypes).toContain('export type PrecipitationKind');
    expect(weatherTypes).toContain('export type DaylightHint');
    expect(weatherTypes).toContain('weatherState: WeatherState');
    expect(weatherTypes).toContain('weatherVariant: WeatherVariant');
    expect(weatherTypes).toContain('precipitationKind: PrecipitationKind');
    expect(weatherTypes).toContain('daylightHint: DaylightHint');
    expect(weatherTypes).toContain('observedAt: string');
    expect(weatherTypes).not.toContain('WeatherType');
    expect(weatherTypes).not.toContain('weatherType');
    expect(weatherTypes).not.toContain('isDay');
    expect(weatherTypes).not.toContain('updatedAt');
    expect(apiTest).toContain('weatherState');
    expect(apiTest).toContain('observedAt');
    expect(apiTest).not.toContain('weatherType');
    expect(apiTest).not.toContain('isDay');
  });

  it('keeps WeatherAtmosphere as the gated entry and lazy loads Three only for implemented state families', () => {
    const source = readSource('src/modules/weather/WeatherAtmosphere.vue');
    const sharedWeatherSource = readSource('src/modules/weather/internal/useWeatherAtmosphereData.ts');

    expect(fileExists('src/modules/weather/components/SunnyWeatherLayer.vue')).toBe(true);
    expect(source).toContain("import SunnyWeatherLayer from './components/SunnyWeatherLayer.vue'");
    expect(source).toContain("renderMode === 'three-clear'");
    expect(source).toContain('<SunnyWeatherLayer');
    expect(source).toContain(':active="renderMode === \'three-clear\'"');
    expect(source).toContain('intensity="bright"');
    expect(source).toContain(':static="prefersReducedMotion"');
    expect(source).toContain('defineAsyncComponent');
    expect(source).toContain('useWeatherAtmosphereData');
    expect(source).toContain("import('./components/ThreeWeatherLayer.vue')");
    expect(source).toContain('LegacyWeatherAtmosphere');
    expect(source).toContain('getWeatherRenderMode');
    expect(source).toContain('(max-width: 1020px)');
    expect(source).toContain('(prefers-reduced-motion: reduce)');
    expect(source).toContain("renderMode === 'three-cloudy'");
    expect(source).toContain("renderMode === 'three-rain'");
    expect(source).toContain("renderMode === 'three-storm'");
    expect(source).toContain("renderMode === 'three-snow'");
    expect(source).toContain("renderMode === 'three-fog'");
    expect(source).toContain("renderMode === 'three-sandstorm'");
    expect(source).toContain("renderMode === 'three-aurora'");
    expect(source).toContain("renderMode === 'legacy'");
    expect(source).toContain("renderMode === 'none'");
    expect(source).toContain('weatherState');
    expect(source).not.toContain('useRoute');
    expect(source).not.toContain('route.fullPath');
    expect(source).not.toContain('resolveWeatherStateWithOverride');
    expect(source).not.toContain("params.get('daylight')");
    expect(source).not.toContain("params.get('meteor')");
    expect(source).not.toContain('meteorShowerOverride');
    expect(sharedWeatherSource).toContain('observedAt');
    expect(sharedWeatherSource).toContain('weatherGateway.fetchAtmosphere');
    expect(source).not.toContain('weatherType');
    expect(source).not.toContain('isDay');
    expect(source).not.toContain('updatedAt');
  });

  it('keeps sunny affordances owned by the weather module', () => {
    const moduleEntry = readSource('src/modules/weather/index.ts');
    const sunnyLayer = readSource(
      'src/modules/weather/components/SunnyWeatherLayer.vue'
    );
    const sunnyStyles = readSource('src/modules/weather/weather.css');

    expect(fileExists('src/modules/weather/weather.css')).toBe(true);
    expect(moduleEntry).toContain("import './weather.css'");
    expect(sunnyStyles).toContain('body .snowlit-sunny-layer.snowlit-sunny-layer');
    expect(sunnyStyles).toContain('.snowlit-sunny-layer::before');
    expect(sunnyStyles).toContain('.snowlit-sunny-layer::after');
    expect(sunnyStyles).toContain('radial-gradient');
    expect(sunnyStyles).toContain('linear-gradient');
    expect(sunnyStyles).toContain('pointer-events: none');
    expect(sunnyLayer).toContain(
      "gsap.utils.toArray<HTMLElement>('.dust-particle')"
    );
    expect(sunnyLayer).toContain('const reducedMotionQuery');
    expect(sunnyLayer).toContain(
      "reducedMotionQuery?.removeEventListener("
    );
    expect(sunnyLayer).not.toMatch(/\bany\b/);
    expect(sunnyLayer).not.toContain('setTimeout(initAnimations');
  });

  it('maps missing fields and core states to render modes without URL weather overrides', () => {
    const profilesSource = readSource('src/modules/weather/profiles/weatherProfiles.ts');

    expect(profilesSource).not.toContain('resolveWeatherStateWithOverride');
    expect(profilesSource).not.toContain('overrideWeather');

    expect(getWeatherRenderMode({ weatherState: 'clear', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-clear'
    );
    expect(getWeatherRenderMode({ weatherState: 'cloudy', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-cloudy'
    );
    expect(getWeatherRenderMode({ weatherState: 'rain', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-rain'
    );
    expect(getWeatherRenderMode({ weatherState: 'drizzle', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-rain'
    );
    expect(getWeatherRenderMode({ weatherState: 'heavyRain', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-rain'
    );
    expect(getWeatherRenderMode({ weatherState: 'storm', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-storm'
    );
    expect(getWeatherRenderMode({ weatherState: 'lightSnow', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-snow'
    );
    expect(getWeatherRenderMode({ weatherState: 'snow', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-snow'
    );
    expect(getWeatherRenderMode({ weatherState: 'blizzard', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-snow'
    );
    expect(getWeatherRenderMode({ weatherState: 'fog', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-fog'
    );
    expect(
      getWeatherRenderMode({ weatherState: 'sandstorm', isLargeViewport: true, prefersReducedMotion: false })
    ).toBe('three-sandstorm');
    expect(getWeatherRenderMode({ weatherState: 'aurora', isLargeViewport: true, prefersReducedMotion: false })).toBe(
      'three-aurora'
    );
    expect(getWeatherRenderMode({ weatherState: 'clear', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'storm', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'snow', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'fog', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'sandstorm', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'aurora', isLargeViewport: true, prefersReducedMotion: true })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'rain', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'storm', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'blizzard', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
    expect(getWeatherRenderMode({ weatherState: 'fog', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
    expect(
      getWeatherRenderMode({ weatherState: 'sandstorm', isLargeViewport: false, prefersReducedMotion: false })
    ).toBe('none');
    expect(getWeatherRenderMode({ weatherState: 'aurora', isLargeViewport: false, prefersReducedMotion: false })).toBe(
      'none'
    );
  });

  it('maps semantic states and variants to animation profiles without backend render parameters', () => {
    expect(getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' })).toMatchObject({
      weatherState: 'clear',
      renderer: 'three-clear',
      legacyKind: 'sunny',
      particleIntensity: 1,
      daylightHint: 'unknown'
    });
    expect(getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' })).toMatchObject({
      weatherState: 'clear',
      daylightHint: 'night',
      meteorShower: false
    });
    expect(
      getWeatherProfile({
        weatherState: 'clear',
        weatherVariant: 'clear',
        daylightHint: 'night',
        meteorShower: true
      })
    ).toMatchObject({
      weatherState: 'clear',
      daylightHint: 'night',
      meteorShower: true
    });
    expect(
      getWeatherProfile({
        weatherState: 'storm',
        weatherVariant: 'thunderstorm',
        daylightHint: 'night',
        meteorShower: true
      })
    ).toMatchObject({
      weatherState: 'storm',
      meteorShower: false
    });
    expect(getWeatherProfile({ weatherState: 'drizzle', weatherVariant: 'lightRain' })).toMatchObject({
      weatherState: 'drizzle',
      renderer: 'three-rain',
      legacyKind: 'rain',
      particleIntensity: 0.38
    });
    expect(getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' })).toMatchObject({
      weatherState: 'rain',
      renderer: 'three-rain',
      legacyKind: 'rain',
      particleIntensity: 0.7
    });
    expect(getWeatherProfile({ weatherState: 'heavyRain', weatherVariant: 'heavyRain' })).toMatchObject({
      weatherState: 'heavyRain',
      renderer: 'three-rain',
      legacyKind: 'rain',
      particleIntensity: 1
    });
    expect(getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm' })).toMatchObject({
      weatherState: 'storm',
      renderer: 'three-storm',
      particleIntensity: 1,
      windMultiplier: 2.5
    });
    expect(getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm' })).not.toMatchObject({
      renderer: 'legacy',
      legacyKind: 'thunder'
    });
    expect(getWeatherProfile({ weatherState: 'storm', weatherVariant: 'hailStorm' })).toMatchObject({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      renderer: 'three-storm'
    });
    expect(getWeatherProfile({ weatherState: 'lightSnow', weatherVariant: 'lightSnow' })).toMatchObject({
      weatherState: 'lightSnow',
      renderer: 'three-snow',
      legacyKind: 'snow',
      particleIntensity: 0.3,
      windMultiplier: 0.6
    });
    expect(getWeatherProfile({ weatherState: 'snow', weatherVariant: 'snow' })).toMatchObject({
      weatherState: 'snow',
      renderer: 'three-snow',
      legacyKind: 'snow',
      particleIntensity: 0.7,
      windMultiplier: 1
    });
    expect(getWeatherProfile({ weatherState: 'blizzard', weatherVariant: 'heavySnow' })).toMatchObject({
      weatherState: 'blizzard',
      renderer: 'three-snow',
      legacyKind: 'snow',
      particleIntensity: 1,
      windMultiplier: 3
    });
    expect(getWeatherProfile({ weatherState: 'fog', weatherVariant: 'mist' })).toMatchObject({
      weatherState: 'fog',
      weatherVariant: 'mist',
      renderer: 'three-fog',
      legacyKind: 'fog',
      particleIntensity: 0.7,
      ambientWarmth: 0.18,
      windMultiplier: 0.2
    });
    expect(getWeatherProfile({ weatherState: 'fog', weatherVariant: 'haze' })).toMatchObject({
      weatherState: 'fog',
      weatherVariant: 'haze',
      renderer: 'three-fog',
      legacyKind: 'fog',
      particleIntensity: 0.5,
      ambientWarmth: 0.24,
      windMultiplier: 0.12
    });
    expect(getWeatherProfile({ weatherState: 'sandstorm', weatherVariant: 'sandstorm' })).toMatchObject({
      weatherState: 'sandstorm',
      weatherVariant: 'sandstorm',
      renderer: 'three-sandstorm',
      legacyKind: 'windy',
      particleIntensity: 1,
      ambientWarmth: 0.18,
      windMultiplier: 3
    });
    expect(getWeatherProfile({ weatherState: 'sandstorm', weatherVariant: 'dust' })).toMatchObject({
      weatherState: 'sandstorm',
      weatherVariant: 'dust',
      renderer: 'three-sandstorm',
      legacyKind: 'windy',
      particleIntensity: 0.45,
      ambientWarmth: 0.26,
      windMultiplier: 1.6
    });
    expect(getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora' })).toMatchObject({
      weatherState: 'aurora',
      weatherVariant: 'aurora',
      renderer: 'three-aurora',
      legacyKind: 'night',
      particleIntensity: 0.64
    });
    expect(getWeatherProfile({ weatherState: 'snow', weatherVariant: 'hail' })).toMatchObject({
      weatherState: 'snow',
      weatherVariant: 'hail',
      renderer: 'three-snow'
    });
    expect(getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'windy' })).toMatchObject({
      renderer: 'three-cloudy',
      legacyKind: 'cloudy'
    });
    expect(getWeatherProfile({ weatherState: undefined, weatherVariant: undefined })).toMatchObject({
      renderer: 'three-cloudy',
      legacyKind: 'cloudy'
    });
    expect(readSource('src/modules/weather/model.ts')).not.toContain('rainIntensity');
    expect(readSource('src/modules/weather/model.ts')).not.toContain('wetLensLevel');
    expect(readSource('src/modules/weather/model.ts')).not.toContain('lightningLevel');
    expect(readSource('src/modules/weather/model.ts')).not.toContain('atmosphereLevel');
  });

  it('keeps only non-three legacy weather paths and removes old snow/fog/weatherType/isDay dependencies', () => {
    const legacySource = readSource('src/modules/weather/components/LegacyWeatherAtmosphere.vue');

    expect(fileExists('src/modules/weather/components/LegacyWeatherAtmosphere.vue')).toBe(true);
    expect(legacySource).toContain('LegacyWeatherKind');
    expect(legacySource).toContain("normalizedLegacyKind === 'thunder'");
    expect(legacySource).toContain("normalizedLegacyKind === 'windy'");
    expect(legacySource).toContain("['cloudy', 'thunder', 'windy', 'night']");
    expect(legacySource).not.toContain("normalizedLegacyKind === 'snow'");
    expect(legacySource).not.toContain("normalizedLegacyKind === 'fog'");
    expect(legacySource).not.toContain('weather-snowflake');
    expect(legacySource).not.toContain('weather-frost');
    expect(legacySource).not.toContain('weather-fog');
    expect(legacySource).not.toContain('FOG_BANDS');
    expect(legacySource).not.toContain('weatherType');
    expect(legacySource).not.toContain('isDay');
    expect(legacySource).not.toContain("normalizedLegacyKind === 'rain'");
  });

  it('creates the procedural-weather skeleton with real unified systems, renderer factory, and effect adapters', () => {
    const expectedFiles = [
      'src/modules/weather/core/WeatherController.ts',
      'src/modules/weather/core/WindSystem.ts',
      'src/modules/weather/core/createWeatherRenderer.ts',
      'src/modules/weather/core/types.ts',
      'src/modules/weather/core/weatherStateParameters.ts',
      'src/modules/weather/systems/AtmosphereSystem.ts',
      'src/modules/weather/systems/CloudSkySystem.ts',
      'src/modules/weather/systems/NightSkySystem.ts',
      'src/modules/weather/systems/ElectricalSystem.ts',
      'src/modules/weather/systems/EnvironmentSystem.ts',
      'src/modules/weather/systems/OpticalSystem.ts',
      'src/modules/weather/systems/PrecipitationSystem.ts',
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
      'src/modules/weather/systems/precipitation/SnowPrecipitationLayer.ts',
      'src/modules/weather/systems/atmosphere/RainHazeLayer.ts',
      'src/modules/weather/systems/atmosphere/SnowVeilLayer.ts',
      'src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts',
      'src/modules/weather/systems/atmosphere/FogSpriteLayer.ts',
      'src/modules/weather/systems/atmosphere/fogSpriteShaders.ts',
      'src/modules/weather/systems/atmosphere/DustAtmosphereLayer.ts',
      'src/modules/weather/systems/electrical/LightningLayer.ts',
      'src/modules/weather/systems/electrical/DustLightningLayer.ts',
      'src/modules/weather/systems/optical/SunnyOpticalLayer.ts',
      'src/modules/weather/systems/optical/RainbowOpticalLayer.ts',
      'src/modules/weather/systems/optical/WetLensOverlayLayer.ts',
      'src/modules/weather/systems/optical/FrostOverlayLayer.ts',
      'src/modules/weather/systems/optical/AuroraOpticalLayer.ts',
      'src/modules/weather/systems/precipitation/HailPrecipitationLayer.ts',
      'src/modules/weather/systems/precipitation/RainSplashLayer.ts',
      'src/modules/weather/systems/environment/WetSurfaceLayer.ts',
      'src/modules/weather/systems/environment/SnowAccumulationLayer.ts',
      'src/modules/weather/systems/environment/SandstormTintLayer.ts',
      'src/modules/weather/effects/sunny/SunnyWeatherScene.ts',
      'src/modules/weather/effects/sunny/sunnyShaders.ts',
      'src/modules/weather/effects/cloudy/CloudyWeatherScene.ts',
      'src/modules/weather/effects/rain/RainWeatherScene.ts',
      'src/modules/weather/effects/rain/rainShaders.ts',
      'src/modules/weather/effects/storm/StormWeatherScene.ts',
      'src/modules/weather/effects/snow/SnowWeatherScene.ts',
      'src/modules/weather/effects/snow/snowShaders.ts',
      'src/modules/weather/effects/fog/FogWeatherScene.ts',
      'src/modules/weather/effects/sandstorm/SandstormWeatherScene.ts',
      'src/modules/weather/effects/sandstorm/sandstormShaders.ts',
      'src/modules/weather/effects/aurora/AuroraWeatherScene.ts',
      'src/modules/weather/effects/aurora/auroraShaders.ts'
    ];

    expectedFiles.forEach((path) => expect(fileExists(path), path).toBe(true));

    const controllerSource = readSource('src/modules/weather/core/WeatherController.ts');
    const parametersSource = readSource('src/modules/weather/core/weatherStateParameters.ts');
    const rendererSource = readSource('src/modules/weather/core/createWeatherRenderer.ts');
    const atmosphereSource = readSource('src/modules/weather/systems/AtmosphereSystem.ts');
    const cloudSkySource = readSource('src/modules/weather/systems/CloudSkySystem.ts');
    const electricalSource = readSource('src/modules/weather/systems/ElectricalSystem.ts');
    const environmentSource = readSource('src/modules/weather/systems/EnvironmentSystem.ts');
    const opticalSource = readSource('src/modules/weather/systems/OpticalSystem.ts');
    const precipitationSource = readSource('src/modules/weather/systems/PrecipitationSystem.ts');
    const typesSource = readSource('src/modules/weather/core/types.ts');

    expect(controllerSource).toContain('class WeatherController');
    expect(controllerSource).toContain('setWeatherProfile');
    expect(controllerSource).toContain('runtimeState');
    expect(controllerSource).toContain('WeatherRuntimeState');
    expect(controllerSource).toContain('weatherStateParameters');
    expect(controllerSource).toContain('rainIntensity');
    expect(controllerSource).toContain('snowIntensity');
    expect(controllerSource).toContain('lightningIntensity');
    expect(controllerSource).toContain('skyDarkness');
    expect(controllerSource).toContain('transitionProgress');
    expect(controllerSource).toContain('weatherState');
    expect(controllerSource).toContain('EnvironmentSystem');
    expect(controllerSource).toContain('CloudSkySystem');
    expect(controllerSource).toContain('NightSkySystem');
    expect(controllerSource).toContain('systemContext');
    expect(controllerSource).toContain('new NightSkySystem(systemContext)');
    expect(controllerSource).toContain('new CloudSkySystem(systemContext)');
    expect(controllerSource).toContain('new PrecipitationSystem(systemContext)');
    expect(controllerSource).toContain('new AtmosphereSystem(systemContext)');
    expect(controllerSource).toContain('new ElectricalSystem(systemContext)');
    expect(controllerSource).toContain('new OpticalSystem(systemContext)');
    expect(controllerSource).toContain('new EnvironmentSystem(systemContext)');
    expect(controllerSource).not.toContain('../effects/');
    expect(parametersSource).toContain('clear:');
    expect(parametersSource).toContain('cloudy:');
    expect(parametersSource).toContain('drizzle:');
    expect(parametersSource).toContain('heavyRain:');
    expect(parametersSource).toContain('aurora:');
    expect(rendererSource).toContain("import('three/addons/capabilities/WebGPU.js')");
    expect(rendererSource).toContain("import('three/webgpu')");
    expect(rendererSource).toContain('new three.WebGLRenderer');
    expect(rendererSource).toContain('alpha: true');
    expect(rendererSource).toContain('premultipliedAlpha: true');
    expect(rendererSource).toContain("rendererKind: 'webgpu'");
    expect(rendererSource).toContain('rendererKind: \'webgl\'');
    expect(rendererSource).toContain('gpuAvailable');
    expect(rendererSource).not.toContain('EffectComposer');
    expect(rendererSource).not.toContain('three/addons/renderers/webgpu/WebGPURenderer.js');
    expect(typesSource).toContain('WeatherSystemContext');
    expect(typesSource).toContain('scene: import(\'three\').Scene');
    expect(typesSource).toContain('camera: import(\'three\').PerspectiveCamera');
    expect(typesSource).toContain('wind: WindSystem');
    expect(atmosphereSource).toContain('class AtmosphereSystem');
    expect(cloudSkySource).toContain('class CloudSkySystem');
    expect(cloudSkySource).toContain("import('./clouds/CloudSkyLayer')");
    expect(electricalSource).toContain('class ElectricalSystem');
    expect(environmentSource).toContain('class EnvironmentSystem');
    expect(opticalSource).toContain('class OpticalSystem');
    expect(precipitationSource).toContain('class PrecipitationSystem');
    expect(atmosphereSource).toContain('activeLayer');
    expect(electricalSource).toContain('activeLayer');
    expect(opticalSource).toContain('activeLayer');
    expect(precipitationSource).toContain('activeLayer');
    expect(opticalSource).toContain('activeLayers');
    expect(precipitationSource).toContain('activeLayers');
    expect(environmentSource).toContain('HemisphereLight');
    expect(environmentSource).toContain('DirectionalLight');
    expect(atmosphereSource).not.toContain('return this.profile');
    expect(electricalSource).not.toContain('return this.profile');
    expect(opticalSource).not.toContain('return this.profile');
    expect(precipitationSource).not.toContain('return this.profile');
  });

  it('lazy-loads thin scene adapters while unified systems own the weather resources', () => {
    const layerSource = readSource('src/modules/weather/components/ThreeWeatherLayer.vue');
    const sunnySource = readSource('src/modules/weather/effects/sunny/SunnyWeatherScene.ts');
    const cloudySource = readSource('src/modules/weather/effects/cloudy/CloudyWeatherScene.ts');
    const rainSource = readSource('src/modules/weather/effects/rain/RainWeatherScene.ts');
    const rainShaderSource = readSource('src/modules/weather/effects/rain/rainShaders.ts');
    const stormSource = readSource('src/modules/weather/effects/storm/StormWeatherScene.ts');
    const snowSource = readSource('src/modules/weather/effects/snow/SnowWeatherScene.ts');
    const snowShaderSource = readSource('src/modules/weather/effects/snow/snowShaders.ts');
    const fogSource = readSource('src/modules/weather/effects/fog/FogWeatherScene.ts');
    const fogSpriteShaderSource = readSource('src/modules/weather/systems/atmosphere/fogSpriteShaders.ts');
    const sandstormSource = readSource('src/modules/weather/effects/sandstorm/SandstormWeatherScene.ts');
    const sandstormShaderSource = readSource('src/modules/weather/effects/sandstorm/sandstormShaders.ts');
    const auroraSource = readSource('src/modules/weather/effects/aurora/AuroraWeatherScene.ts');
    const rainLayerSource = readSource('src/modules/weather/systems/precipitation/RainPrecipitationLayer.ts');
    const snowLayerSource = readSource('src/modules/weather/systems/precipitation/SnowPrecipitationLayer.ts');
    const rainHazeLayerSource = readSource('src/modules/weather/systems/atmosphere/RainHazeLayer.ts');
    const snowVeilLayerSource = readSource('src/modules/weather/systems/atmosphere/SnowVeilLayer.ts');
    const fogLayerSource = readSource('src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts');
    const fogSpriteLayerSource = readSource('src/modules/weather/systems/atmosphere/FogSpriteLayer.ts');
    const dustLayerSource = readSource('src/modules/weather/systems/atmosphere/DustAtmosphereLayer.ts');
    const lightningLayerSource = readSource('src/modules/weather/systems/electrical/LightningLayer.ts');
    const sunnyLayerSource = readSource('src/modules/weather/systems/optical/SunnyOpticalLayer.ts');
    const rainbowLayerSource = readSource('src/modules/weather/systems/optical/RainbowOpticalLayer.ts');
    const coreTypesSource = readSource('src/modules/weather/core/types.ts');
    const sceneAdapterSources = [
      sunnySource,
      cloudySource,
      rainSource,
      stormSource,
      snowSource,
      fogSource,
      sandstormSource,
      auroraSource
    ];

    expect(layerSource).toContain('<canvas');
    expect(layerSource).toContain('three-weather-layer__canvas');
    expect(layerSource).toContain('pointer-events: none');
    expect(layerSource).toContain('import(\'../effects/sunny/SunnyWeatherScene\')');
    expect(layerSource).toContain('import(\'../effects/cloudy/CloudyWeatherScene\')');
    expect(layerSource).toContain('import(\'../effects/rain/RainWeatherScene\')');
    expect(layerSource).toContain('import(\'../effects/storm/StormWeatherScene\')');
    expect(layerSource).toContain('import(\'../effects/snow/SnowWeatherScene\')');
    expect(layerSource).toContain('import(\'../effects/fog/FogWeatherScene\')');
    expect(layerSource).toContain('import(\'../effects/sandstorm/SandstormWeatherScene\')');
    expect(layerSource).toContain('import(\'../effects/aurora/AuroraWeatherScene\')');
    expect(layerSource).toContain('THREE_WEATHER_STATES');
    expect(layerSource).toContain('RAIN_FAMILY_STATES');
    expect(layerSource).toContain('SNOW_FAMILY_STATES');
    expect(layerSource).toContain('watch(');
    expect(layerSource).toContain('props.weather.weatherVariant');
    expect(layerSource).toContain('props.weather.daylightHint');
    expect(layerSource).toContain('controller.setWeatherProfile(nextProfile)');
    expect(layerSource).toContain('new WeatherController(profile, new WindSystem(), {');
    expect(layerSource).toContain('scene,');
    expect(layerSource).toContain('camera');
    expect(layerSource).toContain('currentSceneFamily');
    expect(layerSource).toContain('loadWeatherScene');
    expect(layerSource).toContain('setProfile(profile: WeatherProfile)');
    expect(layerSource).toContain('runtime');
    expect(layerSource).toContain("profile.weatherState === 'cloudy'");
    expect(layerSource).toContain("profile.weatherState === 'storm'");
    expect(layerSource).toContain('SNOW_FAMILY_STATES.includes(profile.weatherState)');
    expect(layerSource).toContain("profile.weatherState === 'fog'");
    expect(layerSource).toContain("profile.weatherState === 'sandstorm'");
    expect(layerSource).toContain("profile.weatherState === 'aurora'");
    expect(layerSource).toContain('disposeWeatherLayer');
    expect(layerSource).toContain('setAnimationLoop(null)');
    expect(layerSource).toContain('renderer.dispose()');
    expect(layerSource).toContain('controller?.dispose()');
    expect(coreTypesSource).toContain("'three-storm'");
    expect(coreTypesSource).toContain("'three-snow'");
    expect(coreTypesSource).toContain("'three-fog'");
    expect(coreTypesSource).toContain("'three-sandstorm'");
    expect(coreTypesSource).toContain("'three-cloudy'");
    expect(coreTypesSource).toContain("'three-aurora'");
    expect(coreTypesSource).toContain('WeatherRuntimeState');

    sceneAdapterSources.forEach((source) => {
      expect(source).toContain('setProfile(profile: WeatherProfile)');
      expect(source).toContain('update(_frame: WeatherFrameState, _runtime: WeatherRuntimeState)');
      expect(source).toContain('dispose()');
      expect(source).not.toContain('new THREE.BufferGeometry');
      expect(source).not.toContain('new THREE.ShaderMaterial');
      expect(source).not.toContain('new THREE.LineSegments');
      expect(source).not.toContain('new THREE.Points');
      expect(source).not.toContain('new THREE.PlaneGeometry');
      expect(source).not.toContain('geometry?.dispose()');
      expect(source).not.toContain('material?.dispose()');
      expect(source).not.toContain('EffectComposer');
      expect(source).not.toContain('WebGPURenderer');
    });

    expect(sunnySource).toContain('class SunnyWeatherScene');
    expect(sunnyLayerSource).toContain('WEATHER_PARTICLE_COUNTS.sunnyDust');
    expect(sunnyLayerSource).toContain('sunnyRadialRayFragmentShader');
    expect(sunnyLayerSource).toContain('sunnyHaloFragmentShader');
    expect(sunnyLayerSource).not.toContain('sunnyRainbowFragmentShader');
    expect(rainbowLayerSource).toContain('rainbowFragmentShader');
    expect(rainbowLayerSource).toContain('TorusGeometry');

    expect(rainSource).toContain('class RainWeatherScene');
    expect(rainLayerSource).toContain('runtime.rainIntensity');
    expect(rainLayerSource).toContain('WEATHER_PARTICLE_COUNTS.rain');
    expect(rainLayerSource).toContain('RAIN_GRAVITY = -13.4');
    expect(rainLayerSource).toContain('LineSegments');
    expect(rainLayerSource).toContain('aDrop');
    expect(rainLayerSource).toContain('depthWrite: false');
    expect(rainLayerSource).toContain('frustumCulled = false');
    expect(rainLayerSource).toContain('windForce');
    expect(rainLayerSource).toContain('dispose()');
    expect(rainLayerSource).not.toContain('Lightning');
    expect(rainHazeLayerSource).toContain('rainHaze');
    expect(rainHazeLayerSource).toContain('runtime.rainIntensity');
    expect(rainShaderSource).toContain('travelDirection');
    expect(rainShaderSource).toContain('clampedDrift');
    expect(rainShaderSource).toContain('maxRainDrift');
    expect(rainShaderSource).toContain('travelDirection = normalize(vec3(clampedDrift.x');
    expect(rainShaderSource).toContain('motionDistance = mod(fallSpeed * t');
    expect(rainShaderSource).toContain('respawnFade');
    expect(rainShaderSource).not.toContain('fallProgress');
    expect(rainShaderSource).not.toContain('wrappedY');

    expect(stormSource).toContain('class StormWeatherScene');
    expect(stormSource).not.toContain('new RainWeatherScene');
    expect(stormSource).not.toContain('EffectComposer');
    expect(stormSource).not.toContain('WebGPURenderer');
    expect(lightningLayerSource).toContain('class LightningLayer');
    expect(lightningLayerSource).toContain('INITIAL_STRIKE_DELAY_MIN = 0.25');
    expect(lightningLayerSource).toContain('INITIAL_STRIKE_DELAY_SPREAD = 0.45');
    expect(lightningLayerSource).toContain('STORM_REST_DELAY_MIN = 2.4');
    expect(lightningLayerSource).toContain('STORM_REST_DELAY_SPREAD = 3.8');
    expect(lightningLayerSource).toContain('generateBolt');
    expect(lightningLayerSource).toContain('LineSegments');
    expect(lightningLayerSource).toContain('PointLight');
    expect(lightningLayerSource).toContain('nextStrikeDelay');
    expect(lightningLayerSource).toContain('burstRemaining');
    expect(lightningLayerSource).toContain('runtime.lightningIntensity');
    expect(lightningLayerSource).toContain('dispose()');
    expect(lightningLayerSource).toContain('geometry.dispose()');
    expect(lightningLayerSource).toContain('material.dispose()');

    expect(snowSource).toContain('class SnowWeatherScene');
    expect(snowLayerSource).toContain('runtime.snowIntensity');
    expect(snowLayerSource).toContain('Points');
    expect(snowLayerSource).toContain('aSeed');
    expect(snowLayerSource).toContain('windForce');
    expect(snowLayerSource).toContain('depthWrite: false');
    expect(snowLayerSource).toContain('frustumCulled = false');
    expect(snowVeilLayerSource).toContain('snowVeil');
    expect(snowVeilLayerSource).toContain('runtime.snowIntensity');
    expect(snowShaderSource).toContain('flutter');
    expect(snowShaderSource).toContain('pointSize');
    expect(snowShaderSource).toContain('gl_PointCoord');
    expect(snowShaderSource).toContain('sparkle');
    expect(snowShaderSource).toContain('softCircle');
    expect(snowShaderSource).not.toContain('EffectComposer');

    expect(fogSource).toContain('class FogWeatherScene');
    expect(fogLayerSource).toContain('runtime.fogDensity');
    expect(fogLayerSource).toContain('FogSpriteLayer');
    expect(fogLayerSource).toContain('MIST_SPRITE_SETTINGS');
    expect(fogLayerSource).toContain('HAZE_SPRITE_SETTINGS');
    expect(fogLayerSource).toContain('windDir');
    expect(fogLayerSource).toContain('windOffset');
    expect(fogLayerSource).toContain("weatherVariant === 'haze'");
    expect(fogSpriteLayerSource).toContain('InstancedBufferGeometry');
    expect(fogSpriteLayerSource).toContain('PlaneGeometry');
    expect(fogSpriteLayerSource).toContain('ShaderMaterial');
    expect(fogSpriteLayerSource).toContain('TextureLoader');
    expect(fogSpriteLayerSource).toContain('depthWrite: false');
    expect(fogSpriteLayerSource).toContain('depthTest: false');
    expect(fogSpriteLayerSource).toContain('frustumCulled = false');
    expect(fogSpriteLayerSource).toContain('texture.dispose()');
    expect(fogSpriteShaderSource).toContain('uniform sampler2D fogMap');
    expect(fogSpriteShaderSource).toContain('windOffset');
    expect(fogSpriteShaderSource).toContain('centerClear');
    expect(fogSpriteShaderSource).toContain('readabilityRadius');
    expect(fogSpriteShaderSource).not.toContain('EffectComposer');

    expect(sandstormSource).toContain('class SandstormWeatherScene');
    expect(dustLayerSource).toContain('runtime.particleIntensity');
    expect(dustLayerSource).toContain('Points');
    expect(dustLayerSource).toContain('aSeed');
    expect(dustLayerSource).toContain('windForce');
    expect(dustLayerSource).toContain('dustColor');
    expect(dustLayerSource).toContain('depthWrite: false');
    expect(dustLayerSource).toContain('frustumCulled = false');
    expect(dustLayerSource).toContain("weatherVariant === 'dust'");
    expect(dustLayerSource).toContain('DUST_SAND_SETTINGS');
    expect(dustLayerSource).toContain('SANDSTORM_SETTINGS');
    expect(dustLayerSource).toContain('geometry?.dispose()');
    expect(dustLayerSource).toContain('material?.dispose()');
    expect(sandstormShaderSource).toContain('gl_PointCoord');
    expect(sandstormShaderSource).toContain('windForce');
    expect(sandstormShaderSource).toContain('swirl');
    expect(sandstormShaderSource).toContain('alphaFade');
    expect(sandstormShaderSource).toContain('centerClarity');
    expect(sandstormShaderSource).not.toContain('EffectComposer');
  });
});
