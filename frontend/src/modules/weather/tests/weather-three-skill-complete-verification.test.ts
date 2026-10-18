import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeatherState } from '../model';
import { weatherStateParameters } from '../core/weatherStateParameters';
import { resolveWeatherTransitionRoute } from '../core/weatherTransitionRoutes';
import {
  WEATHER_CLOUD_BUDGET,
  WEATHER_LIGHTNING_BUDGET,
  WEATHER_METEOR_BUDGET,
  WEATHER_NIGHT_SKY_BUDGET,
  WEATHER_PARTICLE_COUNTS,
  WEATHER_PERFORMANCE_BUDGET,
  WEATHER_RENDERABLE_BUDGET
} from '../core/weatherPerformanceBudget';
import { getWeatherOrchestrationProfile } from '../core/weatherOrchestrationProfile';
import type { WeatherRenderMode } from '../core/types';
import { getWeatherProfile, getWeatherRenderMode, weatherProfiles } from '../profiles/weatherProfiles';
import { ALL_CLOUD_GENERA, getSkyProfile } from '../profiles/skyProfiles';
import { CLOUD_LAYER_PROFILES, getCloudLayerProfile } from '../systems/clouds/cloudLayerProfiles';
import { getCloudLightingProfile } from '../systems/clouds/cloudLightingProfile';
import { getNightSkyRenderProfile } from '../systems/nightSky/nightSkyProfile';

const EXPECTED_WEATHER_STATES: WeatherState[] = [
  'clear',
  'cloudy',
  'drizzle',
  'rain',
  'heavyRain',
  'storm',
  'lightSnow',
  'snow',
  'blizzard',
  'fog',
  'sandstorm',
  'aurora'
];

const EXPECTED_RENDER_MODES: Record<WeatherState, WeatherRenderMode> = {
  clear: 'three-clear',
  cloudy: 'three-cloudy',
  drizzle: 'three-rain',
  rain: 'three-rain',
  heavyRain: 'three-rain',
  storm: 'three-storm',
  lightSnow: 'three-snow',
  snow: 'three-snow',
  blizzard: 'three-snow',
  fog: 'three-fog',
  sandstorm: 'three-sandstorm',
  aurora: 'three-aurora'
};

const EXPECTED_CLOUD_GENERA = [
  'cumulus',
  'stratus',
  'stratocumulus',
  'cumulonimbus',
  'altocumulus',
  'altostratus',
  'nimbostratus',
  'cirrus',
  'cirrostratus',
  'cirrocumulus'
];

const FORBIDDEN_SOURCE_PATTERNS = [
  'EffectComposer',
  'html2canvas',
  'captureStream',
  'getDisplayMedia',
  'scene.background',
  'tScene',
  'tInput'
];

const FRONTEND_RENDER_FIELDS = [
  'rainIntensity',
  'windLevel',
  'atmosphereLevel',
  'lightningLevel',
  'frostLevel',
  'wetLensLevel'
];

const BACKEND_RESPONSE_FORBIDDEN_FIELDS = [
  'intensity',
  'windLevel',
  'atmosphereLevel',
  'lightningLevel',
  'frostLevel',
  'wetLensLevel'
];

