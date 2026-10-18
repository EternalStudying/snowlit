import { ref } from 'vue';
import { getAuthToken, onSessionChange, sessionEpoch } from '../../../auth';
import { createLatestRequest } from '../../../requestGuards';
import type {
  WeatherAtmosphereData,
  WeatherCoordinates,
  WeatherState,
  WeatherVariant
} from '../model';
import { createHttpWeatherGateway } from './httpWeatherGateway';

type WeatherDataSource = 'api' | 'fallback';

export interface TopbarWeatherSummary {
  primary: string;
  secondary: string;
  label: string;
  title: string;
}

const weather = ref<WeatherAtmosphereData | null>(null);
const loading = ref(false);
const error = ref<Error | null>(null);
const lastCoordinates = ref<WeatherCoordinates | null>(null);
const weatherGateway = createHttpWeatherGateway();
let loadingPromise: Promise<WeatherAtmosphereData> | null = null;
let weatherDataSource: WeatherDataSource | null = null;
let permissionDenied = false;
let lastUpdatedAt = 0;
const latestWeather = createLatestRequest();
export const WEATHER_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

// Weather and coordinates belong to the signed-in member's session.
onSessionChange(() => {
  latestWeather.cancel();
  weather.value = null;
  lastCoordinates.value = null;
  loadingPromise = null;
  loading.value = false;
  lastUpdatedAt = 0;
  weatherDataSource = null;
});

const weatherStateLabels: Record<WeatherState, string> = {
  clear: '晴',
  cloudy: '多云',
  drizzle: '毛毛雨',
  rain: '雨',
  heavyRain: '大雨',
  storm: '雷雨',
  lightSnow: '小雪',
  snow: '雪',
  blizzard: '暴雪',
  fog: '雾',
  sandstorm: '沙尘',
  aurora: '极光'
};

const weatherVariantLabels: Record<WeatherVariant, string> = {
  clear: '晴',
  partlyCloudy: '多云',
  overcast: '阴',
  lightRain: '小雨',
  moderateRain: '中雨',
  heavyRain: '大雨',
  thunderstorm: '雷雨',
  hailStorm: '雷暴冰雹',
  lightSnow: '小雪',
  snow: '雪',
  heavySnow: '大雪',
  mist: '薄雾',
  haze: '霾',
  dust: '浮尘',
  sandstorm: '沙尘',
  windy: '有风',
  hot: '炎热',
  cold: '寒冷',
  hail: '冰雹',
  aurora: '极光',
  unknown: ''
};

export function useWeatherAtmosphereData() {
  return {
    weather,
    loading,
    error,
    lastCoordinates,
    loadWeather
  };
}

export async function loadWeather(options: { force?: boolean; requestLocation?: boolean } = {}): Promise<WeatherAtmosphereData> {
  const token = getAuthToken();
  // Passive rendering never triggers a browser permission dialog.
  if (!options.requestLocation || !token || (permissionDenied && !options.force)) {
    return weather.value ?? setFallbackWeather();
  }
  if (weather.value && weatherDataSource === 'api' && !options.force && Date.now() - lastUpdatedAt < WEATHER_REFRESH_INTERVAL_MS) {
    return weather.value;
  }
  if (loadingPromise) return loadingPromise;
  loading.value = true;
  const pending = loadWeatherOnce(latestWeather.begin()).finally(() => {
    if (loadingPromise === pending) {
      loading.value = false;
      loadingPromise = null;
    }
  });
  loadingPromise = pending;
  return pending;
}

async function loadWeatherOnce(isCurrent: () => boolean): Promise<WeatherAtmosphereData> {
  const coords = await getBrowserCoordinates();
  if (!isCurrent()) return createLocalFallbackWeather();
  if (!coords) {
    error.value = new Error(permissionDenied ? '定位权限未开启，可在浏览器设置中允许后重试' : '暂时无法获取位置，稍后将自动重试');
    return weather.value ?? setFallbackWeather();
  }
  try {
    const result = await weatherGateway.fetchAtmosphere(coords);
    if (!isCurrent()) return createLocalFallbackWeather();
    lastCoordinates.value = coords;
    weather.value = result;
    weatherDataSource = 'api';
    lastUpdatedAt = Date.now();
    error.value = null;
  } catch (requestError) {
    if (!isCurrent()) return createLocalFallbackWeather();
    error.value = requestError instanceof Error ? requestError : new Error('天气氛围加载失败');
  }
  return weather.value ?? setFallbackWeather();
}

