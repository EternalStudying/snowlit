import { mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageLoader from '../src/components/PageLoader.vue';
import DiaryView from '../src/modules/diary/DiaryView.vue';

const gsapTicker = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn()
}));

vi.mock('gsap', () => ({
  gsap: {
    ticker: gsapTicker
  }
}));

function pendingResponse() {
  return new Promise<Response>(() => undefined);
}

describe('统一页面加载', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    gsapTicker.add.mockReset();
    gsapTicker.remove.mockReset();
    document.body.innerHTML = '';
  });

  it('PageLoader 只显示加载图标和页面顶部进度条', () => {
    const wrapper = mount(PageLoader);

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('页面数据加载中');
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('页面加载进度');
    expect(wrapper.text().trim()).toBe('');
    expect(wrapper.find('.page-loader__spinner').exists()).toBe(true);
    expect(wrapper.find('.page-loader__progress-bar').exists()).toBe(true);
    expect(wrapper.find('.page-loader__card').exists()).toBe(false);
    expect(wrapper.find('.page-loader__tape').exists()).toBe(false);
  });

  it('加载结束时先填满进度条，再卸载加载层', async () => {
    vi.useFakeTimers();
    const wrapper = mount(PageLoader, {
      props: {
        loading: true
      }
    });

    await wrapper.setProps({ loading: false });

    expect(wrapper.find('.page-loader').exists()).toBe(true);
    expect(wrapper.get('.page-loader').classes()).toContain('page-loader--complete');
    expect(wrapper.find('.page-loader__progress-bar').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.page-loader').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(280);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.page-loader').exists()).toBe(false);
  });

  it('日记页首屏接口未返回前显示统一加载，不提前露出章节和时间线', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/auth/me' || url === '/api/diary/months') {
          return pendingResponse();
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      })
    );

    const wrapper = mount(DiaryView, {
      global: {
        stubs: {
          Teleport: true,
          teleport: true
        }
      }
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.page-loader').exists()).toBe(true);
    expect(wrapper.find('.diary-controls').exists()).toBe(false);
    expect(wrapper.find('.diary-timeline--centered').exists()).toBe(false);

    wrapper.unmount();
  });
});
