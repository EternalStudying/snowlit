import type { DaylightHint, PrecipitationKind, WeatherState, WeatherVariant } from '../model';

export type CloudGenus =
  | 'cumulus'
  | 'stratus'
  | 'stratocumulus'
  | 'cumulonimbus'
  | 'altocumulus'
  | 'altostratus'
  | 'nimbostratus'
  | 'cirrus'
  | 'cirrostratus'
  | 'cirrocumulus';

export type CloudMood =
  | 'clearDay'
  | 'partlyCloudy'
  | 'overcast'
  | 'rainBearing'
  | 'stormTower'
  | 'snowCeiling'
  | 'fogVeil'
  | 'dustSuppressed'
  | 'nightVeil';

export type CelestialMode = 'off' | 'twilight' | 'night' | 'aurora';

export interface CloudProfile {
  enabled: boolean;
  mood: CloudMood;
  primary: CloudGenus;
  secondary?: CloudGenus;
  coverage: number;
  opacity: number;
  density: number;
  altitude: 'low' | 'mid' | 'high' | 'towering';
  drift: number;
  morph: number;
  silverLiningEligible: boolean;
  internalLightningEligible: boolean;
  suppressByWeather: boolean;
}

export interface CelestialProfile {
  mode: CelestialMode;
  enabled: boolean;
  starVisibility: number;
  milkyWayVisibility: number;
  moonVisibility: number;
  horizonGlow: number;
  meteorRate: number;
  auroraIntegration: boolean;
}

export interface SkyProfile {
  daylight: DaylightHint;
  cloud: CloudProfile;
  celestial: CelestialProfile;
  preferWeatherDominance: boolean;
  preferCloudDominance: boolean;
  preferCelestialDominance: boolean;
  reason: string;
}

export interface SkyProfileInput {
  weatherState: WeatherState;
  weatherVariant: WeatherVariant;
  precipitationKind?: PrecipitationKind;
  daylightHint: DaylightHint;
}

