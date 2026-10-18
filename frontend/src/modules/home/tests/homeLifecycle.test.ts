import { clearAuthToken, setAuthToken } from '../../../auth';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';
import type { WeatherAtmosphereData } from '../../weather';
import { createHomeLifecycle } from '../internal/useHomeLifecycle';
import type {
  HomeLocationSnapshot,
  HomeOverview
} from '../model';
import { createMemoryHomeGateway } from './support/memoryHomeGateway';
import { homeOverviewFixture } from './support/homeOverviewFixture';

const weatherFixture: WeatherAtmosphereData = {
  city: '示例城市',
  district: '示例街区',
  province: '示例地区',
  country: '示例国家',
  temperature: 18,
  rawWeather: '多云',
  weatherState: 'cloudy',
  weatherVariant: 'partlyCloudy',
  precipitationKind: 'none',
  windDirection: '东风',
  windPower: '3',
  humidity: '70',
  daylightHint: 'day',
  observedAt: '2026-05-16T20:30:00'
};

const coordinates = {
  latitude: 10.1234,
  longitude: 20.1234
};

describe('HomeLifecycle', () => {
  it('does not persist unknown location fallbacks', async () => {
    const reportLocation = vi.fn(async () => undefined);
    const lifecycle = createHomeLifecycle({gateway: createMemoryHomeGateway({overview: homeOverviewFixture, overrides: {reportLocation}})});
    await lifecycle.syncWeatherLocation({...weatherFixture, city: 'unknown', district: '', province: '', country: '', temperature: null, rawWeather: '', weatherVariant: 'unknown'}, coordinates);
    expect(reportLocation).not.toHaveBeenCalled();
  });

  it('persists an actual foreign country without guessing a city or weather', async () => {
    const reportLocation = vi.fn(async () => undefined);
    const lifecycle = createHomeLifecycle({gateway: createMemoryHomeGateway({overview: homeOverviewFixture, overrides: {reportLocation}})});
    await lifecycle.syncWeatherLocation({...weatherFixture, city: '', district: '', province: '', country: 'Exampleland', temperature: null, rawWeather: '', weatherVariant: 'unknown'}, coordinates);
    expect(reportLocation).toHaveBeenCalledWith({...coordinates, city: '', district: '', province: '', country: 'Exampleland', weather: null, temperature: null});
  });

  it('forgets the previous member\'s overview when the session changes', async () => {
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({ overview: homeOverviewFixture })
    });
    await lifecycle.loadOverview();
    expect(lifecycle.state.overview.value).toEqual(homeOverviewFixture);

    setAuthToken('another-member');

    expect(lifecycle.state.overview.value).toBeNull();
    expect(lifecycle.state.loaded.value).toBe(false);
    clearAuthToken();
  });

  it('ignores an overview that arrives after the session changed', async () => {
    let resolve!: (value: typeof homeOverviewFixture) => void;
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { fetchOverview: () => new Promise((done) => (resolve = done)) }
      })
    });
    const pending = lifecycle.loadOverview();
    setAuthToken('another-member');
    resolve(homeOverviewFixture);

    await expect(pending).resolves.toBeNull();
    expect(lifecycle.state.overview.value).toBeNull();
    clearAuthToken();
  });

  it('共享普通加载请求，并在成功后复用总览缓存', async () => {
    const pending = deferred<HomeOverview>();
    const fetchOverview = vi.fn(() => pending.promise);
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { fetchOverview }
      })
    });

    const first = lifecycle.loadOverview();
    const joined = lifecycle.loadOverview();
    expect(joined).toBe(first);
    expect(lifecycle.state.loading.value).toBe(true);

    pending.resolve(homeOverviewFixture);
    await expect(first).resolves.toEqual(homeOverviewFixture);
    await expect(lifecycle.loadOverview())
      .resolves.toEqual(homeOverviewFixture);

    expect(fetchOverview).toHaveBeenCalledTimes(1);
    expect(lifecycle.state.loaded.value).toBe(true);
    expect(lifecycle.state.loading.value).toBe(false);
  });

  it('强制刷新采用最后意图，较慢旧响应不能覆盖最新总览', async () => {
    const older = deferred<HomeOverview>();
    const newer = deferred<HomeOverview>();
    const fetchOverview = vi.fn()
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { fetchOverview }
      })
    });
    const latestOverview = withTogetherDays(1300);

    const oldLoad = lifecycle.loadOverview();
    const newLoad = lifecycle.refreshOverview();
    newer.resolve(latestOverview);
    await expect(newLoad).resolves.toEqual(latestOverview);
    older.resolve(homeOverviewFixture);
    await expect(oldLoad).resolves.toBeNull();

    expect(lifecycle.state.overview.value)
      .toEqual(latestOverview);
    expect(lifecycle.state.loading.value).toBe(false);
  });

  it('加载失败保留可重试错误，后续成功会清除错误', async () => {
    const fetchOverview = vi.fn()
      .mockRejectedValueOnce(new Error('首页暂时不可用'))
      .mockResolvedValueOnce(homeOverviewFixture);
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { fetchOverview }
      })
    });

    await expect(lifecycle.loadOverview()).resolves.toBeNull();
    expect(lifecycle.state.error.value).toBe('首页暂时不可用');
    expect(lifecycle.state.loaded.value).toBe(false);
    expect(lifecycle.state.loading.value).toBe(false);

    await expect(lifecycle.loadOverview())
      .resolves.toEqual(homeOverviewFixture);
    expect(lifecycle.state.error.value).toBe('');
    expect(lifecycle.state.loaded.value).toBe(true);
  });

  it('复用天气结果生成位置快照（未知地点留空），上报成功后刷新首页', async () => {
    const reportLocation = vi.fn(async () => undefined);
    const fetchOverview = vi.fn(async () =>
      homeOverviewFixture
    );
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { reportLocation, fetchOverview }
      })
    });

    await lifecycle.syncWeatherLocation(
      {
        ...weatherFixture,
        city: '  示例城市  ',
        district: 'unknown',
        rawWeather: '',
        temperature: null
      },
      coordinates
    );

    expect(reportLocation).toHaveBeenCalledWith({
      ...coordinates,
      city: '示例城市',
      district: '',
      province: '示例地区',
      country: '示例国家',
      weather: 'partlyCloudy',
      temperature: null
    });
    expect(fetchOverview).toHaveBeenCalledTimes(1);
    expect(lifecycle.state.overview.value)
      .toEqual(homeOverviewFixture);
  });

  it('合并相同的进行中位置上报，并忽略已成功上报的重复快照', async () => {
    const pending = deferred<void>();
    const reportLocation = vi.fn(() => pending.promise);
    const fetchOverview = vi.fn(async () =>
      homeOverviewFixture
    );
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { reportLocation, fetchOverview }
      })
    });

    const first = lifecycle.syncWeatherLocation(
      weatherFixture,
      coordinates
    );
    const joined = lifecycle.syncWeatherLocation(
      weatherFixture,
      coordinates
    );
    expect(joined).toBe(first);

    pending.resolve();
    await first;
    await lifecycle.syncWeatherLocation(
      weatherFixture,
      coordinates
    );

    expect(reportLocation).toHaveBeenCalledTimes(1);
    expect(fetchOverview).toHaveBeenCalledTimes(1);
  });

  it('位置上报失败不会刷新总览，并允许相同快照重试', async () => {
    const reportLocation = vi.fn()
      .mockRejectedValueOnce(new Error('位置服务不可用'))
      .mockResolvedValueOnce(undefined);
    const fetchOverview = vi.fn(async () =>
      homeOverviewFixture
    );
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { reportLocation, fetchOverview }
      })
    });

    await lifecycle.syncWeatherLocation(
      weatherFixture,
      coordinates
    );
    expect(lifecycle.state.error.value)
      .toBe('位置服务不可用');
    expect(fetchOverview).not.toHaveBeenCalled();

    await lifecycle.syncWeatherLocation(
      weatherFixture,
      coordinates
    );
    expect(reportLocation).toHaveBeenCalledTimes(2);
    expect(fetchOverview).toHaveBeenCalledTimes(1);
  });

  it('缺失天气或非有限坐标不会触发位置请求', async () => {
    const reportLocation = vi.fn(async (
      _snapshot: HomeLocationSnapshot
    ) => undefined);
    const lifecycle = createHomeLifecycle({
      gateway: createMemoryHomeGateway({
        overview: homeOverviewFixture,
        overrides: { reportLocation }
      })
    });

    await lifecycle.syncWeatherLocation(null, coordinates);
    await lifecycle.syncWeatherLocation(weatherFixture, {
      latitude: Number.NaN,
      longitude: coordinates.longitude
    });

    expect(reportLocation).not.toHaveBeenCalled();
  });
});

function withTogetherDays(
  togetherDays: number
): HomeOverview {
  return {
    ...homeOverviewFixture,
    couple: {
      ...homeOverviewFixture.couple,
      togetherDays
    }
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    }
  );
  return { promise, resolve, reject };
}
