import './weather.css';

export { default } from './WeatherAtmosphere.vue';
export {
  formatTopbarWeatherSummary,
  startWeatherUpdates,
  useWeatherAtmosphereData
} from './internal/useWeatherAtmosphereData';
export { useAutomaticWeather } from './internal/useAutomaticWeather';
export type {
  DaylightHint,
  PrecipitationKind,
  WeatherAtmosphereData,
  WeatherCoordinates,
  WeatherState,
  WeatherVariant
} from './model';