export const ALL_CLOUD_GENERA: CloudGenus[] = [
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

const OFF_CELESTIAL: CelestialProfile = {
  mode: 'off',
  enabled: false,
  starVisibility: 0,
  milkyWayVisibility: 0,
  moonVisibility: 0,
  horizonGlow: 0,
  meteorRate: 0,
  auroraIntegration: false
};

function cloudProfile(overrides: Partial<CloudProfile> & Pick<CloudProfile, 'mood' | 'primary'>): CloudProfile {
  return {
    enabled: true,
    secondary: undefined,
    coverage: 0.3,
    opacity: 0.32,
    density: 0.26,
    altitude: 'mid',
    drift: 0.25,
    morph: 0.2,
    silverLiningEligible: false,
    internalLightningEligible: false,
    suppressByWeather: false,
    ...overrides
  };
}

function celestialForClear(daylight: DaylightHint): CelestialProfile {
  if (daylight === 'night') {
    return {
      mode: 'night',
      enabled: true,
      starVisibility: 0.85,
      milkyWayVisibility: 0.18,
      moonVisibility: 0.45,
      horizonGlow: 0.28,
      meteorRate: 0.04,
      auroraIntegration: false
    };
  }

  if (daylight === 'unknown') {
    return OFF_CELESTIAL;
  }

  return OFF_CELESTIAL;
}

function celestialForCloudy(daylight: DaylightHint): CelestialProfile {
  if (daylight !== 'night') {
    return OFF_CELESTIAL;
  }

  return {
    mode: 'night',
    enabled: true,
    starVisibility: 0.25,
    milkyWayVisibility: 0.03,
    moonVisibility: 0.18,
    horizonGlow: 0.22,
    meteorRate: 0,
    auroraIntegration: false
  };
}

function suppressedCelestial(daylight: DaylightHint, starVisibility = 0.08, moonVisibility = 0.06): CelestialProfile {
  if (daylight !== 'night') {
    return OFF_CELESTIAL;
  }

  return {
    mode: 'night',
    enabled: starVisibility > 0,
    starVisibility,
    milkyWayVisibility: 0,
    moonVisibility,
    horizonGlow: 0.14,
    meteorRate: 0,
    auroraIntegration: false
  };
}

function auroraCelestial(): CelestialProfile {
  return {
    mode: 'aurora',
    enabled: true,
    starVisibility: 0.7,
    milkyWayVisibility: 0.12,
    moonVisibility: 0.18,
    horizonGlow: 0.26,
    meteorRate: 0.06,
    auroraIntegration: true
  };
}

function isHailStorm(weatherVariant: WeatherVariant, precipitationKind?: PrecipitationKind) {
  return weatherVariant === 'hailStorm' || weatherVariant === 'hail' || precipitationKind === 'hail';
}

function isNightLike(daylight: DaylightHint, weatherState: WeatherState) {
  return daylight === 'night' || weatherState === 'aurora';
}

export function getSkyProfile(input: SkyProfileInput): SkyProfile {
  const daylight: DaylightHint = input.weatherState === 'aurora' ? 'night' : input.daylightHint;
  const nightLike = isNightLike(daylight, input.weatherState);

  if (input.weatherState === 'aurora') {
    return {
      daylight,
      cloud: cloudProfile({
        enabled: true,
        mood: 'nightVeil',
        primary: 'cirrus',
        coverage: 0.12,
        opacity: 0.12,
        density: 0.08,
        altitude: 'high',
        drift: 0.16,
        morph: 0.1,
        suppressByWeather: true
      }),
      celestial: auroraCelestial(),
      preferWeatherDominance: false,
      preferCloudDominance: false,
      preferCelestialDominance: true,
      reason: 'aurora forces night-sky semantics with weak cirrus only'
    };
  }

  if (input.weatherState === 'clear') {
    const clearCloud =
      daylight === 'day'
        ? cloudProfile({
            mood: 'clearDay',
            primary: 'cumulus',
            secondary: 'cirrus',
            coverage: 0.16,
            opacity: 0.34,
            density: 0.18,
            altitude: 'low',
            drift: 0.22,
            morph: 0.2,
            silverLiningEligible: true
          })
        : nightLike
          ? cloudProfile({
              mood: 'nightVeil',
              primary: 'cirrus',
              coverage: 0.08,
              opacity: 0.12,
              density: 0.08,
              altitude: 'high',
              drift: 0.14,
              morph: 0.08
            })
          : cloudProfile({
              mood: 'clearDay',
              primary: 'cirrus',
              secondary: 'cirrostratus',
              coverage: 0.22,
              opacity: 0.26,
              density: 0.14,
              altitude: 'high',
              drift: 0.18,
              morph: 0.12,
              silverLiningEligible: true
            });

    return {
      daylight,
      cloud: clearCloud,
      celestial: celestialForClear(daylight),
      preferWeatherDominance: false,
      preferCloudDominance: false,
      preferCelestialDominance: nightLike,
      reason: nightLike ? 'clear night gives celestial layers priority' : 'clear day keeps only sparse fair-weather clouds'
    };
  }

  if (input.weatherState === 'cloudy') {
    const overcast = input.weatherVariant === 'overcast';

    return {
      daylight,
      cloud: overcast
        ? cloudProfile({
            mood: 'overcast',
            primary: 'stratus',
            secondary: 'altostratus',
          coverage: 0.88,
            opacity: 0.8,
            density: 0.7,
            altitude: 'low',
            drift: 0.2,
            morph: 0.16
          })
        : cloudProfile({
            mood: 'partlyCloudy',
            primary: 'cumulus',
            secondary: 'stratocumulus',
            coverage: 0.58,
            opacity: 0.68,
            density: 0.56,
            altitude: 'low',
            drift: 0.35,
            morph: 0.42,
            silverLiningEligible: true
          }),
      celestial: celestialForCloudy(daylight),
      preferWeatherDominance: false,
      preferCloudDominance: true,
      preferCelestialDominance: false,
      reason: overcast ? 'overcast sky should dominate with a flat low cloud deck' : 'partly cloudy sky keeps visible cloud gaps'
    };
  }

  if (input.weatherState === 'drizzle') {
    return {
      daylight,
      cloud: cloudProfile({
        mood: 'rainBearing',
        primary: 'stratus',
        secondary: 'nimbostratus',
        coverage: 0.76,
        opacity: 0.62,
        density: 0.54,
        altitude: 'low',
        drift: 0.26,
        morph: 0.18
      }),
      celestial: suppressedCelestial(daylight, 0.12, 0.08),
      preferWeatherDominance: false,
      preferCloudDominance: true,
      preferCelestialDominance: false,
      reason: 'drizzle is led by low rain-bearing cloud'
    };
  }

  if (input.weatherState === 'rain' || input.weatherState === 'heavyRain') {
    const heavy = input.weatherState === 'heavyRain';

    return {
      daylight,
      cloud: cloudProfile({
        mood: 'rainBearing',
        primary: 'nimbostratus',
        secondary: heavy ? 'cumulonimbus' : 'stratus',
        coverage: heavy ? 0.96 : 0.84,
        opacity: heavy ? 0.82 : 0.7,
        density: heavy ? 0.86 : 0.68,
        altitude: 'mid',
        drift: heavy ? 0.34 : 0.28,
        morph: heavy ? 0.22 : 0.18
      }),
      celestial: suppressedCelestial(daylight, heavy ? 0.06 : 0.1, heavy ? 0.04 : 0.08),
      preferWeatherDominance: true,
      preferCloudDominance: true,
      preferCelestialDominance: false,
      reason: heavy ? 'heavy rain suppresses night sky and thickens nimbostratus' : 'steady rain keeps rain-bearing cloud dominant'
    };
  }

  if (input.weatherState === 'storm') {
    return {
      daylight,
      cloud: cloudProfile({
        mood: 'stormTower',
        primary: 'cumulonimbus',
        secondary: 'nimbostratus',
        coverage: 1,
        opacity: 0.9,
        density: 0.95,
        altitude: 'towering',
        drift: 0.42,
        morph: 0.32,
        internalLightningEligible: true
      }),
      celestial: suppressedCelestial(daylight, isHailStorm(input.weatherVariant, input.precipitationKind) ? 0.06 : 0.08, 0.05),
      preferWeatherDominance: true,
      preferCloudDominance: true,
      preferCelestialDominance: false,
      reason: isHailStorm(input.weatherVariant, input.precipitationKind)
        ? 'hail storm uses cumulonimbus with internal lightning hooks'
        : 'storm uses towering cumulonimbus with lightning hooks'
    };
  }

  if (input.weatherState === 'lightSnow' || input.weatherState === 'snow' || input.weatherState === 'blizzard') {
    const snowClouds: Record<typeof input.weatherState, CloudProfile> = {
      lightSnow: cloudProfile({
        mood: 'snowCeiling',
        primary: 'altostratus',
        secondary: 'cirrostratus',
        coverage: 0.62,
        opacity: 0.52,
        density: 0.4,
        altitude: 'mid',
        drift: 0.2,
        morph: 0.14
      }),
      snow: cloudProfile({
        mood: 'snowCeiling',
        primary: 'altostratus',
        secondary: 'nimbostratus',
        coverage: 0.82,
        opacity: 0.68,
        density: 0.58,
        altitude: 'mid',
        drift: 0.24,
        morph: 0.18
      }),
      blizzard: cloudProfile({
        mood: 'snowCeiling',
        primary: 'nimbostratus',
        secondary: 'altostratus',
        coverage: 0.98,
        opacity: 0.86,
        density: 0.9,
        altitude: 'mid',
        drift: 0.5,
        morph: 0.24,
        suppressByWeather: true
      })
    };

    return {
      daylight,
      cloud: snowClouds[input.weatherState],
      celestial: suppressedCelestial(daylight, input.weatherState === 'lightSnow' ? 0.12 : 0.08, 0.08),
      preferWeatherDominance: input.weatherState !== 'lightSnow',
      preferCloudDominance: true,
      preferCelestialDominance: false,
      reason: `${input.weatherState} uses cold snow-ceiling cloud semantics`
    };
  }

  if (input.weatherState === 'fog') {
    const haze = input.weatherVariant === 'haze';

    return {
      daylight,
      cloud: cloudProfile({
        mood: 'fogVeil',
        primary: 'stratus',
        secondary: haze ? 'altostratus' : undefined,
        coverage: haze ? 0.34 : 0.24,
        opacity: haze ? 0.24 : 0.18,
        density: haze ? 0.28 : 0.2,
        altitude: 'low',
        drift: haze ? 0.1 : 0.14,
        morph: 0.08,
        suppressByWeather: true
      }),
      celestial: suppressedCelestial(daylight, haze ? 0.06 : 0.08, 0.04),
      preferWeatherDominance: true,
      preferCloudDominance: false,
      preferCelestialDominance: false,
      reason: haze ? 'haze keeps cloud weak so haze layer remains primary' : 'mist keeps low stratus weak so fog sprites remain primary'
    };
  }

  if (input.weatherState === 'sandstorm') {
    const dust = input.weatherVariant === 'dust';

    return {
      daylight,
      cloud: cloudProfile({
        enabled: dust,
        mood: 'dustSuppressed',
        primary: 'altostratus',
        coverage: dust ? 0.18 : 0.08,
        opacity: dust ? 0.12 : 0.04,
        density: dust ? 0.14 : 0.06,
        altitude: 'mid',
        drift: dust ? 0.32 : 0.5,
        morph: 0.08,
        suppressByWeather: true
      }),
      celestial: suppressedCelestial(daylight, dust ? 0.08 : 0.03, dust ? 0.04 : 0.02),
      preferWeatherDominance: true,
      preferCloudDominance: false,
      preferCelestialDominance: false,
      reason: dust ? 'dust weakens clouds without hiding them entirely' : 'sandstorm suppresses cloud and night-sky detail'
    };
  }

  return {
    daylight,
    cloud: cloudProfile({
      mood: 'partlyCloudy',
      primary: 'altocumulus',
      secondary: 'cirrocumulus',
      coverage: 0.4,
      opacity: 0.32,
      density: 0.24,
      altitude: 'mid'
    }),
    celestial: OFF_CELESTIAL,
    preferWeatherDominance: false,
    preferCloudDominance: false,
    preferCelestialDominance: false,
    reason: 'fallback sky profile keeps semantic output stable'
  };
}
