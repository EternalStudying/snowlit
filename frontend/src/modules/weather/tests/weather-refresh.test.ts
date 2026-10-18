import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

const fixture = { city: 'Example City', district: '', province: '', country: 'Exampleland', temperature: 12,
  rawWeather: '阴', weatherState: 'cloudy', weatherVariant: 'overcast', precipitationKind: 'none',
  windDirection: '', windPower: '', humidity: '', daylightHint: 'day', observedAt: '2026-10-17T12:00:00' };
let stop: (() => void) | undefined;
const gps = vi.fn();
const fetcher = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  localStorage.setItem('snowlit_token', 'account-a');
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: gps } });
  gps.mockReset().mockImplementation((success) => success({ coords: { latitude: 52.52, longitude: 13.41 } }));
  fetcher.mockReset().mockImplementation(async () => ({ ok: true, status: 200, json: async () => fixture }));
  vi.stubGlobal('fetch', fetcher);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('weather location lifecycle', () => {
  it('passive rendering does not prompt location and does not invent a location or weather', async () => {
    const { loadWeather, formatTopbarWeatherSummary } = await import('../internal/useWeatherAtmosphereData');
    const result = await loadWeather();
    expect(gps).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(formatTopbarWeatherSummary(result)?.primary).toBe('位置待更新 · 天气待更新');
  });

  it('refreshes immediately and every 20 minutes while visible; stop releases timer', async () => {
    const { startWeatherUpdates, WEATHER_REFRESH_INTERVAL_MS: interval } = await import('../internal/useWeatherAtmosphereData');
    const updated = vi.fn();
    stop = startWeatherUpdates(updated);
    await flushPromises();
    expect(gps).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(interval - 1);
    expect(gps).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(gps).toHaveBeenCalledTimes(2);
    expect(updated).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(interval * 2);
    expect(gps).toHaveBeenCalledTimes(2);
  });

  it('does not locate in background and refreshes after returning beyond the interval', async () => {
    const { startWeatherUpdates, WEATHER_REFRESH_INTERVAL_MS: interval } = await import('../internal/useWeatherAtmosphereData');
    stop = startWeatherUpdates(() => undefined);
    await flushPromises();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(interval * 2);
    expect(gps).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(gps).toHaveBeenCalledTimes(2);
  });

  it('returning before expiry preserves the remaining refresh interval', async () => {
    const { startWeatherUpdates, WEATHER_REFRESH_INTERVAL_MS: interval } = await import('../internal/useWeatherAtmosphereData');
    stop = startWeatherUpdates(() => undefined);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(interval - 10 * 60 * 1000);
    expect(gps).toHaveBeenCalledTimes(2);
  });

  it('network latency does not turn 20 minute refreshes into 40 minute refreshes', async () => {
    fetcher.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, json: async () => fixture }), 2000)));
    const { startWeatherUpdates, WEATHER_REFRESH_INTERVAL_MS: interval } = await import('../internal/useWeatherAtmosphereData');
    stop = startWeatherUpdates(() => undefined);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(interval);
    expect(gps).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not repeat denied permission prompts and a manual retry can recover', async () => {
    gps.mockImplementationOnce((_success, failure) => failure({ code: 1 }));
    const { startWeatherUpdates, loadWeather, WEATHER_REFRESH_INTERVAL_MS: interval } = await import('../internal/useWeatherAtmosphereData');
    stop = startWeatherUpdates(() => undefined);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(interval * 3);
    expect(gps).toHaveBeenCalledTimes(1);
    await loadWeather({ force: true, requestLocation: true });
    expect(gps).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('late GPS callbacks from a previous account do not call the API', async () => {
    let resolveGps: (position: unknown) => void = () => undefined;
    gps.mockImplementationOnce((success) => { resolveGps = success; });
    const { loadWeather, useWeatherAtmosphereData } = await import('../internal/useWeatherAtmosphereData');
    const pending = loadWeather({ requestLocation: true });
    const auth = await import('../../../auth');
    auth.setAuthToken('account-b');
    resolveGps({ coords: { latitude: 52.52, longitude: 13.41 } });
    await pending;
    expect(fetcher).not.toHaveBeenCalled();
    await loadWeather();
    expect(useWeatherAtmosphereData().lastCoordinates.value).toBeNull();
  });

  it('late weather responses do not populate the next account', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const { loadWeather, useWeatherAtmosphereData } = await import('../internal/useWeatherAtmosphereData');
    const pending = loadWeather({ requestLocation: true });
    await flushPromises();
    const auth = await import('../../../auth');
    auth.setAuthToken('account-b');
    await loadWeather();
    resolveRequest({ ok: true, status: 200, json: async () => fixture });
    await pending;
    expect(useWeatherAtmosphereData().weather.value?.city).toBe('unknown');
    expect(useWeatherAtmosphereData().lastCoordinates.value).toBeNull();
  });
});
