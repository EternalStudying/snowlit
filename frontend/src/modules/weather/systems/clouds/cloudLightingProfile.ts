import type { WeatherProfile } from '../../core/types';
import type { SkyProfile } from '../../profiles/skyProfiles';

export interface CloudLightingProfile {
  sunDirection: [number, number, number];
  sunScreenPosition: [number, number];
  sunColor: [number, number, number];
  ambientSkyColor: [number, number, number];
  shadowColor: [number, number, number];
  cloudTint: [number, number, number];
  silverLining: number;
  forwardScatter: number;
  baseDarkening: number;
  internalLightSensitivity: number;
  daylightBlend: number;
  contrast: number;
}

const DAY_SUN: Pick<
  CloudLightingProfile,
  'sunDirection' | 'sunScreenPosition' | 'sunColor' | 'ambientSkyColor' | 'shadowColor' | 'cloudTint'
> = {
  sunDirection: [0.42, 0.72, 0.34],
  sunScreenPosition: [0.16, 0.18],
  sunColor: [1, 0.92, 0.72],
  ambientSkyColor: [0.68, 0.78, 0.9],
  shadowColor: [0.5, 0.58, 0.68],
  cloudTint: [1, 0.98, 0.93]
};

const NIGHT_SUN: Pick<
  CloudLightingProfile,
  'sunDirection' | 'sunScreenPosition' | 'sunColor' | 'ambientSkyColor' | 'shadowColor' | 'cloudTint'
> = {
  sunDirection: [-0.22, 0.34, 0.56],
  sunScreenPosition: [0.8, 0.18],
  sunColor: [0.22, 0.28, 0.46],
  ambientSkyColor: [0.09, 0.12, 0.22],
  shadowColor: [0.05, 0.07, 0.14],
  cloudTint: [0.18, 0.22, 0.36]
};

const UNKNOWN_SUN: Pick<
  CloudLightingProfile,
  'sunDirection' | 'sunScreenPosition' | 'sunColor' | 'ambientSkyColor' | 'shadowColor' | 'cloudTint'
> = {
  sunDirection: [0.34, 0.58, 0.48],
  sunScreenPosition: [0.22, 0.2],
  sunColor: [1, 0.74, 0.46],
  ambientSkyColor: [0.45, 0.52, 0.72],
  shadowColor: [0.24, 0.27, 0.42],
  cloudTint: [0.95, 0.76, 0.58]
};

function baseLighting(skyProfile: SkyProfile): CloudLightingProfile {
  const daylight =
    skyProfile.daylight === 'day' ? DAY_SUN : skyProfile.daylight === 'night' ? NIGHT_SUN : UNKNOWN_SUN;

  return {
    ...daylight,
    silverLining: skyProfile.cloud.silverLiningEligible ? 0.32 : 0.06,
    forwardScatter: skyProfile.cloud.silverLiningEligible ? 0.3 : 0.08,
    baseDarkening: 0.2,
    internalLightSensitivity: skyProfile.cloud.internalLightningEligible ? 0.8 : 0,
    daylightBlend: skyProfile.daylight === 'day' ? 1 : skyProfile.daylight === 'unknown' ? 0.48 : 0.06,
    contrast: 0.82
  };
}

