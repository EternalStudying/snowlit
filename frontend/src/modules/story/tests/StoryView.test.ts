import { FakeAmapMap } from './support/fakeAmapMap';
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { resetHomeLifecycleForTests } from '../../home/internal/useHomeLifecycle';
import { loadAlbumRoute } from '../../album';
import { loadDiaryRoute } from '../../diary';
import {
  clearStoryRouteOriginForTests,
  playStoryExitTransition,
  setStoryRouteOriginForTests
} from '../internal/storyRouteTransition';
import MomentDetailPopover from '../components/MomentDetailPopover.vue';
import StoryMapCanvas from '../components/StoryMapCanvas.vue';
import StoryView from '../StoryView.vue';
import { routes } from '../../../router';
import type { StoryMoment, StoryMomentListDto } from '../model';
import { homeOverviewFixture } from '../../home/tests/support/homeOverviewFixture';

const travelMoment: StoryMoment = {
  id: 2,
  title: '第一次去海边散步',
  content: '傍晚的风很温柔，我们一起走了很久。',
  eventTime: '2026-04-05T18:30:00',
  endTime: '2026-04-06T00:00:00',
  locationName: '尼斯海边',
  address: '法国尼斯',
  longitude: 7.26,
  latitude: 43.70,
  category: 'travel',
  images: ['https://example.com/sea.jpg'],
  createdByUserId: 1,
  createdAt: '2026-04-05T18:30:00',
  updatedAt: '2026-04-05T18:30:00'
};

const dailyMoment: StoryMoment = {
  id: 1,
  title: '早安早餐',
  content: '一起吃了热咖啡和吐司。',
  eventTime: '2025-08-16T09:10:00',
  endTime: null,
  locationName: '街角咖啡店',
  address: '法国巴黎',
  longitude: 2.35,
  latitude: 48.85,
  category: 'daily',
  images: [],
  createdByUserId: 2,
  createdAt: '2025-08-16T09:10:00',
  updatedAt: '2025-08-16T09:10:00'
};

function makeMoment(overrides: Partial<StoryMoment>): StoryMoment {
  return {
    ...dailyMoment,
    ...overrides,
    images: overrides.images ?? dailyMoment.images
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  };
}

function createStoryFetch(canManage = false) {
  const fullList: StoryMomentListDto = {
    items: [travelMoment, dailyMoment],
    years: [2026, 2025],
    canManage
  };

  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === '/api/site' || url === '/api/messages') {
      return Promise.reject(new Error('点滴地图页不应恢复旧接口'));
    }

    if (url === '/api/home' && method === 'GET') {
      return Promise.resolve(jsonResponse(homeOverviewFixture));
    }

    if (url === '/api/story/moments' && method === 'GET') {
      return Promise.resolve(jsonResponse(fullList));
    }

    if (url === '/api/story/moments?category=travel' && method === 'GET') {
      return Promise.resolve(jsonResponse({ ...fullList, items: [travelMoment] }));
    }

    if (url === '/api/story/moments?category=travel&year=2026' && method === 'GET') {
      return Promise.resolve(jsonResponse({ ...fullList, items: [travelMoment] }));
    }

    if (url === '/api/story/moments?category=date' && method === 'GET') {
      return Promise.resolve(jsonResponse({ ...fullList, items: [] }));
    }

    if (url === '/api/story/moments/2' && method === 'GET') {
      return Promise.resolve(jsonResponse(travelMoment));
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
  }) as unknown as typeof fetch;
}

function createEmptyStoryFetch(canManage = false) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === '/api/home' && method === 'GET') {
      return Promise.resolve(jsonResponse(homeOverviewFixture));
    }

    if (url === '/api/story/moments' && method === 'GET') {
      return Promise.resolve(jsonResponse({ items: [], years: [2026], canManage }));
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
  }) as unknown as typeof fetch;
}

async function mountStoryView(fetcher = createStoryFetch()) {
  vi.stubGlobal('fetch', fetcher);
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push('/story');
  await router.isReady();
  const wrapper = mount(StoryView, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        Teleport: true,
        teleport: true
      }
    }
  });
  await flushPromises();
  await wrapper.vm.$nextTick();
  return wrapper;
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

