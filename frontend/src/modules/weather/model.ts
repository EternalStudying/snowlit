export type WeatherState =
  | 'clear'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'heavyRain'
  | 'storm'
  | 'lightSnow'
  | 'snow'
  | 'blizzard'
  | 'fog'
  | 'sandstorm'
  | 'aurora';

export type WeatherVariant =
  | 'clear'
  | 'partlyCloudy'
  | 'overcast'
  | 'lightRain'
  | 'moderateRain'
  | 'heavyRain'
  | 'thunderstorm'
  | 'hailStorm'
  | 'lightSnow'
  | 'snow'
  | 'heavySnow'
  | 'mist'
  | 'haze'
  | 'dust'
  | 'sandstorm'
  | 'windy'
  | 'hot'
  | 'cold'
  | 'hail'
  | 'aurora'
  | 'unknown';

export type PrecipitationKind = 'none' | 'rain' | 'snow' | 'hail' | 'mixed';

export type DaylightHint = 'day' | 'night' | 'unknown';

export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherAtmosphereData {
  city: string;
  district: string;
  province: string;
  country: string;
  temperature: number | null;
  rawWeather: string;
  weatherState: WeatherState;
  weatherVariant: WeatherVariant;
  precipitationKind: PrecipitationKind;
  windDirection: string;
  windPower: string;
  humidity: string;
  daylightHint: DaylightHint;
  observedAt: string;
}
