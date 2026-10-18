import type { DaylightHint, PrecipitationKind, WeatherState, WeatherVariant } from '../model';
import type { WeatherProfile, WeatherRenderMode, WeatherRenderModeInput } from '../core/types';

type WeatherProfileInput = {
  weatherState: string | undefined;
  weatherVariant: string | undefined;
  precipitationKind?: PrecipitationKind;
  daylightHint?: DaylightHint;
  meteorShower?: boolean;
};

export const weatherProfiles: Record<WeatherState, WeatherProfile> = {
  clear: {
    weatherState: 'clear',
    weatherVariant: 'clear',
    label: '温柔晨光',
    renderer: 'three-clear',
    ambientWarmth: 1,
    particleIntensity: 1,
    windMultiplier: 0.34
  },
  cloudy: {
    weatherState: 'cloudy',
    weatherVariant: 'partlyCloudy',
    label: '多云',
    renderer: 'three-cloudy',
    ambientWarmth: 0.32,
    particleIntensity: 0.45,
    windMultiplier: 0.7
  },
  drizzle: {
    weatherState: 'drizzle',
    weatherVariant: 'lightRain',
    label: '轻柔细雨',
    renderer: 'three-rain',
    ambientWarmth: 0.24,
    particleIntensity: 0.38,
    windMultiplier: 0.8
  },
  rain: {
    weatherState: 'rain',
    weatherVariant: 'moderateRain',
    label: '稳定细雨',
    renderer: 'three-rain',
    ambientWarmth: 0.22,
    particleIntensity: 0.7,
    windMultiplier: 1.1
  },
  heavyRain: {
    weatherState: 'heavyRain',
    weatherVariant: 'heavyRain',
    label: '强降雨',
    renderer: 'three-rain',
    ambientWarmth: 0.16,
    particleIntensity: 1,
    windMultiplier: 1.5
  },
  storm: {
    weatherState: 'storm',
    weatherVariant: 'thunderstorm',
    label: '远雷',
    renderer: 'three-storm',
    ambientWarmth: 0.1,
    particleIntensity: 1,
    windMultiplier: 2.5
  },
  lightSnow: {
    weatherState: 'lightSnow',
    weatherVariant: 'lightSnow',
    label: '轻雪',
    renderer: 'three-snow',
    ambientWarmth: 0.2,
    particleIntensity: 0.3,
    windMultiplier: 0.6
  },
  snow: {
    weatherState: 'snow',
    weatherVariant: 'snow',
    label: '飘雪',
    renderer: 'three-snow',
    ambientWarmth: 0.18,
    particleIntensity: 0.7,
    windMultiplier: 1
  },
  blizzard: {
    weatherState: 'blizzard',
    weatherVariant: 'heavySnow',
    label: '大雪',
    renderer: 'three-snow',
    ambientWarmth: 0.12,
    particleIntensity: 1,
    windMultiplier: 3
  },
  fog: {
    weatherState: 'fog',
    weatherVariant: 'mist',
    label: '薄雾',
    renderer: 'three-fog',
    ambientWarmth: 0.18,
    particleIntensity: 0.7,
    windMultiplier: 0.2
  },
  sandstorm: {
    weatherState: 'sandstorm',
    weatherVariant: 'sandstorm',
    label: '沙尘',
    renderer: 'three-sandstorm',
    ambientWarmth: 0.18,
    particleIntensity: 1,
    windMultiplier: 3
  },
  aurora: {
    weatherState: 'aurora',
    weatherVariant: 'aurora',
    label: '极光夜',
    renderer: 'three-aurora',
    ambientWarmth: 0.08,
    particleIntensity: 0.64,
    windMultiplier: 0.3
  }
};

export function normalizeWeatherState(state: string | undefined): WeatherState {
  return state && state in weatherProfiles ? (state as WeatherState) : 'cloudy';
}

function normalizeWeatherVariant(variant: string | undefined, fallback: WeatherVariant): WeatherVariant {
  const variants: Record<WeatherVariant, true> = {
    clear: true,
    partlyCloudy: true,
    overcast: true,
    lightRain: true,
    moderateRain: true,
    heavyRain: true,
    thunderstorm: true,
    hailStorm: true,
    lightSnow: true,
    snow: true,
    heavySnow: true,
    mist: true,
    haze: true,
    dust: true,
    sandstorm: true,
    windy: true,
    hot: true,
    cold: true,
    hail: true,
    aurora: true,
    unknown: true
  };

  return variant && variant in variants ? (variant as WeatherVariant) : fallback;
}

