import type { SkyProfile } from '../profiles/skyProfiles';
import type { WeatherProfile } from './types';

export type WeatherDominance = 'clearDay' | 'cloud' | 'weather' | 'celestial' | 'aurora';

export interface WeatherOrchestrationProfile {
  dominance: WeatherDominance;
  weatherDominance: number;
  cloudVisibility: number;
  cloudOcclusion: number;
  nightSkyVisibility: number;
  starVisibilityMultiplier: number;
  milkyWayVisibilityMultiplier: number;
  moonVisibilityMultiplier: number;
  meteorVisibilityMultiplier: number;
  sunnyOpticalVisibility: number;
  auroraVisibility: number;
  atmosphereVisibility: number;
  precipitationVisibility: number;
  electricalVisibility: number;
  environmentDarknessMultiplier: number;
  centerProtection: number;
  retainCurrentLayersDuringTransition: boolean;
}

export const ORCHESTRATION_NUMERIC_FIELDS = [
  'weatherDominance',
  'cloudVisibility',
  'cloudOcclusion',
  'nightSkyVisibility',
  'starVisibilityMultiplier',
  'milkyWayVisibilityMultiplier',
  'moonVisibilityMultiplier',
  'meteorVisibilityMultiplier',
  'sunnyOpticalVisibility',
  'auroraVisibility',
  'atmosphereVisibility',
  'precipitationVisibility',
  'electricalVisibility',
  'environmentDarknessMultiplier',
  'centerProtection'
] as const satisfies ReadonlyArray<keyof WeatherOrchestrationProfile>;

type NumericField = (typeof ORCHESTRATION_NUMERIC_FIELDS)[number];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function baseProfile(overrides: Partial<WeatherOrchestrationProfile> & Pick<WeatherOrchestrationProfile, 'dominance'>) {
  const { dominance, ...rest } = overrides;

  return {
    dominance,
    weatherDominance: 0,
    cloudVisibility: 0,
    cloudOcclusion: 0,
    nightSkyVisibility: 0,
    starVisibilityMultiplier: 0,
    milkyWayVisibilityMultiplier: 0,
    moonVisibilityMultiplier: 0,
    meteorVisibilityMultiplier: 0,
    sunnyOpticalVisibility: 0,
    auroraVisibility: 0,
    atmosphereVisibility: 0.12,
    precipitationVisibility: 0,
    electricalVisibility: 0,
    environmentDarknessMultiplier: 0,
    centerProtection: 0.5,
    retainCurrentLayersDuringTransition: true,
    ...rest
  } satisfies WeatherOrchestrationProfile;
}

function cloudVisibilityFromSky(skyProfile: SkyProfile, multiplier = 1) {
  if (!skyProfile.cloud.enabled) {
    return 0;
  }

  return clamp01(skyProfile.cloud.opacity * (0.72 + skyProfile.cloud.coverage * 0.28) * multiplier);
}

function cloudOcclusionFromSky(skyProfile: SkyProfile, multiplier = 1) {
  if (!skyProfile.cloud.enabled) {
    return 0;
  }

  return clamp01((skyProfile.cloud.coverage * 0.62 + skyProfile.cloud.density * 0.28) * multiplier);
}

function celestialVisibility(skyProfile: SkyProfile, multiplier = 1) {
  if (!skyProfile.celestial.enabled) {
    return 0;
  }

  return clamp01(
    Math.max(
      skyProfile.celestial.starVisibility,
      skyProfile.celestial.moonVisibility,
      skyProfile.celestial.horizonGlow
    ) * multiplier
  );
}

function clampProfile(profile: WeatherOrchestrationProfile): WeatherOrchestrationProfile {
  const next = { ...profile };

  ORCHESTRATION_NUMERIC_FIELDS.forEach((field) => {
    next[field] = clamp01(next[field]);
  });

  return next;
}

