import {
  knownWeatherPlace,
  weatherConditionLabel,
  weatherLocationName,
  type WeatherAtmosphereData
} from '../../weather';
import type {
  DiaryEditorValue,
  DiaryWeatherContext,
  DiaryWeatherSnapshot
} from '../model';

export type DiaryAtmosphereContext =
  DiaryWeatherContext<WeatherAtmosphereData>;

export function getDiaryWeatherEditorDefaults(
  context: DiaryAtmosphereContext
): Pick<DiaryEditorValue, 'location' | 'weather'> {
  return {
    location: weatherLocationName(context.weather),
    weather: weatherConditionLabel(context.weather)
  };
}

export function createDiaryWeatherSnapshot(
  value: DiaryEditorValue,
  context: DiaryAtmosphereContext
): DiaryWeatherSnapshot | undefined {
  const currentWeather = context.weather;
  const coordinates = context.coordinates;
  const weatherLabel =
    value.weather.trim() || weatherConditionLabel(currentWeather);
  const locationName =
    value.location.trim() || weatherLocationName(currentWeather);
  // The local fallback knows neither place nor weather; it is no observation.
  const knowsWeather = Boolean(
    currentWeather &&
      (weatherLocationName(currentWeather) ||
        weatherConditionLabel(currentWeather) ||
        currentWeather.temperature !== null)
  );

  if (
    !knowsWeather &&
    !value.location.trim() &&
    !value.weather.trim() &&
    !coordinates
  ) {
    return undefined;
  }

  const place = currentWeather ? knownWeatherPlace(currentWeather) : null;

  return {
    weather: weatherLabel,
    rawWeather: currentWeather?.rawWeather || weatherLabel,
    temperature: currentWeather?.temperature ?? null,
    windDirection: currentWeather?.windDirection ?? '',
    windPower: currentWeather?.windPower ?? '',
    humidity: currentWeather?.humidity ?? '',
    province: place?.province ?? '',
    city: place?.city ?? '',
    district: place?.district ?? '',
    locationName,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null
  };
}