function normalizeDaylightHint(daylightHint: DaylightHint | undefined): DaylightHint {
  return daylightHint === 'day' || daylightHint === 'night' || daylightHint === 'unknown' ? daylightHint : 'unknown';
}

export function getWeatherRenderMode({
  weatherState,
  isLargeViewport,
  prefersReducedMotion
}: WeatherRenderModeInput): WeatherRenderMode {
  if (!isLargeViewport) {
    return 'none';
  }

  const renderer = weatherProfiles[weatherState].renderer;
  if (
    (renderer === 'three-clear' ||
      renderer === 'three-cloudy' ||
      renderer === 'three-rain' ||
      renderer === 'three-storm' ||
      renderer === 'three-snow' ||
      renderer === 'three-fog' ||
      renderer === 'three-sandstorm' ||
      renderer === 'three-aurora') &&
    prefersReducedMotion
  ) {
    return 'none';
  }

  return renderer;
}

function resolvePrecipitationKind(variant: WeatherVariant, precipitationKind: PrecipitationKind | undefined) {
  return precipitationKind === 'hail' || variant === 'hail' || variant === 'hailStorm' ? 'hail' : precipitationKind;
}

export function getWeatherProfile({
  weatherState,
  weatherVariant,
  precipitationKind,
  daylightHint: inputDaylightHint,
  meteorShower
}: WeatherProfileInput): WeatherProfile {
  const state = normalizeWeatherState(weatherState);
  const base = weatherProfiles[state];
  const variant = normalizeWeatherVariant(weatherVariant, base.weatherVariant);
  const resolvedPrecipitationKind = resolvePrecipitationKind(variant, precipitationKind);
  const daylightHint = normalizeDaylightHint(inputDaylightHint);
  const resolvedMeteorShower = Boolean(meteorShower && daylightHint === 'night' && (state === 'clear' || state === 'aurora'));

  if (state === 'cloudy' && variant === 'overcast') {
    return {
      ...base,
      weatherVariant: variant,
      precipitationKind: resolvedPrecipitationKind,
      daylightHint,
      meteorShower: resolvedMeteorShower,
      label: '阴云',
      ambientWarmth: 0.22,
      particleIntensity: 0.78,
      windMultiplier: 0.84
    };
  }

  if (state === 'cloudy') {
    return {
      ...base,
      weatherVariant: variant,
      precipitationKind: resolvedPrecipitationKind,
      daylightHint,
      meteorShower: resolvedMeteorShower
    };
  }

  if (state === 'fog' && variant === 'haze') {
    return {
      ...base,
      weatherVariant: variant,
      precipitationKind: resolvedPrecipitationKind,
      daylightHint,
      meteorShower: resolvedMeteorShower,
      label: '薄霾',
      ambientWarmth: 0.24,
      particleIntensity: 0.5,
      windMultiplier: 0.12
    };
  }

  if (state === 'sandstorm' && variant === 'dust') {
    return {
      ...base,
      weatherVariant: variant,
      precipitationKind: resolvedPrecipitationKind,
      daylightHint,
      meteorShower: resolvedMeteorShower,
      label: '浮尘',
      ambientWarmth: 0.26,
      particleIntensity: 0.45,
      windMultiplier: 1.6
    };
  }

  if (variant === 'windy') {
    return {
      ...base,
      weatherVariant: variant,
      precipitationKind: resolvedPrecipitationKind,
      daylightHint,
      meteorShower: resolvedMeteorShower,
      windMultiplier: Math.max(base.windMultiplier, 1.2)
    };
  }

  if (variant === 'hot') {
    return {
      ...weatherProfiles.clear,
      weatherVariant: variant,
      precipitationKind: resolvedPrecipitationKind,
      daylightHint,
      meteorShower: resolvedMeteorShower,
      label: '炎热晴光',
      ambientWarmth: 1.08
    };
  }

  if (variant === 'cold') {
    return {
      ...base,
      weatherVariant: variant,
      precipitationKind: resolvedPrecipitationKind,
      daylightHint,
      meteorShower: resolvedMeteorShower,
      ambientWarmth: Math.min(base.ambientWarmth, 0.18)
    };
  }

  return {
    ...base,
    weatherVariant: variant,
    precipitationKind: resolvedPrecipitationKind,
    daylightHint,
    meteorShower: resolvedMeteorShower
  };
}