const WEATHER_SOURCE_AUDIT_FILES = [
  'src/modules/weather/core/createWeatherRenderer.ts',
  'src/modules/weather/core/WeatherController.ts',
  'src/modules/weather/core/weatherLayerLoading.ts',
  'src/modules/weather/core/weatherOrchestrationProfile.ts',
  'src/modules/weather/core/weatherPerformanceBudget.ts',
  'src/modules/weather/core/weatherStateParameters.ts',
  'src/modules/weather/core/weatherTransitionRoutes.ts',
  'src/modules/weather/core/WindSystem.ts',
  'src/modules/weather/profiles/skyProfiles.ts',
  'src/modules/weather/profiles/weatherProfiles.ts',
  'src/modules/weather/systems/PrecipitationSystem.ts',
  'src/modules/weather/systems/AtmosphereSystem.ts',
  'src/modules/weather/systems/ElectricalSystem.ts',
  'src/modules/weather/systems/OpticalSystem.ts',
  'src/modules/weather/systems/EnvironmentSystem.ts',
  'src/modules/weather/systems/CloudSkySystem.ts',
  'src/modules/weather/systems/NightSkySystem.ts',
  'src/modules/weather/systems/shared/viewportPlane.ts',
  'src/modules/weather/systems/precipitation/RainPrecipitationLayer.ts',
  'src/modules/weather/systems/precipitation/RainSplashLayer.ts',
  'src/modules/weather/systems/precipitation/SnowPrecipitationLayer.ts',
  'src/modules/weather/systems/precipitation/HailPrecipitationLayer.ts',
  'src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts',
  'src/modules/weather/systems/atmosphere/FogSpriteLayer.ts',
  'src/modules/weather/systems/atmosphere/DustAtmosphereLayer.ts',
  'src/modules/weather/systems/atmosphere/RainHazeLayer.ts',
  'src/modules/weather/systems/atmosphere/SnowVeilLayer.ts',
  'src/modules/weather/systems/atmosphere/fogSpriteShaders.ts',
  'src/modules/weather/systems/electrical/LightningLayer.ts',
  'src/modules/weather/systems/electrical/DustLightningLayer.ts',
  'src/modules/weather/systems/optical/SunnyOpticalLayer.ts',
  'src/modules/weather/systems/optical/RainbowOpticalLayer.ts',
  'src/modules/weather/systems/optical/WetLensOverlayLayer.ts',
  'src/modules/weather/systems/optical/FrostOverlayLayer.ts',
  'src/modules/weather/systems/optical/AuroraOpticalLayer.ts',
  'src/modules/weather/systems/environment/WetSurfaceLayer.ts',
  'src/modules/weather/systems/environment/SnowAccumulationLayer.ts',
  'src/modules/weather/systems/environment/SandstormTintLayer.ts',
  'src/modules/weather/systems/clouds/CloudSkyLayer.ts',
  'src/modules/weather/systems/clouds/cloudLayerProfiles.ts',
  'src/modules/weather/systems/clouds/cloudLightingProfile.ts',
  'src/modules/weather/systems/clouds/cloudShaders.ts',
  'src/modules/weather/systems/nightSky/NightSkyLayer.ts',
  'src/modules/weather/systems/nightSky/SkyDomeLayer.ts',
  'src/modules/weather/systems/nightSky/StarfieldLayer.ts',
  'src/modules/weather/systems/nightSky/MilkyWayLayer.ts',
  'src/modules/weather/systems/nightSky/MoonLayer.ts',
  'src/modules/weather/systems/nightSky/MeteorLayer.ts',
  'src/modules/weather/systems/nightSky/nightSkyProfile.ts',
  'src/modules/weather/systems/nightSky/nightSkyShaders.ts',
  'src/modules/weather/systems/nightSky/meteorShaders.ts'
];

function absolute(path: string) {
  return resolve(process.cwd(), path);
}

function readSource(path: string) {
  return readFileSync(absolute(path), 'utf8');
}

function readProjectSource(path: string) {
  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
}

function profileBundle(input: Parameters<typeof getWeatherProfile>[0]) {
  const weatherProfile = getWeatherProfile(input);
  const skyProfile = getSkyProfile({
    weatherState: weatherProfile.weatherState,
    weatherVariant: weatherProfile.weatherVariant,
    precipitationKind: weatherProfile.precipitationKind,
    daylightHint: weatherProfile.daylightHint ?? 'unknown'
  });

  return {
    weatherProfile,
    skyProfile,
    orchestration: getWeatherOrchestrationProfile(weatherProfile, skyProfile),
    cloudLighting: getCloudLightingProfile(weatherProfile, skyProfile),
    nightSky: getNightSkyRenderProfile(weatherProfile, skyProfile)
  };
}

