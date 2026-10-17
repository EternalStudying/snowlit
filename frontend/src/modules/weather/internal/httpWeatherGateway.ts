import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type { WeatherAtmosphereData } from '../model';
import type { WeatherGateway } from './ports';

export interface HttpWeatherGatewayOptions {
  adapter?: HttpAdapter;
}

export function createHttpWeatherGateway({
  adapter
}: HttpWeatherGatewayOptions = {}): WeatherGateway {
  const request = adapter
    ? createSessionRequest({ adapter })
    : sessionRequest;

  return {
    fetchAtmosphere(coordinates) {
      const query = new URLSearchParams({
        latitude: String(coordinates.latitude),
        longitude: String(coordinates.longitude)
      });

      return request.json<WeatherAtmosphereData>({
        path: `/api/weather/atmosphere/browser?${query.toString()}`,
        failure: {
          message: '天气氛围加载失败',
          responseMessage: 'ignore'
        }
      });
    }
  };
}