function setFallbackWeather(): WeatherAtmosphereData {
  const fallbackWeather = createLocalFallbackWeather();
  weather.value = fallbackWeather;
  weatherDataSource = 'fallback';
  return fallbackWeather;
}

// The owner stops this scheduler on unmount. Hidden pages never request location.
export function startWeatherUpdates(onUpdated: (data: WeatherAtmosphereData) => void | Promise<void>): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastAttempt = 0;
  const update = async () => {
    if (stopped || document.visibilityState === 'hidden' || permissionDenied) return;
    if (!getAuthToken()) return;
    const session = sessionEpoch();
    if (weatherDataSource === 'api' && lastUpdatedAt && Date.now() - lastUpdatedAt < WEATHER_REFRESH_INTERVAL_MS) {
      lastAttempt = lastUpdatedAt;
      return;
    }
    lastAttempt = Date.now();
    const data = await loadWeather({ requestLocation: true, force: true });
    if (!stopped && session === sessionEpoch()) await onUpdated(data);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (stopped || document.visibilityState === 'hidden' || permissionDenied) return;
    timer = setTimeout(() => { void tick(); }, Math.max(0, WEATHER_REFRESH_INTERVAL_MS - (Date.now() - lastAttempt)));
  };
  const tick = async () => {
    try { await update(); } finally { schedule(); }
  };
  const handleVisibility = () => {
    if (timer) clearTimeout(timer);
    if (document.visibilityState === 'hidden') return;
    if (!lastAttempt || Date.now() - lastAttempt >= WEATHER_REFRESH_INTERVAL_MS) void tick();
    else schedule();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

function getBrowserCoordinates(): Promise<WeatherCoordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        permissionDenied = false;
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (failure) => {
        permissionDenied = failure.code === 1;
        resolve(null);
      },
      { timeout: 6000 }
    );
  });
}

export function createLocalFallbackWeather(): WeatherAtmosphereData {
  return {
    city: 'unknown',
    district: '',
    province: '',
    country: 'unknown',
    temperature: null,
    rawWeather: '',
    weatherState: 'cloudy',
    weatherVariant: 'unknown',
    precipitationKind: 'none',
    windDirection: '',
    windPower: '',
    humidity: '',
    daylightHint: 'unknown',
    observedAt: new Date().toISOString()
  };
}

export function formatTopbarWeatherSummary(data: WeatherAtmosphereData | null | undefined): TopbarWeatherSummary | null {
  if (!data) {
    return null;
  }

  const location = [data.district, data.city, data.province, data.country].find((value) => value && value.toLowerCase() !== 'unknown') || '位置待更新';
  const weatherLabel = resolveWeatherLabel(data);
  const temperature = formatTemperature(data.temperature);
  const wind = formatWind(data.windDirection, data.windPower);
  const humidity = formatHumidity(data.humidity);
  const observedAt = data.observedAt;
  const weatherAndTemperature = [weatherLabel, temperature].filter(Boolean).join(' ');
  const primary = [location, weatherAndTemperature].filter(Boolean).join(' · ');
  const secondary = [wind, humidity].filter(Boolean).join(' · ');
  const label = [primary, secondary, observedAt ? `更新时间 ${observedAt}` : ''].filter(Boolean).join('；');

  return {
    primary,
    secondary,
    label,
    title: label
  };
}

function resolveWeatherLabel(data: WeatherAtmosphereData) {
  if (data.weatherVariant === 'unknown' && !data.rawWeather) return '天气待更新';
  return (
    data.rawWeather ||
    weatherVariantLabels[data.weatherVariant] ||
    weatherStateLabels[data.weatherState] ||
    '天气'
  );
}

function formatTemperature(temperature: number | null) {
  if (temperature === null) {
    return '';
  }

  return `${Math.round(temperature)}°C`;
}

function formatWind(direction: string, power: string) {
  return [direction, formatWindPower(power)].filter(Boolean).join(' ');
}

function formatWindPower(text: string) {
  if (!text) {
    return '';
  }

  if (text.includes('级')) {
    return text;
  }

  return `${text}级`;
}

function formatHumidity(text: string) {
  if (!text) {
    return '';
  }

  if (text.startsWith('湿度')) {
    return text;
  }

  return `湿度 ${text.endsWith('%') ? text : `${text}%`}`;
}

