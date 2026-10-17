import type { WeatherState } from '../model';

type WeatherTransitionKey = `${WeatherState}->${WeatherState}`;

const WEATHER_TRANSITION_ROUTES: Partial<Record<WeatherTransitionKey, WeatherState[]>> = {
  'clear->storm': ['cloudy', 'rain', 'heavyRain', 'storm'],
  'storm->clear': ['rain', 'cloudy', 'clear'],
  'clear->blizzard': ['lightSnow', 'snow', 'blizzard'],
  'blizzard->clear': ['snow', 'lightSnow', 'clear'],
  'sandstorm->rain': ['clear', 'cloudy', 'drizzle', 'rain'],
  'aurora->clear': ['clear']
};

export function resolveWeatherTransitionRoute(fromState: WeatherState, toState: WeatherState): WeatherState[] {
  return WEATHER_TRANSITION_ROUTES[`${fromState}->${toState}`] ?? [toState];
}