export function getWeatherOrchestrationProfile(
  weatherProfile: WeatherProfile,
  skyProfile: SkyProfile
): WeatherOrchestrationProfile {
  const daylight = skyProfile.daylight;

  if (weatherProfile.weatherState === 'aurora') {
    return clampProfile(
      baseProfile({
        dominance: 'aurora',
        weatherDominance: 0.24,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, 0.68),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, 0.42),
        nightSkyVisibility: 0.52,
        starVisibilityMultiplier: 0.58,
        milkyWayVisibilityMultiplier: 0.48,
        moonVisibilityMultiplier: 0.54,
        meteorVisibilityMultiplier: 0.72,
        auroraVisibility: 1,
        atmosphereVisibility: 0.26,
        environmentDarknessMultiplier: 0.32,
        centerProtection: 0.68
      })
    );
  }

  if (weatherProfile.weatherState === 'clear') {
    if (daylight === 'night') {
      return clampProfile(
        baseProfile({
          dominance: 'celestial',
          weatherDominance: 0,
          cloudVisibility: cloudVisibilityFromSky(skyProfile, 0.82),
          cloudOcclusion: cloudOcclusionFromSky(skyProfile, 0.46),
          nightSkyVisibility: 1,
          starVisibilityMultiplier: 1,
          milkyWayVisibilityMultiplier: 1,
          moonVisibilityMultiplier: 1,
          meteorVisibilityMultiplier: 1,
          atmosphereVisibility: 0.16,
          environmentDarknessMultiplier: 0.18,
          centerProtection: 0.6
        })
      );
    }

    return clampProfile(
      baseProfile({
        dominance: 'clearDay',
        weatherDominance: 0,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, 0.86),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, 0.32),
        sunnyOpticalVisibility: 1,
        atmosphereVisibility: 0.14,
        environmentDarknessMultiplier: 0,
        centerProtection: 0.42
      })
    );
  }

  if (weatherProfile.weatherState === 'cloudy') {
    const overcast = weatherProfile.weatherVariant === 'overcast';
    const cloudOcclusion = cloudOcclusionFromSky(skyProfile, overcast ? 1.08 : 1.08);
    const nightSkyVisibility = daylight === 'night' ? (overcast ? 0.16 : 0.32) : 0;

    return clampProfile(
      baseProfile({
        dominance: 'cloud',
        weatherDominance: 0.18,
        cloudVisibility: overcast
          ? Math.max(0.96, cloudVisibilityFromSky(skyProfile, 1))
          : Math.max(0.88, cloudVisibilityFromSky(skyProfile, 0.94)),
        cloudOcclusion,
        nightSkyVisibility,
        starVisibilityMultiplier: daylight === 'night' ? Math.max(0.16, (1 - cloudOcclusion) * 0.8) : 0,
        milkyWayVisibilityMultiplier: daylight === 'night' ? 0.16 : 0,
        moonVisibilityMultiplier: daylight === 'night' ? 0.32 : 0,
        meteorVisibilityMultiplier: 0,
        sunnyOpticalVisibility: daylight === 'day' && !overcast ? 0.12 : 0,
        atmosphereVisibility: 0.22,
        environmentDarknessMultiplier: overcast ? 0.24 : 0.14,
        centerProtection: 0.54
      })
    );
  }

  if (weatherProfile.weatherState === 'drizzle') {
    return clampProfile(
      baseProfile({
        dominance: 'cloud',
        weatherDominance: 0.48,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, 0.94),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, 0.9),
        nightSkyVisibility: daylight === 'night' ? 0.12 : 0,
        starVisibilityMultiplier: 0.18,
        milkyWayVisibilityMultiplier: 0,
        moonVisibilityMultiplier: 0.18,
        meteorVisibilityMultiplier: 0,
        atmosphereVisibility: 0.58,
        precipitationVisibility: 0.5,
        environmentDarknessMultiplier: 0.32,
        centerProtection: 0.56
      })
    );
  }

  if (weatherProfile.weatherState === 'rain' || weatherProfile.weatherState === 'heavyRain') {
    const heavy = weatherProfile.weatherState === 'heavyRain';

    return clampProfile(
      baseProfile({
        dominance: 'weather',
        weatherDominance: heavy ? 0.9 : 0.76,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, heavy ? 0.86 : 0.9),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, heavy ? 1.05 : 0.96),
        nightSkyVisibility: daylight === 'night' ? (heavy ? 0.08 : 0.14) : 0,
        starVisibilityMultiplier: heavy ? 0.08 : 0.14,
        milkyWayVisibilityMultiplier: 0,
        moonVisibilityMultiplier: heavy ? 0.08 : 0.14,
        meteorVisibilityMultiplier: 0,
        atmosphereVisibility: heavy ? 0.86 : 0.76,
        precipitationVisibility: heavy ? 1 : 0.78,
        electricalVisibility: heavy ? 0.16 : 0.04,
        environmentDarknessMultiplier: heavy ? 0.62 : 0.46,
        centerProtection: heavy ? 0.68 : 0.62
      })
    );
  }

  if (weatherProfile.weatherState === 'storm') {
    return clampProfile(
      baseProfile({
        dominance: 'weather',
        weatherDominance: 1,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, 0.84),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, 1.08),
        nightSkyVisibility: daylight === 'night' ? 0.06 : 0,
        starVisibilityMultiplier: 0.06,
        milkyWayVisibilityMultiplier: 0,
        moonVisibilityMultiplier: 0.06,
        meteorVisibilityMultiplier: 0,
        atmosphereVisibility: 0.92,
        precipitationVisibility: 1,
        electricalVisibility: 1,
        environmentDarknessMultiplier: 0.82,
        centerProtection: 0.72
      })
    );
  }

  if (
    weatherProfile.weatherState === 'lightSnow' ||
    weatherProfile.weatherState === 'snow' ||
    weatherProfile.weatherState === 'blizzard'
  ) {
    const blizzard = weatherProfile.weatherState === 'blizzard';
    const light = weatherProfile.weatherState === 'lightSnow';

    return clampProfile(
      baseProfile({
        dominance: blizzard ? 'weather' : 'cloud',
        weatherDominance: blizzard ? 0.86 : light ? 0.42 : 0.62,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, blizzard ? 0.76 : 0.9),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, blizzard ? 1 : 0.88),
        nightSkyVisibility: daylight === 'night' ? (light ? 0.18 : blizzard ? 0.04 : 0.1) : 0,
        starVisibilityMultiplier: light ? 0.2 : 0.08,
        milkyWayVisibilityMultiplier: 0,
        moonVisibilityMultiplier: light ? 0.18 : 0.1,
        meteorVisibilityMultiplier: 0,
        atmosphereVisibility: blizzard ? 0.9 : light ? 0.52 : 0.72,
        precipitationVisibility: blizzard ? 1 : light ? 0.42 : 0.74,
        environmentDarknessMultiplier: blizzard ? 0.58 : 0.34,
        centerProtection: blizzard ? 0.72 : 0.62
      })
    );
  }

  if (weatherProfile.weatherState === 'fog') {
    const haze = weatherProfile.weatherVariant === 'haze';

    return clampProfile(
      baseProfile({
        dominance: 'weather',
        weatherDominance: haze ? 0.78 : 0.72,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, haze ? 0.68 : 0.58),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, 0.62),
        nightSkyVisibility: daylight === 'night' ? (haze ? 0.1 : 0.14) : 0,
        starVisibilityMultiplier: haze ? 0.08 : 0.12,
        milkyWayVisibilityMultiplier: 0,
        moonVisibilityMultiplier: 0.08,
        meteorVisibilityMultiplier: 0,
        atmosphereVisibility: haze ? 0.94 : 0.9,
        environmentDarknessMultiplier: haze ? 0.34 : 0.28,
        centerProtection: 0.78
      })
    );
  }

  if (weatherProfile.weatherState === 'sandstorm') {
    const dust = weatherProfile.weatherVariant === 'dust';

    return clampProfile(
      baseProfile({
        dominance: 'weather',
        weatherDominance: dust ? 0.74 : 0.94,
        cloudVisibility: cloudVisibilityFromSky(skyProfile, dust ? 0.58 : 0.12),
        cloudOcclusion: cloudOcclusionFromSky(skyProfile, dust ? 0.48 : 0.24),
        nightSkyVisibility: daylight === 'night' ? (dust ? 0.08 : 0.04) : 0,
        starVisibilityMultiplier: dust ? 0.08 : 0.03,
        milkyWayVisibilityMultiplier: 0,
        moonVisibilityMultiplier: dust ? 0.06 : 0.03,
        meteorVisibilityMultiplier: 0,
        atmosphereVisibility: dust ? 0.88 : 1,
        electricalVisibility: dust ? 0.12 : 0.18,
        environmentDarknessMultiplier: dust ? 0.42 : 0.66,
        centerProtection: dust ? 0.7 : 0.78
      })
    );
  }

  return clampProfile(
    baseProfile({
      dominance: 'cloud',
      cloudVisibility: cloudVisibilityFromSky(skyProfile, 0.8),
      cloudOcclusion: cloudOcclusionFromSky(skyProfile, 0.7),
      atmosphereVisibility: 0.24,
      centerProtection: 0.54
    })
  );
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

export function blendWeatherOrchestration(
  current: WeatherOrchestrationProfile,
  target: WeatherOrchestrationProfile,
  progress: number
): WeatherOrchestrationProfile {
  const t = clamp01(progress);
  const blended = {
    dominance: t < 0.5 ? current.dominance : target.dominance,
    retainCurrentLayersDuringTransition:
      current.retainCurrentLayersDuringTransition || target.retainCurrentLayersDuringTransition
  } as WeatherOrchestrationProfile;

  ORCHESTRATION_NUMERIC_FIELDS.forEach((field: NumericField) => {
    blended[field] = clamp01(lerp(current[field], target[field], t));
  });

  return blended;
}
