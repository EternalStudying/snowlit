import { describe, expect, it } from 'vitest';
import { getWeatherProfile, getWeatherRenderMode } from '../profiles/weatherProfiles';

describe('Three.js weather atmosphere', () => {
  it('maps missing fields and core states to render modes without URL weather overrides', () => {
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
      particleIntensity: 0.38
    });
    expect(getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' })).toMatchObject({
      weatherState: 'rain',
      renderer: 'three-rain',
      particleIntensity: 0.7
    });
    expect(getWeatherProfile({ weatherState: 'heavyRain', weatherVariant: 'heavyRain' })).toMatchObject({
      weatherState: 'heavyRain',
      renderer: 'three-rain',
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
    });
    expect(getWeatherProfile({ weatherState: 'storm', weatherVariant: 'hailStorm' })).toMatchObject({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      renderer: 'three-storm'
    });
    expect(getWeatherProfile({ weatherState: 'lightSnow', weatherVariant: 'lightSnow' })).toMatchObject({
      weatherState: 'lightSnow',
      renderer: 'three-snow',
      particleIntensity: 0.3,
      windMultiplier: 0.6
    });
    expect(getWeatherProfile({ weatherState: 'snow', weatherVariant: 'snow' })).toMatchObject({
      weatherState: 'snow',
      renderer: 'three-snow',
      particleIntensity: 0.7,
      windMultiplier: 1
    });
    expect(getWeatherProfile({ weatherState: 'blizzard', weatherVariant: 'heavySnow' })).toMatchObject({
      weatherState: 'blizzard',
      renderer: 'three-snow',
      particleIntensity: 1,
      windMultiplier: 3
    });
    expect(getWeatherProfile({ weatherState: 'fog', weatherVariant: 'mist' })).toMatchObject({
      weatherState: 'fog',
      weatherVariant: 'mist',
      renderer: 'three-fog',
      particleIntensity: 0.7,
      ambientWarmth: 0.18,
      windMultiplier: 0.2
    });
    expect(getWeatherProfile({ weatherState: 'fog', weatherVariant: 'haze' })).toMatchObject({
      weatherState: 'fog',
      weatherVariant: 'haze',
      renderer: 'three-fog',
      particleIntensity: 0.5,
      ambientWarmth: 0.24,
      windMultiplier: 0.12
    });
    expect(getWeatherProfile({ weatherState: 'sandstorm', weatherVariant: 'sandstorm' })).toMatchObject({
      weatherState: 'sandstorm',
      weatherVariant: 'sandstorm',
      renderer: 'three-sandstorm',
      particleIntensity: 1,
      ambientWarmth: 0.18,
      windMultiplier: 3
    });
    expect(getWeatherProfile({ weatherState: 'sandstorm', weatherVariant: 'dust' })).toMatchObject({
      weatherState: 'sandstorm',
      weatherVariant: 'dust',
      renderer: 'three-sandstorm',
      particleIntensity: 0.45,
      ambientWarmth: 0.26,
      windMultiplier: 1.6
    });
    expect(getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora' })).toMatchObject({
      weatherState: 'aurora',
      weatherVariant: 'aurora',
      renderer: 'three-aurora',
      particleIntensity: 0.64
    });
    expect(getWeatherProfile({ weatherState: 'snow', weatherVariant: 'hail' })).toMatchObject({
      weatherState: 'snow',
      weatherVariant: 'hail',
      renderer: 'three-snow'
    });
    expect(getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'windy' })).toMatchObject({
      renderer: 'three-cloudy',
    });
    expect(getWeatherProfile({ weatherState: undefined, weatherVariant: undefined })).toMatchObject({
      renderer: 'three-cloudy',
    });
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
      'src/modules/weather/effects/sunny/sunnyShaders.ts',
      'src/modules/weather/effects/rain/rainShaders.ts',
      'src/modules/weather/effects/snow/snowShaders.ts',
      'src/modules/weather/effects/sandstorm/sandstormShaders.ts',
      'src/modules/weather/effects/aurora/auroraShaders.ts'
    ];
  });
});
