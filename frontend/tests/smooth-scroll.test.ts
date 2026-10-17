import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  destroySmoothScrollForTests,
  getSmoothScrollInstanceForTests,
  scrollToWithSmoothScroll,
  useSmoothScroll
} from '../src/composables/useSmoothScroll';

const lenisInstances = vi.hoisted(() => [] as Array<any>);

vi.mock('lenis', () => ({
  default: class FakeLenis {
    options: Record<string, unknown>;
    listeners = new Map<string, Function>();
    destroy = vi.fn();
    raf = vi.fn();
    resize = vi.fn();
    scrollTo = vi.fn();
    on = vi.fn((event: string, callback: Function) => {
      this.listeners.set(event, callback);
      return this;
    });

    constructor(options: Record<string, unknown>) {
      this.options = options;
      lenisInstances.push(this);
    }
  }
}));

vi.mock('gsap', () => ({
  gsap: {
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      lagSmoothing: vi.fn()
    }
  }
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    update: vi.fn(),
    refresh: vi.fn()
  }
}));

function mockMotionPreference(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
}

function mockResizeObserver() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
}

function mountSmoothScrollHost(initialPath = '/') {
  const routePath = ref(initialPath);
  const Host = defineComponent({
    setup() {
      useSmoothScroll(() => routePath.value);
      return { routePath };
    },
    template: '<main />'
  });

  return {
    routePath,
    wrapper: mount(Host, { attachTo: document.body })
  };
}

describe('全站平滑滚动', () => {
  beforeEach(() => {
    lenisInstances.length = 0;
    mockMotionPreference(false);
    mockResizeObserver();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(16);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    destroySmoothScrollForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    lenisInstances.length = 0;
    document.body.innerHTML = '';
    document.documentElement.className = '';
  });

  it('只初始化一个 Lenis 实例，并接入 GSAP ticker 与 ScrollTrigger', async () => {
    const { routePath, wrapper } = mountSmoothScrollHost();
    await nextTick();

    expect(lenisInstances).toHaveLength(1);
    expect(getSmoothScrollInstanceForTests()).toBe(lenisInstances[0]);
    expect(lenisInstances[0].options).toMatchObject({
      smoothWheel: true,
      syncTouch: true
    });
    expect(gsap.ticker.add).toHaveBeenCalledTimes(1);
    expect(gsap.ticker.lagSmoothing).toHaveBeenCalledWith(0);
    expect(lenisInstances[0].on).toHaveBeenCalledWith('scroll', ScrollTrigger.update);

    const ticker = vi.mocked(gsap.ticker.add).mock.calls[0][0] as (time: number) => void;
    ticker(2.5);
    expect(lenisInstances[0].raf).toHaveBeenCalledWith(2500);

    routePath.value = '/album';
    await nextTick();
    expect(lenisInstances[0].resize).toHaveBeenCalled();
    expect(ScrollTrigger.refresh).toHaveBeenCalled();

    wrapper.unmount();
    expect(lenisInstances[0].destroy).toHaveBeenCalled();
    expect(gsap.ticker.remove).toHaveBeenCalledWith(ticker);
  });

  it('不会接管 story 地图、弹窗和局部滚动容器的滚轮', async () => {
    const { wrapper } = mountSmoothScrollHost();
    await nextTick();

    const prevent = lenisInstances[0].options.prevent as (node: Element) => boolean;
    const normal = document.createElement('section');
    const storyMap = document.createElement('div');
    const storyMarker = document.createElement('button');
    const dialogContent = document.createElement('div');
    const scrollPanel = document.createElement('div');
    const modalContainer = document.createElement('div');
    const modalMask = document.createElement('div');
    const modalDialog = document.createElement('div');

    storyMap.className = 'story-map-page';
    storyMap.appendChild(storyMarker);
    dialogContent.setAttribute('role', 'dialog');
    modalContainer.className = 'n-modal-container';
    modalMask.className = 'n-modal-mask';
    modalDialog.setAttribute('data-smooth-scroll-prevent', '');
    modalContainer.append(modalMask, modalDialog);
    Object.defineProperty(scrollPanel, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(scrollPanel, 'clientHeight', { configurable: true, value: 120 });
    scrollPanel.style.overflowY = 'auto';

    document.body.append(normal, storyMap, dialogContent, scrollPanel, modalContainer);

    expect(prevent(normal)).toBe(false);
    expect(prevent(storyMarker)).toBe(true);
    expect(prevent(dialogContent)).toBe(true);
    expect(prevent(scrollPanel)).toBe(true);
    expect(prevent(modalMask)).toBe(true);

    wrapper.unmount();
  });

  it('reduced-motion 下不创建 Lenis 实例', async () => {
    mockMotionPreference(true);
    const { wrapper } = mountSmoothScrollHost();
    await nextTick();

    expect(lenisInstances).toHaveLength(0);
    expect(getSmoothScrollInstanceForTests()).toBeNull();

    wrapper.unmount();
  });

  it('缺少 ResizeObserver 时跳过 Lenis，避免非完整浏览器环境崩溃', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { wrapper } = mountSmoothScrollHost();
    await nextTick();

    expect(lenisInstances).toHaveLength(0);
    expect(getSmoothScrollInstanceForTests()).toBeNull();

    wrapper.unmount();
  });

  it('程序化滚动恢复优先同步 Lenis，未启用时回退到 window.scrollTo', async () => {
    const { wrapper } = mountSmoothScrollHost();
    await nextTick();

    scrollToWithSmoothScroll(520, 4);
    expect(lenisInstances[0].scrollTo).toHaveBeenCalledWith(520, {
      immediate: true,
      force: true
    });

    wrapper.unmount();
    const nativeScrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: nativeScrollTo });

    scrollToWithSmoothScroll(120, 8);

    expect(nativeScrollTo).toHaveBeenCalledWith(8, 120);
  });
});