describe('procedural-weather/clouds/starfield stage 17 complete verification contract', () => {
  it('covers the procedural-weather state, render mode, profile, transition, and runtime matrix', () => {
    expect(Object.keys(weatherProfiles).sort()).toEqual([...EXPECTED_WEATHER_STATES].sort());
    expect(Object.keys(weatherStateParameters).sort()).toEqual([...EXPECTED_WEATHER_STATES].sort());

    EXPECTED_WEATHER_STATES.forEach((weatherState) => {
      const profile = getWeatherProfile({ weatherState, weatherVariant: undefined });
      const parameters = weatherStateParameters[weatherState];

      expect(profile.renderer, weatherState).toBe(EXPECTED_RENDER_MODES[weatherState]);
      expect(getWeatherRenderMode({ weatherState, isLargeViewport: true, prefersReducedMotion: false })).toBe(
        EXPECTED_RENDER_MODES[weatherState]
      );
      expect(getWeatherRenderMode({ weatherState, isLargeViewport: false, prefersReducedMotion: false })).toBe('none');
      expect(getWeatherRenderMode({ weatherState, isLargeViewport: true, prefersReducedMotion: true })).toBe('none');
      expect(parameters.rain, `${weatherState}.rain`).toBeGreaterThanOrEqual(0);
      expect(parameters.rain, `${weatherState}.rain`).toBeLessThanOrEqual(1);
      expect(parameters.snow, `${weatherState}.snow`).toBeGreaterThanOrEqual(0);
      expect(parameters.snow, `${weatherState}.snow`).toBeLessThanOrEqual(1);
      expect(parameters.lightning, `${weatherState}.lightning`).toBeGreaterThanOrEqual(0);
      expect(parameters.lightning, `${weatherState}.lightning`).toBeLessThanOrEqual(1);
    });

    expect(readSource('src/modules/weather/profiles/weatherProfiles.ts')).not.toContain('resolveWeatherStateWithOverride');
    expect(resolveWeatherTransitionRoute('clear', 'storm')).toEqual(['cloudy', 'rain', 'heavyRain', 'storm']);
    expect(resolveWeatherTransitionRoute('storm', 'clear')).toEqual(['rain', 'cloudy', 'clear']);
    expect(resolveWeatherTransitionRoute('clear', 'blizzard')).toEqual(['lightSnow', 'snow', 'blizzard']);
    expect(resolveWeatherTransitionRoute('aurora', 'clear')).toEqual(['clear']);

    expect(profileBundle({ weatherState: 'storm', weatherVariant: 'hailStorm', precipitationKind: 'rain' }).weatherProfile)
      .toMatchObject({ weatherState: 'storm', weatherVariant: 'hailStorm', precipitationKind: 'hail' });
    expect(profileBundle({ weatherState: 'fog', weatherVariant: 'haze' }).weatherProfile).toMatchObject({
      weatherState: 'fog',
      weatherVariant: 'haze'
    });
    expect(profileBundle({ weatherState: 'sandstorm', weatherVariant: 'dust' }).weatherProfile).toMatchObject({
      weatherState: 'sandstorm',
      weatherVariant: 'dust'
    });
    expect(profileBundle({ weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' }).orchestration)
      .toMatchObject({ dominance: 'aurora', auroraVisibility: 1 });
  });

  it('keeps weather visual effects system-owned without backend visual knobs', () => {
    const precipitationSource = readSource('src/modules/weather/systems/PrecipitationSystem.ts');
    const opticalSource = readSource('src/modules/weather/systems/OpticalSystem.ts');
    const environmentSource = readSource('src/modules/weather/systems/EnvironmentSystem.ts');
    const controllerSource = readSource('src/modules/weather/core/WeatherController.ts');

    [
      'RainPrecipitationLayer',
      'RainSplashLayer',
      'HailPrecipitationLayer',
      'SnowPrecipitationLayer'
    ].forEach((token) => expect(precipitationSource).toContain(token));
    ['WetLensOverlayLayer', 'FrostOverlayLayer', 'RainbowOpticalLayer', 'AuroraOpticalLayer'].forEach((token) =>
      expect(opticalSource).toContain(token)
    );
    ['WetSurfaceLayer', 'SnowAccumulationLayer', 'SandstormTintLayer'].forEach((token) =>
      expect(environmentSource).toContain(token)
    );
    ['PrecipitationSystem', 'AtmosphereSystem', 'ElectricalSystem', 'OpticalSystem', 'EnvironmentSystem'].forEach(
      (token) => expect(controllerSource).toContain(token)
    );
    expect(WEATHER_PARTICLE_COUNTS.rain).toBeGreaterThanOrEqual(WEATHER_PERFORMANCE_BUDGET.rain.min);
    expect(WEATHER_PARTICLE_COUNTS.rainSplash).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.splash.max);
    expect(WEATHER_LIGHTNING_BUDGET.maxActiveBolts).toBeLessThanOrEqual(3);
    expect(WEATHER_RENDERABLE_BUDGET.stormBurst).toBeLessThanOrEqual(12);

    const frontendContractSources = [
      'src/modules/weather/model.ts',
      'src/modules/weather/internal/httpWeatherGateway.ts',
      'src/modules/weather/WeatherAtmosphere.vue',
      'src/modules/weather/profiles/weatherProfiles.ts'
    ].map(readSource);
    FRONTEND_RENDER_FIELDS.forEach((field) => {
      frontendContractSources.forEach((source) => expect(source, field).not.toContain(field));
    });
  });

  it('covers procedural-clouds profiles, cloud layer ownership, lighting, and day/night coloring', () => {
    expect(ALL_CLOUD_GENERA).toEqual(EXPECTED_CLOUD_GENERA);
    expect(Object.keys(CLOUD_LAYER_PROFILES).sort()).toEqual([...ALL_CLOUD_GENERA].sort());
    expect(WEATHER_CLOUD_BUDGET).toMatchObject({ maxRenderableMeshes: 7, maxGeneraPerSky: 2 });

    ALL_CLOUD_GENERA.forEach((genus) => {
      const profile = getCloudLayerProfile(genus);

      expect(profile.genus).toBe(genus);
      expect(profile.coverage).toBeGreaterThanOrEqual(0);
      expect(profile.coverage).toBeLessThanOrEqual(1);
      expect(profile.opacity).toBeGreaterThanOrEqual(0);
      expect(profile.opacity).toBeLessThanOrEqual(1);
    });
    expect(getCloudLayerProfile('cumulonimbus')).toMatchObject({ altitudeBand: 'towering' });
    expect(getCloudLayerProfile('cirrus')).toMatchObject({ altitudeBand: 'high' });
    expect(getCloudLayerProfile('stratus')).toMatchObject({ altitudeBand: 'low' });

    const clearDay = profileBundle({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const cloudyDay = profileBundle({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'day' });
    const overcastDay = profileBundle({ weatherState: 'cloudy', weatherVariant: 'overcast', daylightHint: 'day' });
    const storm = profileBundle({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'day' });
    const cloudyNight = profileBundle({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'night' });
    const dust = profileBundle({ weatherState: 'sandstorm', weatherVariant: 'dust', daylightHint: 'day' });

    expect(clearDay.skyProfile.cloud).toMatchObject({ primary: 'cumulus', secondary: 'cirrus' });
    expect(clearDay.cloudLighting.silverLining).toBeGreaterThan(0.25);
    expect(storm.skyProfile.cloud).toMatchObject({ primary: 'cumulonimbus', internalLightningEligible: true });
    expect(storm.cloudLighting.internalLightSensitivity).toBeGreaterThan(0.75);
    expect(cloudyNight.cloudLighting.daylightBlend).toBeLessThan(0.15);
    expect(cloudyNight.cloudLighting.cloudTint[2]).toBeGreaterThan(cloudyNight.cloudLighting.cloudTint[0]);
    expect(dust.cloudLighting.cloudTint[0]).toBeGreaterThan(dust.cloudLighting.cloudTint[2]);

    const cloudSystemSource = readSource('src/modules/weather/systems/CloudSkySystem.ts');
    const cloudLayerSource = readSource('src/modules/weather/systems/clouds/CloudSkyLayer.ts');
    const cloudShaderSource = readSource('src/modules/weather/systems/clouds/cloudShaders.ts');

    expect(cloudSystemSource).toContain("import('./clouds/CloudSkyLayer')");
    expect(cloudLayerSource).toContain('cloud-sky-system');
    expect(cloudLayerSource).toContain('PlaneGeometry(1, 1, 5, 5)');
    expect(cloudLayerSource).not.toContain('InstancedBufferGeometry');
    expect(cloudShaderSource).toContain('uTxtShape');
    expect(cloudShaderSource).toContain('uTxtCloudNoise');
  });

  it('covers procedural-starfield sky dome, starfield, Milky Way, moon, meteor, aurora integration, and strong-weather suppression', () => {
    const clearNight = profileBundle({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });
    const clearDay = profileBundle({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const clearShower = profileBundle({
      weatherState: 'clear',
      weatherVariant: 'clear',
      daylightHint: 'night',
      meteorShower: true
    });
    const cloudyNight = profileBundle({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'night' });
    const aurora = profileBundle({ weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' });
    const stormNight = profileBundle({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'night' });
    const fogNight = profileBundle({ weatherState: 'fog', weatherVariant: 'haze', daylightHint: 'night' });
    const sandstormNight = profileBundle({
      weatherState: 'sandstorm',
      weatherVariant: 'sandstorm',
      daylightHint: 'night'
    });

    expect(WEATHER_NIGHT_SKY_BUDGET).toMatchObject({ maxStars: 1800, maxRenderableMeshes: 7, maxMoonMeshes: 2 });
    expect(WEATHER_METEOR_BUDGET).toMatchObject({ maxActiveMeteors: 4, maxRenderableMeshes: 2 });
    expect(clearDay.nightSky.enabled).toBe(false);
    expect(clearNight.nightSky.enabled).toBe(true);
    expect(clearNight.nightSky.starCount).toBeGreaterThanOrEqual(1400);
    expect(clearNight.nightSky.milkyWayOpacity).toBeGreaterThan(0.08);
    expect(clearNight.nightSky.moonOpacity).toBeGreaterThan(0.3);
    expect(clearNight.nightSky.meteorRate).toBeGreaterThan(0);
    expect(clearShower.nightSky.meteorShower).toBe(true);
    expect(clearShower.nightSky.meteorMaxActive).toBe(WEATHER_METEOR_BUDGET.maxActiveMeteors);
    expect(cloudyNight.nightSky.starCount).toBeLessThan(clearNight.nightSky.starCount);
    expect(cloudyNight.orchestration.cloudVisibility).toBeGreaterThan(cloudyNight.orchestration.nightSkyVisibility);
    expect(aurora.nightSky.mode).toBe('aurora');
    expect(aurora.nightSky.auroraBlend).toBe(1);
    expect(aurora.orchestration.auroraVisibility).toBeGreaterThan(aurora.orchestration.nightSkyVisibility);

    [stormNight, fogNight, sandstormNight].forEach((bundle) => {
      expect(bundle.nightSky.starCount).toBeLessThanOrEqual(250);
      expect(bundle.nightSky.milkyWayOpacity).toBe(0);
      expect(bundle.nightSky.meteorRate).toBe(0);
      expect(bundle.orchestration.meteorVisibilityMultiplier).toBe(0);
    });

    const nightSystemSource = readSource('src/modules/weather/systems/NightSkySystem.ts');
    const nightLayerSource = readSource('src/modules/weather/systems/nightSky/NightSkyLayer.ts');
    const starfieldSource = readSource('src/modules/weather/systems/nightSky/StarfieldLayer.ts');
    const moonSource = readSource('src/modules/weather/systems/nightSky/MoonLayer.ts');
    const meteorSource = readSource('src/modules/weather/systems/nightSky/MeteorLayer.ts');
    const auroraSource = readSource('src/modules/weather/systems/optical/AuroraOpticalLayer.ts');

    expect(nightSystemSource).toContain("import('./nightSky/NightSkyLayer')");
    ['SkyDomeLayer', 'StarfieldLayer', 'MilkyWayLayer', 'MoonLayer', 'MeteorLayer'].forEach((token) =>
      expect(nightLayerSource).toContain(token)
    );
    expect(starfieldSource).toContain('THREE.Points');
    expect(starfieldSource).toContain('aStarData');
    expect(moonSource).toContain('night-moon-glow');
    expect(meteorSource).toContain('night-meteor-system');
    expect(meteorSource).not.toContain('setInterval');
    expect(auroraSource).not.toContain('aurora-star-field');
  });

  it('keeps degradation gates, backend semantic contract, and forbidden source scan intact', () => {
    const appSource = readSource('src/App.vue');
    const atmosphereSource = readSource('src/modules/weather/WeatherAtmosphere.vue');
    const backendVoSource = readProjectSource('backend/src/main/java/xyz/snowlit/weather/WeatherVos.java');
    const backendModuleTestSource = readProjectSource('backend/src/test/java/xyz/snowlit/weather/WeatherModuleTests.java');
    const backendControllerTestSource = readProjectSource(
      'backend/src/test/java/xyz/snowlit/weather/WeatherControllerTests.java'
    );

    expect(atmosphereSource).toContain("const LARGE_VIEWPORT_QUERY = '(max-width: 1020px)'");
    expect(atmosphereSource).toContain("const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'");
    expect(appSource).toContain('route.matched.length > 0 && !isImmersiveRoute.value');
    ['city', 'district', 'province', 'country', 'weatherState', 'weatherVariant', 'precipitationKind', 'daylightHint', 'observedAt'].forEach(
      (field) => expect(backendVoSource).toContain(field)
    );
    BACKEND_RESPONSE_FORBIDDEN_FIELDS.forEach((field) => {
      expect(backendVoSource, field).not.toContain(field);
      expect(backendModuleTestSource, field).toContain(field);
    });
    ['weatherType', 'isDay', 'updatedAt'].forEach((field) => {
      expect(backendControllerTestSource).toContain(`jsonPath("$.${field}").doesNotExist()`);
    });
    const backendConditionSource = readProjectSource('backend/src/main/java/xyz/snowlit/weather/WeatherCondition.java');
    ['hailStorm', 'thunderstorm', 'heavyRain', 'lightSnow', 'snow', 'unknown'].forEach((mappingToken) =>
      expect(backendConditionSource).toContain(mappingToken)
    );

    const auditedSources = WEATHER_SOURCE_AUDIT_FILES.map((path) => {
      expect(existsSync(absolute(path)), path).toBe(true);
      return `${path}\n${readSource(path)}`;
    }).join('\n');
    FORBIDDEN_SOURCE_PATTERNS.forEach((pattern) => {
      expect(auditedSources, pattern).not.toContain(pattern);
    });
  });

});
