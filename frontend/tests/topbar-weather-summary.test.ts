import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { NMessageProvider } from 'naive-ui';
import { h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../src/router';
import type { WeatherAtmosphereData } from '../src/modules/weather';

const mountedWrappers: Array<{ unmount(): void }> = [];

function createWeather(partial: Partial<WeatherAtmosphereData> = {}): WeatherAtmosphereData {
  return {
    city: '柏林',
    district: '米特区',
    province: '柏林州',
    country: '德国',
    temperature: 18,
    rawWeather: '晴',
    weatherState: 'clear',
    weatherVariant: 'clear',
    precipitationKind: 'none',
    windDirection: '东风',
    windPower: '2',
    humidity: '60',
    daylightHint: 'day',
    observedAt: '2026-05-16T09:30:00+02:00',
    ...partial
  };
}

function mockNavigatorGeolocation(
  getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback | null) => void
) {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition
    }
  });
}

async function mountFreshTopbar(weather: WeatherAtmosphereData, props: Record<string, unknown> = {}) {
  vi.resetModules();
  mockNavigatorGeolocation((success) => {
    success({
      coords: {
        latitude: 52.52,
        longitude: 13.41,
        accuracy: 1,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({})
      },
      timestamp: Date.now(),
      toJSON: () => ({})
    });
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(weather)
      })
    )
  );

  const [{ default: AppTopBar }] = await Promise.all([import('../src/components/AppTopBar.vue')]);
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push('/');
  await router.isReady();

  const wrapper = mount(NMessageProvider, {
    slots: {
      default: () => h(AppTopBar, props)
    },
    global: {
      plugins: [router]
    }
  });
  await flushPromises();
  mountedWrappers.push(wrapper);
  return wrapper;
}

function stubDesktopTooltipMedia(enabled: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('(hover: hover)') && query.includes('(pointer: fine)') ? enabled : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

// The weather schedule runs on timeouts and intervals; animation frames stay real so that an always-on frame loop
// (GSAP's ticker) does not replay tens of thousands of faked frames while the test jumps 20 minutes ahead.
const SCHEDULE_TIMERS = { toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] } as const;

