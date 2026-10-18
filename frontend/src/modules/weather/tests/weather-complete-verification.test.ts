import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WeatherState } from '../model';
import { weatherStateParameters } from '../core/weatherStateParameters';
import type { WeatherRenderMode } from '../core/types';
import { getWeatherOrchestrationProfile } from '../core/weatherOrchestrationProfile';
import { WEATHER_METEOR_BUDGET, WEATHER_NIGHT_SKY_BUDGET } from '../core/weatherPerformanceBudget';
import { getWeatherProfile, getWeatherRenderMode, weatherProfiles } from '../profiles/weatherProfiles';
import { ALL_CLOUD_GENERA, getSkyProfile } from '../profiles/skyProfiles';
import { CLOUD_LAYER_PROFILES, WEATHER_CLOUD_BUDGET } from '../systems/clouds/cloudLayerProfiles';
import { getNightSkyRenderProfile } from '../systems/nightSky/nightSkyProfile';

const EXPECTED_STATES: WeatherState[] = [
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

const BACKEND_RENDER_FIELDS = [
  'rainIntensity',
  'windLevel',
  'atmosphereLevel',
  'lightningLevel',
  'frostLevel',
  'wetLensLevel'
];

const FORBIDDEN_SOURCE_PATTERNS = [
  'EffectComposer',
  'html2canvas',
  'captureStream',
  'getDisplayMedia',
  'scene.background',
  'uniform sampler2D tScene',
  'tScene:',
  'uniform sampler2D tInput',
  'tInput:'
];

const WEATHER_SOURCE_AUDIT_FILES = [
  'src/modules/weather/core/createWeatherRenderer.ts',
  'src/modules/weather/core/WeatherController.ts',
  'src/modules/weather/core/weatherOrchestrationProfile.ts',
  'src/modules/weather/core/weatherPerformanceBudget.ts',
  'src/modules/weather/core/weatherStateParameters.ts',
  'src/modules/weather/profiles/skyProfiles.ts',
  'src/modules/weather/profiles/weatherProfiles.ts',
  'src/modules/weather/systems/PrecipitationSystem.ts',
  'src/modules/weather/systems/NightSkySystem.ts',
  'src/modules/weather/systems/CloudSkySystem.ts',
  'src/modules/weather/systems/AtmosphereSystem.ts',
  'src/modules/weather/systems/ElectricalSystem.ts',
  'src/modules/weather/systems/OpticalSystem.ts',
  'src/modules/weather/systems/EnvironmentSystem.ts',
  'src/modules/weather/systems/shared/viewportPlane.ts',
  'src/modules/weather/systems/nightSky/NightSkyLayer.ts',
  'src/modules/weather/systems/nightSky/nightSkyProfile.ts',
  'src/modules/weather/systems/nightSky/nightSkyShaders.ts',
  'src/modules/weather/systems/nightSky/SkyDomeLayer.ts',
  'src/modules/weather/systems/nightSky/StarfieldLayer.ts',
  'src/modules/weather/systems/nightSky/MilkyWayLayer.ts',
  'src/modules/weather/systems/nightSky/MoonLayer.ts',
  'src/modules/weather/systems/nightSky/MeteorLayer.ts',
  'src/modules/weather/systems/nightSky/meteorShaders.ts',
  'src/modules/weather/systems/clouds/CloudSkyLayer.ts',
  'src/modules/weather/systems/clouds/cloudLayerProfiles.ts',
  'src/modules/weather/systems/clouds/cloudLightingProfile.ts',
  'src/modules/weather/systems/clouds/cloudShaders.ts',
  'src/modules/weather/systems/precipitation/RainPrecipitationLayer.ts',
  'src/modules/weather/systems/precipitation/SnowPrecipitationLayer.ts',
  'src/modules/weather/systems/precipitation/HailPrecipitationLayer.ts',
  'src/modules/weather/systems/precipitation/RainSplashLayer.ts',
  'src/modules/weather/systems/atmosphere/RainHazeLayer.ts',
  'src/modules/weather/systems/atmosphere/SnowVeilLayer.ts',
  'src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts',
  'src/modules/weather/systems/atmosphere/FogSpriteLayer.ts',
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
  'src/modules/weather/systems/environment/SandstormTintLayer.ts',
  'src/modules/weather/effects/sunny/sunnyShaders.ts',
  'src/modules/weather/effects/rain/rainShaders.ts',
  'src/modules/weather/effects/rain/rainSplashShaders.ts',
  'src/modules/weather/effects/snow/snowShaders.ts',
  'src/modules/weather/systems/atmosphere/fogSpriteShaders.ts',
  'src/modules/weather/effects/sandstorm/sandstormShaders.ts',
  'src/modules/weather/effects/aurora/auroraShaders.ts',
  'src/modules/weather/effects/optical/wetLensShaders.ts',
  'src/modules/weather/effects/optical/frostShaders.ts',
  'src/modules/weather/effects/environment/wetSurfaceShaders.ts',
  'src/modules/weather/effects/environment/snowAccumulationShaders.ts',
  'src/modules/weather/effects/environment/sandstormTintShaders.ts'
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

describe('procedural-weather stage 8 complete verification matrix', () => {
  it('keeps frontend weather states, runtime parameters, profiles, and render modes aligned', () => {
    expect(Object.keys(weatherProfiles).sort()).toEqual([...EXPECTED_STATES].sort());
    expect(Object.keys(weatherStateParameters).sort()).toEqual([...EXPECTED_STATES].sort());

    EXPECTED_STATES.forEach((weatherState) => {
      const profile = getWeatherProfile({ weatherState, weatherVariant: undefined });

      expect(profile.weatherState, weatherState).toBe(weatherState);
      expect(profile.renderer, weatherState).toBe(EXPECTED_RENDER_MODES[weatherState]);
      expect(weatherStateParameters[weatherState], weatherState).toBeDefined();
      expect(getWeatherRenderMode({ weatherState, isLargeViewport: true, prefersReducedMotion: false })).toBe(
        EXPECTED_RENDER_MODES[weatherState]
      );
      expect(getWeatherRenderMode({ weatherState, isLargeViewport: false, prefersReducedMotion: false })).toBe('none');
      expect(getWeatherRenderMode({ weatherState, isLargeViewport: true, prefersReducedMotion: true })).toBe('none');
    });
  });

  it('covers profile variants that route hail, haze, dust, and aurora without backend visual knobs', () => {
    expect(
      getWeatherProfile({ weatherState: 'storm', weatherVariant: 'hailStorm', precipitationKind: 'rain' })
    ).toMatchObject({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      precipitationKind: 'hail',
      renderer: 'three-storm'
    });
    expect(getWeatherProfile({ weatherState: 'snow', weatherVariant: 'hail' })).toMatchObject({
      weatherState: 'snow',
      weatherVariant: 'hail',
      precipitationKind: 'hail',
      renderer: 'three-snow'
    });
    expect(getWeatherProfile({ weatherState: 'fog', weatherVariant: 'haze' })).toMatchObject({
      weatherState: 'fog',
      weatherVariant: 'haze',
      renderer: 'three-fog'
    });
    expect(getWeatherProfile({ weatherState: 'sandstorm', weatherVariant: 'dust' })).toMatchObject({
      weatherState: 'sandstorm',
      weatherVariant: 'dust',
      renderer: 'three-sandstorm'
    });
    expect(getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora' })).toMatchObject({
      weatherState: 'aurora',
      weatherVariant: 'aurora',
      renderer: 'three-aurora'
    });

    const frontendContractSources = [
      'src/modules/weather/model.ts',
      'src/modules/weather/internal/httpWeatherGateway.ts',
      'src/modules/weather/WeatherAtmosphere.vue',
      'src/modules/weather/profiles/weatherProfiles.ts'
    ].map(readSource);

    BACKEND_RENDER_FIELDS.forEach((field) => {
      frontendContractSources.forEach((source) => expect(source, field).not.toContain(field));
    });
  });

  it('scans weather source for forbidden post-processing and page-capture techniques', () => {
    const weatherSources = WEATHER_SOURCE_AUDIT_FILES.map((path) => {
      expect(existsSync(absolute(path)), path).toBe(true);
      return `${path}\n${readSource(path)}`;
    })
      .join('\n');

    FORBIDDEN_SOURCE_PATTERNS.forEach((pattern) => {
      expect(weatherSources, pattern).not.toContain(pattern);
    });
  });

  it('keeps backend and frontend semantic contracts aligned without backend rendering fields', () => {
    const frontendTypes = readSource('src/modules/weather/model.ts');
    const weatherVo = readProjectSource('backend/src/main/java/xyz/snowlit/weather/WeatherVos.java');
    const weatherConditions = readProjectSource('backend/src/main/java/xyz/snowlit/weather/WeatherCondition.java');

    ['weatherState', 'weatherVariant', 'precipitationKind', 'daylightHint', 'observedAt'].forEach((field) => {
      expect(frontendTypes).toContain(field);
      expect(weatherVo).toContain(field);
    });
    // Every state and variant the backend can report must be a state/variant the frontend understands.
    const backendConditions = [...weatherConditions.matchAll(/^\s+[A-Z_]+\("[^"]*", "(\w+)", "(\w+)", "(\w+)"\)/gm)];
    expect(backendConditions.length).toBeGreaterThan(10);
    backendConditions.forEach(([, weatherState, weatherVariant]) => {
      expect(EXPECTED_STATES, weatherState).toContain(weatherState);
      expect(frontendTypes, weatherVariant).toContain(`'${weatherVariant}'`);
    });
    ['weatherType', 'isDay', 'updatedAt', ...BACKEND_RENDER_FIELDS, 'intensity'].forEach((field) => {
      expect(weatherVo, field).not.toContain(field);
    });
  });

  it('declares the Stage 11 sky profile contract for later cloud and night sky systems', () => {
    expect(ALL_CLOUD_GENERA).toEqual([
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
    ]);

    expect(
      getSkyProfile({
        weatherState: 'clear',
        weatherVariant: 'clear',
        precipitationKind: 'none',
        daylightHint: 'night'
      })
    ).toMatchObject({
      cloud: {
        primary: 'cirrus',
        mood: 'nightVeil'
      },
      celestial: {
        enabled: true,
        mode: 'night',
        starVisibility: 0.85
      },
      preferCelestialDominance: true
    });
    expect(
      getSkyProfile({
        weatherState: 'storm',
        weatherVariant: 'hailStorm',
        precipitationKind: 'hail',
        daylightHint: 'night'
      })
    ).toMatchObject({
      cloud: {
        primary: 'cumulonimbus',
        internalLightningEligible: true
      },
      celestial: {
        milkyWayVisibility: 0,
        meteorRate: 0
      },
      preferWeatherDominance: true
    });
    expect(
      getSkyProfile({
        weatherState: 'aurora',
        weatherVariant: 'aurora',
        precipitationKind: 'none',
        daylightHint: 'day'
      })
    ).toMatchObject({
      daylight: 'night',
      celestial: {
        mode: 'aurora',
        auroraIntegration: true
      },
      preferCelestialDominance: true
    });
  });

  it('declares the Stage 12 procedural cloud system contract', () => {
    expect(Object.keys(CLOUD_LAYER_PROFILES).sort()).toEqual([...ALL_CLOUD_GENERA].sort());
    expect(WEATHER_CLOUD_BUDGET).toMatchObject({
      maxRenderableMeshes: 7,
      maxGeneraPerSky: 2
    });
  });

  it('declares the Stage 14 night sky core system contract', () => {
    const clearNightWeather = getWeatherProfile({
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const clearNightSky = getSkyProfile({
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const clearNight = getNightSkyRenderProfile(clearNightWeather, clearNightSky);
    const cloudyNight = getNightSkyRenderProfile(
      getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'night' }),
      getSkyProfile({
        weatherState: 'cloudy',
        weatherVariant: 'partlyCloudy',
        precipitationKind: 'none',
        daylightHint: 'night'
      })
    );
    const stormNight = getNightSkyRenderProfile(
      getWeatherProfile({ weatherState: 'storm', weatherVariant: 'hailStorm', daylightHint: 'night' }),
      getSkyProfile({
        weatherState: 'storm',
        weatherVariant: 'hailStorm',
        precipitationKind: 'hail',
        daylightHint: 'night'
      })
    );

    expect(WEATHER_NIGHT_SKY_BUDGET).toMatchObject({
      maxStars: 1800,
      maxRenderableMeshes: 7,
      maxMoonMeshes: 2
    });
    expect(clearNight.enabled).toBe(true);
    expect(clearNight.starCount).toBeLessThanOrEqual(WEATHER_NIGHT_SKY_BUDGET.maxStars);
    expect(clearNight.milkyWayOpacity).toBeGreaterThan(0.08);
    expect(cloudyNight.starCount).toBeLessThan(clearNight.starCount);
    expect(stormNight.starCount).toBeLessThanOrEqual(250);
    expect(stormNight.milkyWayOpacity).toBe(0);
  });

  it('declares the Stage 15 aurora and meteor enhancement contract', () => {
    const clearNightWeather = getWeatherProfile({
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const clearNightSky = getSkyProfile({
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      daylightHint: 'night'
    });
    const clearNight = getNightSkyRenderProfile(clearNightWeather, clearNightSky);
    const clearShower = getNightSkyRenderProfile(
      getWeatherProfile({
        weatherState: 'clear',
        weatherVariant: 'clear',
        precipitationKind: 'none',
        daylightHint: 'night',
        meteorShower: true
      }),
      clearNightSky
    );
    const cloudyNight = getNightSkyRenderProfile(
      getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'night' }),
      getSkyProfile({
        weatherState: 'cloudy',
        weatherVariant: 'partlyCloudy',
        precipitationKind: 'none',
        daylightHint: 'night'
      })
    );
    const stormShower = getNightSkyRenderProfile(
      getWeatherProfile({
        weatherState: 'storm',
        weatherVariant: 'thunderstorm',
        daylightHint: 'night',
        meteorShower: true
      }),
      getSkyProfile({
        weatherState: 'storm',
        weatherVariant: 'thunderstorm',
        precipitationKind: 'none',
        daylightHint: 'night'
      })
    );

    expect(WEATHER_METEOR_BUDGET).toMatchObject({
      maxActiveMeteors: 4,
      maxRenderableMeshes: 2
    });
    expect(clearNight.meteorRate).toBeGreaterThan(0);
    expect(clearNight.meteorMaxActive).toBe(2);
    expect(clearShower.meteorShower).toBe(true);
    expect(clearShower.meteorRate).toBeGreaterThan(clearNight.meteorRate);
    expect(cloudyNight.meteorRate).toBe(0);
    expect(stormShower.meteorRate).toBe(0);
  });

  it('declares the Stage 16 unified sky orchestration contract', () => {
    const clearDay = getWeatherOrchestrationProfile(
      getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' }),
      getSkyProfile({ weatherState: 'clear', weatherVariant: 'clear', precipitationKind: 'none', daylightHint: 'day' })
    );
    const clearNight = getWeatherOrchestrationProfile(
      getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' }),
      getSkyProfile({
        weatherState: 'clear',
        weatherVariant: 'clear',
        precipitationKind: 'none',
        daylightHint: 'night'
      })
    );
    const stormNight = getWeatherOrchestrationProfile(
      getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'night' }),
      getSkyProfile({
        weatherState: 'storm',
        weatherVariant: 'thunderstorm',
        precipitationKind: 'none',
        daylightHint: 'night'
      })
    );

    expect(clearDay).toMatchObject({
      dominance: 'clearDay',
      sunnyOpticalVisibility: 1,
      nightSkyVisibility: 0
    });
    expect(clearNight).toMatchObject({
      dominance: 'celestial',
      sunnyOpticalVisibility: 0,
      nightSkyVisibility: 1
    });
    expect(stormNight.nightSkyVisibility).toBeLessThan(0.1);
    expect(stormNight.electricalVisibility).toBe(1);
  });

});
