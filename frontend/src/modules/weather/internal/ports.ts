import type {
  WeatherAtmosphereData,
  WeatherCoordinates
} from '../model';

export interface WeatherGateway {
  fetchAtmosphere(
    coordinates: WeatherCoordinates
  ): Promise<WeatherAtmosphereData>;
}