describe('顶栏导航融合后的天气摘要', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem('snowlit_token', 'test-token');
    localStorage.setItem('snowlit-weather-location-consent', 'enabled');
  });
  afterEach(() => { mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount()); });

  it('AppTopBar 继续渲染居中的 Snowlit，并包含不参与居中的天气摘要容器', async () => {
    const wrapper = await mountFreshTopbar(createWeather());

    expect(wrapper.get('.app-topbar__brand').text()).toContain('Snowlit');
    expect(wrapper.find('.app-topbar__weather-summary').exists()).toBe(true);
    expect(wrapper.get('.app-topbar__weather-summary').text()).toContain('米特区 · 晴 18°C');
  });

  it('格式化位置、天气、温度、风、湿度，并把 observedAt 放入可访问文本', async () => {
    const { formatTopbarWeatherSummary } = await import('../src/modules/weather');
    const summary = formatTopbarWeatherSummary(createWeather());

    expect(summary?.primary).toBe('米特区 · 晴 18°C');
    expect(summary?.secondary).toBe('东风 2级 · 湿度 60%');
    expect(summary?.label).toContain('更新时间 2026-05-16T09:30:00+02:00');
  });

  it('缺字段时删除对应片段，不出现多余分隔符', async () => {
    const { formatTopbarWeatherSummary } = await import('../src/modules/weather');
    const summary = formatTopbarWeatherSummary(
      createWeather({
        city: '',
        district: '',
        rawWeather: '',
        temperature: null,
        weatherState: 'cloudy',
        weatherVariant: 'overcast',
        windDirection: '',
        windPower: '',
        humidity: '',
        observedAt: ''
      })
    );

    expect(summary?.primary).toBe('柏林州 · 阴');
    expect(summary?.secondary).toBe('');
    expect(`${summary?.primary} ${summary?.secondary} ${summary?.label}`).not.toMatch(/undefined|null|NaN|·\s*·/);
  });

  it('共享 composable 让多个消费者不重复定位和天气请求', async () => {
    vi.resetModules();

    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 52.52,
          longitude: 13.41,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({})
        },
        timestamp: Date.now(),
        toJSON: () => ({})
      });
    });
    mockNavigatorGeolocation(getCurrentPosition);
    const fetcher = vi.fn(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(createWeather())
      })
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetcher);

    const { useWeatherAtmosphereData } = await import('../src/modules/weather');
    const first = useWeatherAtmosphereData();
    const second = useWeatherAtmosphereData();
    await Promise.all([first.loadWeather({ requestLocation: true }), second.loadWeather({ requestLocation: true })]);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/weather/atmosphere/browser?latitude=52.52&longitude=13.41'
    );
  });

  it('首次请求失败显示未知，前台 20 分钟更新可替换为真实天气', async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: [...SCHEDULE_TIMERS.toFake] });

    try {
      mockNavigatorGeolocation((success) => {
        success({
          coords: {
            latitude: 52.52,
            longitude: 13.41,
            accuracy: 1,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({})
          },
          timestamp: Date.now(),
          toJSON: () => ({})
        });
      });
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce({
          status: 503,
          ok: false,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(createWeather())
        }) as unknown as typeof fetch;
      vi.stubGlobal('fetch', fetcher);

      const { formatTopbarWeatherSummary, useWeatherAtmosphereData, startWeatherUpdates } = await import(
        '../src/modules/weather'
      );
      const state = useWeatherAtmosphereData();

      const stop = startWeatherUpdates(() => undefined);
      await flushPromises();
      expect(formatTopbarWeatherSummary(state.weather.value)?.primary).toBe('位置待更新 · 天气待更新');

      await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
      await flushPromises();

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(formatTopbarWeatherSummary(state.weather.value)?.primary).toBe('米特区 · 晴 18°C');
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('桌面端顶栏按钮使用 Teleport tooltip，focus 打开并按 300ms closeDelay 关闭', async () => {
    vi.useFakeTimers({ toFake: [...SCHEDULE_TIMERS.toFake] });
    stubDesktopTooltipMedia(true);

    try {
      const wrapper = await mountFreshTopbar(createWeather(), { showFeedback: true });

      await wrapper.get('.app-topbar__story-entry').trigger('focusin');
      await vi.advanceTimersByTimeAsync(0);
      await flushPromises();

      const tooltip = document.body.querySelector<HTMLElement>('[data-testid="topbar-tooltip"]');
      expect(tooltip?.parentElement).toBe(document.body);
      expect(tooltip?.textContent).toContain('点滴');
      expect(tooltip?.dataset.side).toBe('top');
      expect(tooltip?.dataset.align).toBe('center');
      expect(tooltip?.dataset.state).toBe('open');

      await wrapper.get('.app-topbar__story-entry').trigger('focusout');
      await vi.advanceTimersByTimeAsync(299);
      await flushPromises();
      expect(document.body.querySelector<HTMLElement>('[data-testid="topbar-tooltip"]')?.dataset.state).toBe('open');

      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
      expect(document.body.querySelector<HTMLElement>('[data-testid="topbar-tooltip"]')?.dataset.state).toBe('closed');

      await vi.advanceTimersByTimeAsync(240);
      await flushPromises();
      expect(document.body.querySelector('[data-testid="topbar-tooltip"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('移动或粗指针设备不显示顶栏 tooltip，也不保留原生 title', async () => {
    stubDesktopTooltipMedia(false);

    const wrapper = await mountFreshTopbar(createWeather(), { showFeedback: true });

    expect(wrapper.get('.app-topbar__story-entry').attributes('title')).toBeUndefined();
    expect(wrapper.get('.app-topbar__about-entry').attributes('title')).toBeUndefined();
    expect(wrapper.get('[data-testid="feedback-entry"]').attributes('title')).toBeUndefined();
    expect(wrapper.get('.app-topbar__weather-summary').attributes('title')).toBeUndefined();

    await wrapper.get('.app-topbar__story-entry').trigger('mouseenter');
    await flushPromises();

    expect(document.body.querySelector('[data-testid="topbar-tooltip"]')).toBeNull();
  });
});
