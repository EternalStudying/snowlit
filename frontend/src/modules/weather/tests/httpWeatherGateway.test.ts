import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken
} from '../../../auth';
import type { HttpAdapter } from '../../../http/sessionRequest';
import { createHttpWeatherGateway } from '../internal/httpWeatherGateway';

const weatherFixture = {
  city: 'Berlin',
  district: 'Mitte',
  province: 'Berlin',
  country: 'Germany',
  temperature: 24,
  rawWeather: '晴',
  weatherState: 'clear' as const,
  weatherVariant: 'clear' as const,
  precipitationKind: 'none' as const,
  windDirection: '东风',
  windPower: '3',
  humidity: '62',
  daylightHint: 'day' as const,
  observedAt: '2026-04-28T10:00:00'
};

describe('HttpWeatherGateway', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('按后端契约和坐标查询天气氛围', async () => {
    const adapter = vi.fn<HttpAdapter>(
      async () => jsonResponse(weatherFixture)
    );
    const gateway = createHttpWeatherGateway({
      adapter
    });

    await expect(gateway.fetchAtmosphere({
      latitude: 52.52,
      longitude: 13.41
    })).resolves.toEqual(weatherFixture);
    expect(adapter).toHaveBeenCalledWith(
      '/api/weather/atmosphere/browser?latitude=52.52&longitude=13.41',
      undefined
    );
  });

  it('有会话时携带 Bearer token', async () => {
    setAuthToken('jwt-token');
    const adapter = vi.fn<HttpAdapter>(
      async () => jsonResponse(weatherFixture)
    );
    const gateway = createHttpWeatherGateway({
      adapter
    });

    await gateway.fetchAtmosphere({
      latitude: 10.1234,
      longitude: 20.1234
    });

    expect(adapter).toHaveBeenCalledWith(
      '/api/weather/atmosphere/browser?latitude=10.1234&longitude=20.1234',
      {
        headers: {
          Authorization: 'Bearer jwt-token'
        }
      }
    );
  });

  it('普通 401 沿用登录过期语义', async () => {
    setAuthToken('jwt-token');
    const adapter = vi.fn<HttpAdapter>(
      async () =>
        jsonResponse(
          {
            code: 'UNAUTHORIZED',
            message: '登录已过期，请重新登录'
          },
          401
        )
    );
    const gateway = createHttpWeatherGateway({
      adapter
    });

    await expect(gateway.fetchAtmosphere({
      latitude: 10.1234,
      longitude: 20.1234
    })).rejects.toThrow(
      '登录已过期，请重新登录'
    );
    expect(getAuthToken()).toBe('');
  });
});

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