export function getCloudLightingProfile(profile: WeatherProfile, skyProfile: SkyProfile): CloudLightingProfile {
  const lighting = baseLighting(skyProfile);

  if (profile.weatherState === 'clear') {
    return {
      ...lighting,
      silverLining: skyProfile.daylight === 'night' ? 0.04 : 0.42,
      forwardScatter: skyProfile.daylight === 'night' ? 0.06 : 0.38,
      baseDarkening: skyProfile.daylight === 'night' ? 0.08 : 0.12,
      contrast: skyProfile.daylight === 'night' ? 0.3 : 0.95
    };
  }

  if (profile.weatherState === 'cloudy') {
    if (profile.weatherVariant === 'overcast') {
      return {
        ...lighting,
        sunColor: [0.76, 0.78, 0.82],
        ambientSkyColor: [0.56, 0.6, 0.66],
        shadowColor: [0.34, 0.38, 0.44],
        cloudTint: [0.78, 0.8, 0.82],
        silverLining: 0.08,
        forwardScatter: 0.08,
        baseDarkening: 0.42,
        contrast: 0.62
      };
    }

    return {
      ...lighting,
      silverLining: skyProfile.daylight === 'night' ? 0.04 : 0.36,
      forwardScatter: skyProfile.daylight === 'night' ? 0.06 : 0.32,
      baseDarkening: skyProfile.daylight === 'night' ? 0.12 : 0.2,
      contrast: skyProfile.daylight === 'night' ? 0.34 : 0.9
    };
  }

  if (profile.weatherState === 'rain' || profile.weatherState === 'heavyRain' || profile.weatherState === 'drizzle') {
    const heavy = profile.weatherState === 'heavyRain';

    return {
      ...lighting,
      sunColor: [0.55, 0.62, 0.72],
      ambientSkyColor: [0.34, 0.42, 0.52],
      shadowColor: heavy ? [0.18, 0.22, 0.3] : [0.26, 0.32, 0.4],
      cloudTint: [0.62, 0.7, 0.78],
      silverLining: heavy ? 0.02 : 0.04,
      forwardScatter: heavy ? 0.06 : 0.12,
      baseDarkening: heavy ? 0.58 : 0.46,
      contrast: heavy ? 0.42 : 0.5
    };
  }

  if (profile.weatherState === 'storm') {
    return {
      ...lighting,
      sunColor: [0.46, 0.55, 0.78],
      ambientSkyColor: [0.16, 0.19, 0.28],
      shadowColor: [0.06, 0.08, 0.14],
      cloudTint: [0.5, 0.56, 0.66],
      silverLining: 0.04,
      forwardScatter: 0.06,
      baseDarkening: 0.74,
      internalLightSensitivity: 0.92,
      contrast: 0.58
    };
  }

  if (profile.weatherState === 'lightSnow' || profile.weatherState === 'snow' || profile.weatherState === 'blizzard') {
    const blizzard = profile.weatherState === 'blizzard';

    return {
      ...lighting,
      sunColor: [0.76, 0.82, 1],
      ambientSkyColor: [0.58, 0.66, 0.82],
      shadowColor: blizzard ? [0.38, 0.48, 0.68] : [0.46, 0.56, 0.76],
      cloudTint: [0.84, 0.9, 1],
      silverLining: profile.weatherState === 'lightSnow' ? 0.12 : 0.06,
      forwardScatter: 0.12,
      baseDarkening: blizzard ? 0.34 : 0.22,
      contrast: blizzard ? 0.42 : 0.56
    };
  }

  if (profile.weatherState === 'fog') {
    return {
      ...lighting,
      sunColor: [0.74, 0.76, 0.76],
      ambientSkyColor: [0.62, 0.66, 0.68],
      shadowColor: [0.46, 0.5, 0.54],
      cloudTint: [0.74, 0.78, 0.8],
      silverLining: 0.02,
      forwardScatter: 0.04,
      baseDarkening: 0.16,
      contrast: 0.42
    };
  }

  if (profile.weatherState === 'sandstorm') {
    return {
      ...lighting,
      sunColor: [0.9, 0.62, 0.32],
      ambientSkyColor: [0.62, 0.46, 0.26],
      shadowColor: [0.34, 0.26, 0.16],
      cloudTint: profile.weatherVariant === 'dust' ? [0.86, 0.68, 0.42] : [0.68, 0.45, 0.24],
      silverLining: 0.03,
      forwardScatter: 0.08,
      baseDarkening: profile.weatherVariant === 'dust' ? 0.28 : 0.42,
      internalLightSensitivity: profile.weatherVariant === 'dust' ? 0.12 : 0.22,
      contrast: profile.weatherVariant === 'dust' ? 0.44 : 0.34
    };
  }

  if (profile.weatherState === 'aurora') {
    return {
      ...lighting,
      sunColor: [0.1, 0.2, 0.24],
      ambientSkyColor: [0.04, 0.12, 0.18],
      shadowColor: [0.02, 0.05, 0.1],
      cloudTint: [0.12, 0.22, 0.36],
      silverLining: 0.02,
      forwardScatter: 0.04,
      baseDarkening: 0.08,
      internalLightSensitivity: 0,
      daylightBlend: 0.04,
      contrast: 0.24
    };
  }

  return lighting;
}
