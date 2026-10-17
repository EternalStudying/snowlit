import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import {
  clearAuthToken,
  setAuthToken
} from '../../../auth';
import { createHttpHomeGateway } from '../internal/httpHomeGateway';
import type { HomeLocationSnapshot } from '../model';
import { homeOverviewFixture } from './support/homeOverviewFixture';

describe('HttpHomeGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthToken('home-token');
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('读取首页总览时保留认证头与 GET 契约', async () => {
    const adapter = vi.fn(async () =>
      jsonResponse(homeOverviewFixture)
    );
    const gateway = createHttpHomeGateway({ adapter });

    await expect(gateway.fetchOverview())
      .resolves.toEqual(homeOverviewFixture);
    expect(adapter).toHaveBeenCalledWith('/api/home', {
      headers: {
        Authorization: 'Bearer home-token'
      }
    });
  });

  it('上报位置时保留精确 JSON payload 与 204 契约', async () => {
    const adapter = vi.fn(async () =>
      new Response(null, { status: 204 })
    );
    const gateway = createHttpHomeGateway({ adapter });
    const snapshot: HomeLocationSnapshot = {
      latitude: 10.1234,
      longitude: 20.1234,
      city: '示例城市',
      district: '示例街区',
      province: '示例地区',
      country: '示例国家',
      weather: '多云',
      temperature: 18
    };

    await expect(gateway.reportLocation(snapshot))
      .resolves.toBeUndefined();
    expect(adapter).toHaveBeenCalledWith(
      '/api/home/location',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer home-token'
        },
        body: JSON.stringify(snapshot)
      }
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