describe('点滴地图页', () => {
  beforeEach(() => {
    localStorage.clear();
    resetHomeLifecycleForTests();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetHomeLifecycleForTests();
    clearStoryRouteOriginForTests();
    document.body.innerHTML = '';
  });

  it('详情弹窗是代码绘制的纸卡，关闭按钮带图标', () => {
    const wrapper = mount(MomentDetailPopover, {
      props: {
        canManage: true,
        moment: {
          ...travelMoment,
          images: ['https://example.com/sea.jpg', 'https://example.com/snow.jpg', 'https://example.com/tree.jpg']
        }
      }
    });

    expect(wrapper.get('.moment-detail').attributes('role')).toBe('dialog');
    expect(wrapper.find('.moment-detail__paper-content').exists()).toBe(true);
    expect(wrapper.find('.moment-detail__cover').exists()).toBe(false);
    expect(wrapper.find('.moment-detail__tape').exists()).toBe(false);
    expect(wrapper.find('.moment-detail__close').attributes('aria-label')).toBe('关闭点滴详情');
    expect(wrapper.find('.moment-detail__close svg').exists()).toBe(true);
    expect(wrapper.findAll('.moment-detail__thumbs img')).toHaveLength(2);
    expect(wrapper.find('.moment-detail__edit').exists()).toBe(true);
    expect(wrapper.find('.moment-detail__delete').exists()).toBe(true);
  });

  it('详情缩略图打开图片查看器，三张图片可切换并关闭', async () => {
    const wrapper = mount(MomentDetailPopover, {
      attachTo: document.body,
      props: {
        canManage: true,
        moment: {
          ...travelMoment,
          images: ['https://example.com/sea.jpg', 'https://example.com/snow.jpg', 'https://example.com/tree.jpg']
        }
      }
    });

    expect(wrapper.findAll('.moment-detail__thumb')).toHaveLength(2);
    expect(wrapper.get('.moment-detail__thumb--more').text()).toContain('+1');

    await wrapper.findAll('.moment-detail__thumb')[0].trigger('click');

    expect(wrapper.get('.moment-image-viewer').attributes('role')).toBe('dialog');
    expect(wrapper.find('.moment-image-viewer__close svg').exists()).toBe(true);
    expect(wrapper.find('[aria-label="上一张图片"] svg').exists()).toBe(true);
    expect(wrapper.find('[aria-label="下一张图片"] svg').exists()).toBe(true);
    expect(wrapper.get('.moment-image-viewer__count').text()).toBe('1 / 3');
    expect(wrapper.get('.moment-image-viewer__image').attributes('src')).toBe('https://example.com/sea.jpg');

    await wrapper.get('[aria-label="下一张图片"]').trigger('click');
    await wrapper.get('[aria-label="下一张图片"]').trigger('click');

    expect(wrapper.get('.moment-image-viewer__count').text()).toBe('3 / 3');
    expect(wrapper.get('.moment-image-viewer__image').attributes('src')).toBe('https://example.com/tree.jpg');
    expect(wrapper.get('[aria-label="下一张图片"]').attributes('disabled')).toBeDefined();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.moment-image-viewer__count').text()).toBe('2 / 3');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.moment-image-viewer').exists()).toBe(false);
  });

  it('渲染全屏地图、线性节点时间线和只读权限视图', async () => {
    const fetcher = createStoryFetch(false);
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.find('[data-page-placeholder="story"]').exists()).toBe(false);
    expect(wrapper.find('.story-map-page').exists()).toBe(true);
    expect(wrapper.find('.story-map-canvas').exists()).toBe(true);
    expect(wrapper.find('.story-map-tools').exists()).toBe(false);
    expect(wrapper.get('.story-home-link').attributes('aria-label')).toBe('返回首页');
    expect(wrapper.get('.story-home-link').text()).toBe('');
    expect(wrapper.find('.story-timeline__line').exists()).toBe(true);
    expect(wrapper.get('.story-timeline__title').text()).toBe('Memory Lane');
    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(2);
    expect(wrapper.find('.story-add-button').exists()).toBe(false);
    expect(wrapper.find('.moment-detail__edit').exists()).toBe(false);
    expect(wrapper.get('.story-status-badge').text()).toContain('我们在一起');
    expect(wrapper.get('.story-status-badge').text()).toContain('1188 天');
    expect(wrapper.get('.story-status-badge').text()).toContain('距离 819.4 km');

    const timelineText = wrapper.get('.story-timeline').text();
    expect(timelineText.indexOf('早安早餐')).toBeLessThan(timelineText.indexOf('第一次去海边散步'));
    expect(wrapper.text()).not.toContain('点滴页暂未开放');
  });

  it('退出 story 时先进入纯黑场，再返回进入前来源路由和滚动位置', async () => {
    await loadDiaryRoute();
    vi.useFakeTimers();
    stubReducedMotion(true);
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    setStoryRouteOriginForTests({
      fullPath: '/diary',
      scrollX: 4,
      scrollY: 520,
      triggerRect: { x: 24, y: 12, width: 72, height: 36 },
      enteredAt: Date.now()
    });

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/story');
    await router.isReady();

    vi.stubGlobal('fetch', createStoryFetch(false));
    const wrapper = mount(StoryView, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          Teleport: true,
          teleport: true
        }
      }
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper.get('.story-home-link').trigger('click');
    await wrapper.vm.$nextTick();

    const transition = document.body.querySelector<HTMLElement>('.story-route-transition');
    expect(transition).not.toBeNull();
    expect(transition?.classList.contains('story-route-transition--exit')).toBe(true);

    await vi.advanceTimersByTimeAsync(260);
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/diary');
    expect(scrollTo).toHaveBeenCalledWith(4, 520);
    expect(document.body.querySelector('.story-route-transition')).toBeNull();

    wrapper.unmount();
  });

  it('退出 story 返回来源页后，滚动位置已稳定时不重复强制恢复', async () => {
    await loadAlbumRoute();
    vi.useFakeTimers();
    stubReducedMotion(true);
    let currentScrollX = 0;
    let currentScrollY = 0;
    const scrollTo = vi.fn((left: number, top: number) => {
      currentScrollX = left;
      currentScrollY = top;
    });
    Object.defineProperty(window, 'scrollX', { configurable: true, get: () => currentScrollX });
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => currentScrollY });
    Object.defineProperty(window, 'pageXOffset', { configurable: true, get: () => currentScrollX });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, get: () => currentScrollY });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    setStoryRouteOriginForTests({
      fullPath: '/album',
      scrollX: 0,
      scrollY: 920,
      triggerRect: { x: 24, y: 12, width: 72, height: 36 },
      enteredAt: Date.now()
    });

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/story');
    await router.isReady();

    const transition = playStoryExitTransition({ router, reducedMotion: true });
    await vi.advanceTimersByTimeAsync(300);
    await transition;
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/album');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 920);
  });

  it('为页面、marker 和时间线挂载动效状态，但不影响阅读结构', async () => {
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.get('.story-map-page').classes()).toContain('is-motion-ready');
    expect(wrapper.get('.story-timeline').classes()).toContain('story-timeline--motion');
    expect(wrapper.get('.story-timeline__line').attributes('aria-hidden')).toBe('true');
    expect(wrapper.findAll('.story-timeline__node')[0].attributes('style')).toContain('--story-node-index: 0');
    expect(wrapper.findAll('.story-marker')[0].attributes('data-story-motion-id')).toBe('1');
    expect(wrapper.findAll('.story-marker')[0].attributes('style')).toContain('--story-marker-index: 0');
    expect(wrapper.findAll('.story-marker').every((marker) => marker.classes().includes('is-breathing'))).toBe(true);
  });

  it('地图入场挂载不拦截交互的终点揭幕遮罩', async () => {
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);
    const pageChildren = Array.from(wrapper.get('.story-map-page').element.children);
    const canvasIndex = pageChildren.findIndex((child) => child.classList.contains('story-map-canvas'));
    const veil = wrapper.get('.story-map-entry-veil');
    const veilIndex = pageChildren.indexOf(veil.element);
    const toneIndex = pageChildren.findIndex((child) => child.classList.contains('story-map-page__tone'));

    expect(veil.attributes('aria-hidden')).toBe('true');
    expect(canvasIndex).toBeGreaterThanOrEqual(0);
    expect(veilIndex).toBeGreaterThan(canvasIndex);
    expect(veilIndex).toBeLessThan(toneIndex);
  });

  it('高德地图初始化保留 point 图层，避免地名文字被全部隐藏', async () => {
    const mapOptions: Array<Record<string, unknown>> = [];
    const setFeaturesMock = vi.fn();

    vi.stubGlobal('AMap', {
      Map: class extends FakeAmapMap {
        constructor(_element: HTMLElement, options: Record<string, unknown>) {
          super();
          mapOptions.push(options);
        }

        on = vi.fn();
        setFeatures = setFeaturesMock;
        setFitView = vi.fn();
        setZoomAndCenter = vi.fn();
        setPitch = vi.fn();
        setRotation = vi.fn();
        getZoom = () => 10;
        getCenter = () => ({
          getLng: () => 4.81,
          getLat: () => 45.76
        });
      },
      Marker: class {
        setMap = vi.fn();
      },
      Pixel: class {
        constructor(
          public x: number,
          public y: number
        ) {}
      }
    });

    await mountStoryView(createStoryFetch(true));

    expect(mapOptions[0]).not.toHaveProperty('features');
    expect(mapOptions[0]).not.toHaveProperty('showLabel', false);
    expect(setFeaturesMock).not.toHaveBeenCalled();
  });

  it('接管地图滚轮缩放为小步长动画，并阻止页面滚动', async () => {
    const mapOptions: Array<Record<string, unknown>> = [];
    const setZoomMock = vi.fn((zoom: number, _immediate?: boolean, _duration?: number) => {
      currentZoom = zoom;
    });
    const rafCallbacks: FrameRequestCallback[] = [];
    let currentZoom = 10;

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('AMap', {
      Map: class extends FakeAmapMap {
        constructor(_element: HTMLElement, options: Record<string, unknown>) {
          super();
          mapOptions.push(options);
        }

        on = vi.fn();
        setFitView = vi.fn();
        setZoomAndCenter = vi.fn((zoom: number) => {
          currentZoom = zoom;
        });
        setZoom = setZoomMock;
        setPitch = vi.fn();
        setRotation = vi.fn();
        getZoom = vi.fn(() => currentZoom);
        getCenter = () => ({
          getLng: () => 4.81,
          getLat: () => 45.76
        });
        destroy = vi.fn();
      },
      Marker: class {
        setMap = vi.fn();
      },
      Pixel: class {
        constructor(
          public x: number,
          public y: number
        ) {}
      }
    });

    const wrapper = mount(StoryMapCanvas, {
      attachTo: document.body,
      props: {
        moments: [travelMoment, dailyMoment],
        selectedId: null,
        canCreate: true,
        entryLocked: false,
        listReady: true,
        preloaderActive: false,
        draftLocation: null,
        motionFeedbackId: null,
        removingMotionId: null,
        reducedMotion: false,
        resetSignal: 0
      }
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(mapOptions[0]).toMatchObject({
      animateEnable: true,
      jogEnable: true,
      scrollWheel: false
    });

    const surface = wrapper.get('.story-map-canvas__surface').element;
    const firstWheel = new Event('wheel', { bubbles: true, cancelable: true }) as WheelEvent;
    Object.defineProperty(firstWheel, 'deltaY', { value: -100 });
    const secondWheel = new Event('wheel', { bubbles: true, cancelable: true }) as WheelEvent;
    Object.defineProperty(secondWheel, 'deltaY', { value: -100 });

    surface.dispatchEvent(firstWheel);
    surface.dispatchEvent(secondWheel);

    expect(firstWheel.defaultPrevented).toBe(true);
    expect(secondWheel.defaultPrevented).toBe(true);
    expect(setZoomMock).not.toHaveBeenCalled();

    rafCallbacks.shift()?.(0);

    expect(setZoomMock).toHaveBeenCalledTimes(1);
    const [targetZoom, immediate, duration] = setZoomMock.mock.calls[0];
    expect(targetZoom).toBeGreaterThan(10.16);
    expect(targetZoom).toBeLessThan(10.57);
    expect(immediate).toBe(false);
    expect(duration).toBe(120);

    wrapper.unmount();
    const callsAfterUnmount = setZoomMock.mock.calls.length;
    const afterUnmountWheel = new Event('wheel', { bubbles: true, cancelable: true }) as WheelEvent;
    Object.defineProperty(afterUnmountWheel, 'deltaY', { value: -100 });
    surface.dispatchEvent(afterUnmountWheel);
    rafCallbacks.shift()?.(0);
    expect(setZoomMock).toHaveBeenCalledTimes(callsAfterUnmount);
  });

  it('marker reveal 使用内层视觉结构，并按最新点滴优先设置出现顺序', async () => {
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);
    const markers = wrapper.findAll('.story-marker');
    const olderMarker = wrapper.get('[data-story-motion-id="1"]');
    const latestMarker = wrapper.get('[data-story-motion-id="2"]');

    expect(markers).toHaveLength(2);
    expect(latestMarker.classes()).toContain('is-latest');
    expect(latestMarker.attributes('data-story-reveal-order')).toBe('0');
    expect(olderMarker.attributes('data-story-reveal-order')).toBe('1');
    expect(latestMarker.attributes('style')).toContain('--story-marker-reveal-order: 0');
    expect(latestMarker.find('.story-marker__glint').exists()).toBe(true);
    expect(latestMarker.find('.story-marker__pulse').exists()).toBe(true);
    expect(latestMarker.find('.story-marker__visual > .story-marker__pin').exists()).toBe(true);
    expect(latestMarker.find('.story-marker__glyph').exists()).toBe(false);
  });

  it('近距离点滴聚合为 group marker，点击列表项打开正确详情', async () => {
    const closeDaily = makeMoment({
      id: 11,
      title: '校门口早餐',
      eventTime: '2026-03-02T09:00:00',
      locationName: '第一中学',
      longitude: 2.3501,
      latitude: 48.8501
    });
    const closeDate = makeMoment({
      id: 12,
      title: '操场散步',
      eventTime: '2026-03-05T18:30:00',
      locationName: '第一中学',
      longitude: 2.3503,
      latitude: 48.8502,
      category: 'date'
    });
    const farTravel = makeMoment({
      id: 13,
      title: '海边日落',
      eventTime: '2026-04-05T18:30:00',
      locationName: '尼斯海边',
      longitude: 7.26,
      latitude: 43.70,
      category: 'travel'
    });
    const list: StoryMomentListDto = {
      items: [closeDaily, closeDate, farTravel],
      years: [2026],
      canManage: false
    };
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/home' && method === 'GET') {
        return Promise.resolve(jsonResponse(homeOverviewFixture));
      }
      if (url === '/api/story/moments' && method === 'GET') {
        return Promise.resolve(jsonResponse(list));
      }
      if (url === '/api/story/moments/12' && method === 'GET') {
        return Promise.resolve(jsonResponse(closeDate));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(3);
    expect(wrapper.findAll('.story-marker')).toHaveLength(2);
    expect(wrapper.get('.story-marker--group').text()).toContain('2');

    await wrapper.get('.story-marker--group').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.story-map-group-popover').text()).toContain('第一中学');
    expect(wrapper.get('.story-map-group-popover').text()).toContain('2 条点滴');

    await wrapper.findAll('.story-map-group-popover__item')[0].trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/story/moments/12', undefined);
    expect(wrapper.get('.moment-detail').text()).toContain('操场散步');
    expect(wrapper.find('.story-map-group-popover').exists()).toBe(false);
  });

  it('初次进入显示全屏地图加载遮罩，ready 后再接页面入场', async () => {
    let resolveList!: (value: ReturnType<typeof jsonResponse>) => void;
    const listPromise = new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
      resolveList = resolve;
    });
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/home' && method === 'GET') {
        return Promise.resolve(jsonResponse(homeOverviewFixture));
      }

      if (url === '/api/story/moments' && method === 'GET') {
        return listPromise;
      }

      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;

    vi.stubGlobal('fetch', fetcher);
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/story');
    await router.isReady();
    const wrapper = mount(StoryView, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          Teleport: true,
          teleport: true
        }
      }
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.story-map-loader__paper-title').text()).toBe('点滴地图');
    expect(wrapper.get('.story-map-loader').find('img').exists()).toBe(false);
    expect(wrapper.get('.story-map-loader').text()).toContain('正在铺开我们的点滴地图');
    expect(wrapper.get('.story-map-loader').text()).toContain('读取点滴列表');
    expect(wrapper.get('.story-map-loader').text()).toMatch(/\d+%/);
    expect(wrapper.get('.story-map-page').classes()).not.toContain('has-entered-motion');

    resolveList(jsonResponse({ items: [travelMoment, dailyMoment], years: [2026, 2025], canManage: true }));
    await flushPromises();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('.story-map-loader').exists()).toBe(false);
    expect(wrapper.get('.story-map-page').classes()).toContain('has-entered-motion');
  });

  it('左侧筛选板展示标题、类型、分隔线、年份和选中态', async () => {
    const fetcher = createStoryFetch(false);
    const wrapper = await mountStoryView(fetcher);

    const panel = wrapper.get('.story-filter-panel');
    const firstCategory = panel.get('[data-story-category="all"]');
    const divider = panel.get('.story-filter-panel__divider');
    const years = panel.get('.story-filter-panel__years');

    expect(panel.get('.story-filter-panel__title').text()).toBe('点滴地图');
    expect(panel.find('img').exists()).toBe(false);
    expect(panel.findAll('.story-filter-option__icon svg')).toHaveLength(6);
    expect(firstCategory.classes()).toContain('is-active');
    expect(firstCategory.get('.story-filter-option__text').text()).toBe('全部');
    expect(panel.findAll('.story-filter-option__text').map((item) => item.text())).toEqual([
      '全部',
      '日常',
      '约会',
      '旅行',
      '纪念',
      '惊喜'
    ]);
    expect(divider.element.compareDocumentPosition(years.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(years.text()).toContain('全部年份');
    expect(years.text()).toContain('2026');
  });

  it('无第一枚坐标时保留地图，不显示空状态弹窗', async () => {
    const fetcher = createEmptyStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.find('.story-map-canvas').exists()).toBe(true);
    expect(wrapper.find('.story-state--empty').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('地图还在等第一枚坐标');
    expect(wrapper.text()).not.toContain('添加第一条点滴');
    expect(wrapper.find('.story-add-button').exists()).toBe(true);
  });

  it('地图加载失败时点击示意背景不会生成虚构坐标', async () => {
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);
    await wrapper.get('.story-map-canvas__surface').trigger('click', {clientX: 120, clientY: 80});
    await flushPromises();
    expect(wrapper.find('.moment-editor').exists()).toBe(false);
    await wrapper.get('.story-add-button').trigger('click');
    await wrapper.get('input[placeholder="这一刻的标题"]').setValue('无定位样例');
    await wrapper.get('input[role="combobox"]').setValue('示例地点');
    await wrapper.get('.moment-editor__paper-action--save').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('请先点击地图或搜索地点');
    expect((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url, init]) => url === '/api/story/moments' && (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('canManage=true 时接收真实地图落点后打开新增表单', async () => {
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);

    wrapper.getComponent({ name: 'StoryMapCanvas' }).vm.$emit('create-at', {longitude: 40, latitude: 10, locationName: '地图落点', address: '示例地点'});
    await flushPromises();

    expect(wrapper.find('.moment-editor').exists()).toBe(true);
    expect(wrapper.find('.story-map-ripple').exists()).toBe(false);
    expect(wrapper.get('.moment-editor').classes()).toContain('moment-editor--motion');
    expect(wrapper.find('.story-add-button').exists()).toBe(false);
    expect(wrapper.find('.story-timeline').exists()).toBe(false);
    expect(wrapper.get('.moment-editor').find('img').exists()).toBe(false);
    expect(wrapper.get('.moment-editor__header').text()).toBe('添加点滴');
    expect(wrapper.get('.moment-editor').text()).not.toContain('心情');
    expect(wrapper.get('.moment-editor').text()).not.toContain('天气');
    expect(wrapper.find('.moment-editor__close').exists()).toBe(false);
    expect(wrapper.find('[aria-label="搜索地点"]').exists()).toBe(false);
    expect(wrapper.find('.moment-editor__poi-panel').exists()).toBe(false);
    expect(wrapper.find('input[placeholder="经度"]').exists()).toBe(false);
    expect(wrapper.find('input[placeholder="纬度"]').exists()).toBe(false);
    expect(wrapper.find('input[aria-label="开始日期"]').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="结束日期"]').exists()).toBe(true);
    expect((wrapper.get('input[aria-label="结束日期"]').element as HTMLInputElement).value).toBe(
      (wrapper.get('input[aria-label="开始日期"]').element as HTMLInputElement).value
    );
    expect(wrapper.get('.moment-editor').text()).toContain('开始');
    expect(wrapper.get('.moment-editor').text()).toContain('结束');
    expect(wrapper.get('.moment-editor').text()).not.toContain('开始日期');
    expect(wrapper.get('.moment-editor').text()).not.toContain('结束日期');
    expect(wrapper.get('.moment-editor').attributes('style')).toContain('--moment-editor-left: 512px');
    expect(wrapper.get('.moment-editor').attributes('style')).toContain('--moment-editor-top: 384px');
    expect((wrapper.get('input[role="combobox"]').element as HTMLInputElement).value).toBe('地图落点');
    expect(wrapper.get('.moment-editor__paper-action--cancel').text()).toBe('取消');
    expect(wrapper.get('.moment-editor__paper-action--save').text()).toBe('保存点滴');

    await wrapper.get('.moment-editor__paper-action--cancel').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.moment-editor').exists()).toBe(false);
    expect(wrapper.find('.story-add-button').exists()).toBe(true);
    expect(wrapper.find('.story-timeline').exists()).toBe(true);
  });

  it('地点输入支持高德 AutoComplete 联想并写入选中坐标', async () => {
    vi.stubGlobal('AMap', {
      AutoComplete: class {
        search(keyword: string, callback: (status: string, result: unknown) => void) {
          callback('complete', {
            tips: [
              {
                id: 'poi-1',
                name: `${keyword}东门`,
                district: '法国巴黎第七区',
                location: { lng: 2.29, lat: 48.86 }
              }
            ]
          });
        }
      }
    });
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);

    wrapper.getComponent({ name: 'StoryMapCanvas' }).vm.$emit('create-at', {longitude: 40, latitude: 10, locationName: '地图落点', address: '示例地点'});
    await flushPromises();
    await wrapper.get('input[role="combobox"]').setValue('埃菲尔铁塔');
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    await flushPromises();

    expect(wrapper.get('.moment-editor__suggestion-list').text()).toContain('埃菲尔铁塔东门');

    await wrapper.get('.moment-editor__suggestion-list button').trigger('pointerdown');
    await flushPromises();

    expect((wrapper.get('input[role="combobox"]').element as HTMLInputElement).value).toBe('埃菲尔铁塔东门');
    await wrapper.get('input[placeholder="这一刻的标题"]').setValue('新的点滴');
    await wrapper.get('.moment-editor__paper-action--save').trigger('click');
    await flushPromises();

    const postCall = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url, init]) => url === '/api/story/moments' && (init as RequestInit | undefined)?.method === 'POST'
    );

    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      content: '',
      locationName: '埃菲尔铁塔东门',
      address: '法国巴黎第七区',
      longitude: 2.29,
      latitude: 48.86
    });
    expect(body.endTime).toBe(body.eventTime);
  });

  it('底部按钮可以取消和保存点滴', async () => {
    const createdMoment: StoryMoment = {
      ...dailyMoment,
      id: 99,
      title: '新的点滴',
      eventTime: '2026-05-22T00:00:00',
      locationName: '地图落点',
      longitude: 2.30,
      latitude: 48.85
    };
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/home' && method === 'GET') {
        return Promise.resolve(jsonResponse(homeOverviewFixture));
      }

      if (url === '/api/story/moments' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: [createdMoment], years: [2026], canManage: true }));
      }

      if (url === '/api/story/moments' && method === 'POST') {
        return Promise.resolve(jsonResponse(createdMoment));
      }

      if (url === '/api/story/moments/99' && method === 'GET') {
        return Promise.resolve(jsonResponse(createdMoment));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;
    const wrapper = await mountStoryView(fetcher);

    wrapper.getComponent({ name: 'StoryMapCanvas' }).vm.$emit('create-at', {longitude: 40, latitude: 10, locationName: '地图落点', address: '示例地点'});
    await flushPromises();
    await wrapper.get('.moment-editor__paper-action--cancel').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.moment-editor').exists()).toBe(false);

    wrapper.getComponent({ name: 'StoryMapCanvas' }).vm.$emit('create-at', {longitude: 40, latitude: 10, locationName: '地图落点', address: '示例地点'});
    await flushPromises();
    await wrapper.get('input[placeholder="这一刻的标题"]').setValue('新的点滴');
    await wrapper.get('.moment-editor__paper-action--save').trigger('click');
    await flushPromises();

    const postCall = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url, init]) => url === '/api/story/moments' && (init as RequestInit | undefined)?.method === 'POST'
    );

    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      title: '新的点滴',
      content: '',
      locationName: '地图落点',
      category: 'daily'
    });
    expect(body.endTime).toBe(body.eventTime);
  });

  it('canManage=false 时点击地图空白处不会打开新增表单', async () => {
    const fetcher = createStoryFetch(false);
    const wrapper = await mountStoryView(fetcher);

    await wrapper.get('.story-map-canvas__surface').trigger('click', { clientX: 120, clientY: 80 });
    await flushPromises();

    expect(wrapper.find('.moment-editor').exists()).toBe(false);
    expect(wrapper.find('.story-map-ripple').exists()).toBe(false);
  });

  it('reduced motion 下不生成涟漪和常驻呼吸，但仍可打开新增表单', async () => {
    stubReducedMotion(true);
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.get('.story-map-page').classes()).toContain('is-reduced-motion');
    expect(wrapper.get('.story-map-entry-veil').attributes('style') ?? '').not.toContain('opacity: 1');
    expect(wrapper.findAll('.story-marker')[0].classes()).not.toContain('is-breathing');

    wrapper.getComponent({ name: 'StoryMapCanvas' }).vm.$emit('create-at', {longitude: 40, latitude: 10, locationName: '地图落点', address: '示例地点'});
    await flushPromises();

    expect(wrapper.find('.moment-editor').exists()).toBe(true);
    expect(wrapper.find('.story-map-ripple').exists()).toBe(false);
  });

  it('类型和年份筛选会重新请求接口并同步地图标记与时间线节点', async () => {
    const fetcher = createStoryFetch(false);
    const wrapper = await mountStoryView(fetcher);

    await wrapper.get('[data-story-category="travel"]').trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/story/moments?category=travel', undefined);
    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(1);
    expect(wrapper.text()).toContain('第一次去海边散步');
    expect(wrapper.text()).not.toContain('早安早餐');

    await wrapper.get('[data-story-year="2026"]').trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/story/moments?category=travel&year=2026', undefined);
  });

  it('点击筛选时显示 Snowlit 风格路线加载状态', async () => {
    const fullList: StoryMomentListDto = {
      items: [travelMoment, dailyMoment],
      years: [2026, 2025],
      canManage: false
    };
    let resolveFiltered!: (value: ReturnType<typeof jsonResponse>) => void;
    const filteredResponse = new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
      resolveFiltered = resolve;
    });
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/home' && method === 'GET') {
        return Promise.resolve(jsonResponse(homeOverviewFixture));
      }

      if (url === '/api/story/moments' && method === 'GET') {
        return Promise.resolve(jsonResponse(fullList));
      }

      if (url === '/api/story/moments?category=travel' && method === 'GET') {
        return filteredResponse;
      }

      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;
    const wrapper = await mountStoryView(fetcher);

    await wrapper.get('[data-story-category="travel"]').trigger('click');
    await wrapper.vm.$nextTick();

    const loader = wrapper.get('.story-state--loading');
    expect(loader.text()).toContain('筛选点滴中...');
    expect(loader.find('.story-filter-loader').exists()).toBe(true);
    expect(loader.findAll('.story-filter-loader__route')).toHaveLength(3);
    expect(loader.findAll('.story-filter-loader__dot')).toHaveLength(3);
    expect(loader.findAll(':scope > span')).toHaveLength(0);

    resolveFiltered(jsonResponse({ ...fullList, items: [travelMoment] }));
    await flushPromises();
  });

  it('今日回忆入口命中同月同日点滴并打开详情', async () => {
    const today = new Date();
    const todayMoment = makeMoment({
      id: 31,
      title: '今天也记得',
      eventTime: `2024-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T08:00:00`,
      category: 'anniversary'
    });
    const latestMoment = makeMoment({
      id: 32,
      title: '最近的一天',
      eventTime: '2026-05-23T20:00:00',
      category: 'travel'
    });
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/home' && method === 'GET') {
        return Promise.resolve(jsonResponse(homeOverviewFixture));
      }
      if (url === '/api/story/moments' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: [todayMoment, latestMoment], years: [2026, 2024], canManage: false }));
      }
      if (url === '/api/story/moments/31' && method === 'GET') {
        return Promise.resolve(jsonResponse(todayMoment));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.get('.story-memory-entry').text()).toContain('今天的回忆');

    await wrapper.get('.story-memory-entry').trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/story/moments/31', undefined);
    expect(wrapper.get('.moment-detail').text()).toContain('今天也记得');
  });

  it('没有同日回忆时入口 fallback 到最近点滴', async () => {
    const olderMoment = makeMoment({
      id: 41,
      title: '更早的点滴',
      eventTime: '2024-02-01T10:00:00'
    });
    const latestMoment = makeMoment({
      id: 42,
      title: '最新的点滴',
      eventTime: '2026-05-23T21:00:00',
      category: 'surprise'
    });
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/home' && method === 'GET') {
        return Promise.resolve(jsonResponse(homeOverviewFixture));
      }
      if (url === '/api/story/moments' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: [olderMoment, latestMoment], years: [2026, 2024], canManage: false }));
      }
      if (url === '/api/story/moments/42' && method === 'GET') {
        return Promise.resolve(jsonResponse(latestMoment));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.get('.story-memory-entry').text()).toContain('最近点滴');

    await wrapper.get('.story-memory-entry').trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/story/moments/42', undefined);
    expect(wrapper.get('.moment-detail').text()).toContain('最新的点滴');
  });

  it('筛选状态下点击回忆入口会恢复全部并选中目标', async () => {
    const today = new Date();
    const memoryMoment = makeMoment({
      id: 51,
      title: '筛选外的今天',
      eventTime: `2025-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T10:00:00`,
      category: 'daily'
    });
    const filteredMoment = makeMoment({
      id: 52,
      title: '旅行筛选内',
      eventTime: '2026-05-23T20:00:00',
      category: 'travel'
    });
    const fullList = { items: [memoryMoment, filteredMoment], years: [2026, 2025], canManage: false };
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/home' && method === 'GET') {
        return Promise.resolve(jsonResponse(homeOverviewFixture));
      }
      if (url === '/api/story/moments' && method === 'GET') {
        return Promise.resolve(jsonResponse(fullList));
      }
      if (url === '/api/story/moments?category=travel' && method === 'GET') {
        return Promise.resolve(jsonResponse({ ...fullList, items: [filteredMoment] }));
      }
      if (url === '/api/story/moments/51' && method === 'GET') {
        return Promise.resolve(jsonResponse(memoryMoment));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;
    const wrapper = await mountStoryView(fetcher);

    await wrapper.get('[data-story-category="travel"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(1);

    await wrapper.get('.story-memory-entry').trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenLastCalledWith('/api/story/moments/51', undefined);
    expect(wrapper.get('[data-story-category="all"]').classes()).toContain('is-active');
    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(2);
    expect(wrapper.get('.moment-detail').text()).toContain('筛选外的今天');
  });

  it('筛选结果为空时仍保留地图，不显示空状态弹窗', async () => {
    const fetcher = createStoryFetch(false);
    const wrapper = await mountStoryView(fetcher);

    await wrapper.get('[data-story-category="date"]').trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/story/moments?category=date', undefined);
    expect(wrapper.find('.story-map-canvas').exists()).toBe(true);
    expect(wrapper.find('.story-state--empty').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('这个筛选下还没有点滴');
    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(0);
  });

  it('右键地图会恢复初始浏览状态', async () => {
    const fetcher = createStoryFetch(false);
    const wrapper = await mountStoryView(fetcher);

    await wrapper.get('[data-story-category="travel"]').trigger('click');
    await flushPromises();
    await wrapper.findAll('.story-timeline__node')[0].trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(1);
    expect(wrapper.find('.moment-detail').exists()).toBe(true);

    await wrapper.get('.story-map-canvas__surface').trigger('contextmenu');
    await flushPromises();

    expect(fetcher).toHaveBeenLastCalledWith('/api/story/moments', undefined);
    expect(wrapper.find('.moment-detail').exists()).toBe(false);
    expect(wrapper.findAll('.story-timeline__node')).toHaveLength(2);
    expect(wrapper.get('[data-story-category="all"]').classes()).toContain('is-active');
  });

  it('canManage=true 时显示新增、编辑、删除入口，点击节点打开详情', async () => {
    const fetcher = createStoryFetch(true);
    const wrapper = await mountStoryView(fetcher);

    expect(wrapper.find('.story-add-button').exists()).toBe(true);
    expect(wrapper.get('.story-add-button').text()).toContain('添加点滴');

    await wrapper.findAll('.story-timeline__node')[1].trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/story/moments/2', undefined);
    expect(wrapper.get('.moment-detail').text()).toContain('第一次去海边散步');
    expect(wrapper.get('.moment-detail').text()).toContain('开始 2026.04.05');
    expect(wrapper.get('.moment-detail').text()).toContain('结束 2026.04.06');
    expect(wrapper.find('.moment-detail__edit').exists()).toBe(true);
    expect(wrapper.find('.moment-detail__delete').exists()).toBe(true);
  });
});
