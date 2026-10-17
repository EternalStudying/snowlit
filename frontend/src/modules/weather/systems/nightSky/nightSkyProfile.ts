import type { SkyProfile } from '../../profiles/skyProfiles';
import type { WeatherProfile } from '../../core/types';
import { WEATHER_METEOR_BUDGET, WEATHER_NIGHT_SKY_BUDGET } from '../../core/weatherPerformanceBudget';

export type NightSkyRenderMode = 'off' | 'twilight' | 'night' | 'aurora';

export interface NightSkyRenderProfile {
  enabled: boolean;
  mode: NightSkyRenderMode;
  starOpacity: number;
  starCount: number;
  twinkleStrength: number;
  milkyWayOpacity: number;
  moonOpacity: number;
  moonPhase: number;
  moonPosition: [number, number];
  horizonGlow: number;
  skyOpacity: number;
  centerProtection: number;
  zenithColor: number;
  midColor: number;
  horizonColor: number;
  moonColor: number;
  meteorRate: number;
  meteorMaxActive: number;
  meteorOpacity: number;
  meteorTint: number;
  meteorShower: boolean;
  auroraBlend: number;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function offProfile(): NightSkyRenderProfile {
  return {
    enabled: false,
    mode: 'off',
    starOpacity: 0,
    starCount: 0,
    twinkleStrength: 0,
    milkyWayOpacity: 0,
    moonOpacity: 0,
    moonPhase: 0.52,
    moonPosition: [0.32, 0.31],
    horizonGlow: 0,
    skyOpacity: 0,
    centerProtection: 0.68,
    zenithColor: 0x06112f,
    midColor: 0x0b1c45,
    horizonColor: 0x1c2d55,
    moonColor: 0xf5f0df,
    meteorRate: 0,
    meteorMaxActive: 0,
    meteorOpacity: 0,
    meteorTint: 0xf5fbff,
    meteorShower: false,
    auroraBlend: 0
  };
}

function resolveMode(skyProfile: SkyProfile): NightSkyRenderMode {
  if (skyProfile.celestial.mode === 'aurora') {
    return 'aurora';
  }

  if (skyProfile.celestial.mode === 'twilight') {
    return 'twilight';
  }

  return skyProfile.daylight === 'night' ? 'night' : 'off';
}

function resolveStarCount(skyProfile: SkyProfile, mode: NightSkyRenderMode) {
  const modeMultiplier = mode === 'aurora' ? 0.78 : mode === 'twilight' ? 0.42 : 1.08;
  const count = Math.round(WEATHER_NIGHT_SKY_BUDGET.maxStars * skyProfile.celestial.starVisibility * modeMultiplier);

  return Math.min(WEATHER_NIGHT_SKY_BUDGET.maxStars, Math.max(0, count));
}

function resolveMoonPhase(profile: WeatherProfile, mode: NightSkyRenderMode) {
  if (mode === 'aurora') {
    return 0.36;
  }

  if (profile.weatherState === 'cloudy') {
    return 0.62;
  }

  return 0.54;
}

function resolvePalette(profile: WeatherProfile, mode: NightSkyRenderMode) {
  if (mode === 'aurora') {
    return {
      zenithColor: 0x051333,
      midColor: 0x0a2447,
      horizonColor: 0x15345b,
      moonColor: 0xdce8ff
    };
  }

  if (profile.weatherState === 'storm' || profile.weatherState === 'rain' || profile.weatherState === 'heavyRain') {
    return {
      zenithColor: 0x030817,
      midColor: 0x071226,
      horizonColor: 0x142035,
      moonColor: 0xbac8dd
    };
  }

  if (profile.weatherState === 'fog' || profile.weatherState === 'sandstorm') {
    return {
      zenithColor: 0x071226,
      midColor: 0x10223a,
      horizonColor: 0x26334a,
      moonColor: 0xcfd8e5
    };
  }

  if (profile.weatherState === 'snow' || profile.weatherState === 'blizzard' || profile.weatherState === 'lightSnow') {
    return {
      zenithColor: 0x06122b,
      midColor: 0x10254a,
      horizonColor: 0x22395f,
      moonColor: 0xe6f0ff
    };
  }

  return {
    zenithColor: 0x050d28,
    midColor: 0x0b1f48,
    horizonColor: 0x26365e,
    moonColor: 0xf5f0df
  };
}

function isMeteorEligible(profile: WeatherProfile, mode: NightSkyRenderMode) {
  return mode === 'aurora' || (mode === 'night' && profile.weatherState === 'clear');
}

function resolveMeteorProfile(profile: WeatherProfile, skyProfile: SkyProfile, mode: NightSkyRenderMode) {
  if (!isMeteorEligible(profile, mode) || skyProfile.celestial.meteorRate <= 0) {
    return {
      meteorRate: 0,
      meteorMaxActive: 0,
      meteorOpacity: 0,
      meteorTint: 0xf5fbff,
      meteorShower: false
    };
  }

  if (profile.meteorShower) {
    return {
      meteorRate: mode === 'aurora' ? 0.34 : 0.48,
      meteorMaxActive: WEATHER_METEOR_BUDGET.maxActiveMeteors,
      meteorOpacity: mode === 'aurora' ? 0.54 : 0.62,
      meteorTint: mode === 'aurora' ? 0xd8fff3 : 0xf5fbff,
      meteorShower: true
    };
  }

  return {
    meteorRate: clamp(skyProfile.celestial.meteorRate, 0, mode === 'aurora' ? 0.05 : 0.06),
    meteorMaxActive: 2,
    meteorOpacity: mode === 'aurora' ? 0.38 : 0.46,
    meteorTint: mode === 'aurora' ? 0xd8fff3 : 0xf5fbff,
    meteorShower: false
  };
}

export function getNightSkyRenderProfile(profile: WeatherProfile, skyProfile: SkyProfile): NightSkyRenderProfile {
  const mode = resolveMode(skyProfile);

  if (!skyProfile.celestial.enabled || mode === 'off') {
    return offProfile();
  }

  const palette = resolvePalette(profile, mode);
  const starCount = resolveStarCount(skyProfile, mode);
  const milkyWayOpacity =
    skyProfile.celestial.milkyWayVisibility < 0.025
      ? 0
      : clamp(skyProfile.celestial.milkyWayVisibility * (mode === 'aurora' ? 0.52 : 0.76), 0, 0.16);
  const moonOpacity = clamp(skyProfile.celestial.moonVisibility * (mode === 'aurora' ? 0.72 : 1), 0, 0.5);
  const meteorProfile = resolveMeteorProfile(profile, skyProfile, mode);
  const auroraBlend = skyProfile.celestial.auroraIntegration ? 1 : 0;

  return {
    enabled: starCount > 0 || moonOpacity > 0 || skyProfile.celestial.horizonGlow > 0 || meteorProfile.meteorRate > 0,
    mode,
    starOpacity: clamp(skyProfile.celestial.starVisibility * (mode === 'aurora' ? 0.68 : 0.86), 0, 0.78),
    starCount,
    twinkleStrength: mode === 'aurora' ? 0.38 : profile.weatherState === 'cloudy' ? 0.28 : 0.5,
    milkyWayOpacity,
    moonOpacity: mode === 'aurora' ? clamp(moonOpacity * 0.78, 0, 0.42) : moonOpacity,
    moonPhase: resolveMoonPhase(profile, mode),
    moonPosition: mode === 'aurora' ? [0.29, 0.28] : [0.32, 0.31],
    horizonGlow: clamp(skyProfile.celestial.horizonGlow, 0, 0.34),
    skyOpacity: clamp(0.1 + skyProfile.celestial.horizonGlow * 0.55 + skyProfile.celestial.starVisibility * 0.08, 0, 0.34),
    centerProtection: skyProfile.preferWeatherDominance ? 0.74 : 0.62,
    ...meteorProfile,
    auroraBlend,
    ...palette
  };
}
