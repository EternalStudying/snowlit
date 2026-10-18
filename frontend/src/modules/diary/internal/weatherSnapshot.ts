import type { WeatherAtmosphereData } from '../../weather';
import type {
  DiaryEditorValue,
  DiaryWeatherContext,
  DiaryWeatherSnapshot
} from '../model';

const weatherStateLabels: Record<string, string> = {
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

const weatherVariantLabels: Record<string, string> = {
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

export type DiaryAtmosphereContext =
  DiaryWeatherContext<WeatherAtmosphereData>;

export function getDiaryWeatherEditorDefaults(
  context: DiaryAtmosphereContext
): Pick<DiaryEditorValue, 'location' | 'weather'> {
  return {
    location: resolveDiaryWeatherLocation(context.weather),
    weather: resolveDiaryWeatherLabel(context.weather)
  };
}

export function createDiaryWeatherSnapshot(
  value: DiaryEditorValue,
  context: DiaryAtmosphereContext
): DiaryWeatherSnapshot | undefined {
  const currentWeather = context.weather;
  const coordinates = context.coordinates;
  const weatherLabel =
    value.weather.trim() ||
    resolveDiaryWeatherLabel(currentWeather);
  const locationName =
    value.location.trim() ||
    resolveDiaryWeatherLocation(currentWeather);

  if (
    !currentWeather &&
    !value.location.trim() &&
    !value.weather.trim() &&
    !coordinates
  ) {
    return undefined;
  }

  return {
    weather: weatherLabel,
    rawWeather: currentWeather?.rawWeather || weatherLabel,
    temperature: currentWeather?.temperature ?? null,
    windDirection: currentWeather?.windDirection ?? '',
    windPower: currentWeather?.windPower ?? '',
    humidity: currentWeather?.humidity ?? '',
    province: currentWeather?.province ?? '',
    city: currentWeather?.city ?? '',
    district: currentWeather?.district ?? '',
    locationName,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null
  };
}

function resolveDiaryWeatherLocation(
  data: WeatherAtmosphereData | null | undefined
): string {
  return data ? data.district || data.city || data.province : '';
}

function resolveDiaryWeatherLabel(
  data: WeatherAtmosphereData | null | undefined
): string {
  if (!data) {
    return '';
  }
  return (
    data.rawWeather ||
    weatherVariantLabels[data.weatherVariant] ||
    weatherStateLabels[data.weatherState] ||
    ''
  );
}

