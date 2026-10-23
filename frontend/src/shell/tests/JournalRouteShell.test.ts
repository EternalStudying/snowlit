import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import AppTopBar from '../../components/AppTopBar.vue';
import { scrollToWithSmoothScroll } from '../../composables/useSmoothScroll';
import { resetHomeLifecycleForTests } from '../../modules/home/internal/useHomeLifecycle';
import { homeOverviewFixture } from '../../modules/home/tests/support/homeOverviewFixture';
import { loadStoryRoute } from '../../modules/story';
import { preserveNextRouteScrollPosition } from '../../navigation/routeScrollPolicy';
import appRouter, { routes } from '../../router';
import JournalRouteShell from '../JournalRouteShell.vue';
import { burstPetals } from '../world/ambientDrift';

vi.mock('../../composables/useSmoothScroll', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../composables/useSmoothScroll')>()),
  scrollToWithSmoothScroll: vi.fn()
}));

vi.mock('../world/ambientDrift', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../world/ambientDrift')>()),
  burstPetals: vi.fn()
}));

function mockHomeShellFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/home') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(homeOverviewFixture) });
    }
    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  }) as unknown as typeof fetch;
}

function rect(overrides: Partial<DOMRect>): DOMRect {
  return {
    x: overrides.x ?? overrides.left ?? 0,
    y: overrides.y ?? overrides.top ?? 0,
    top: overrides.top ?? 0,
    right: overrides.right ?? 0,
    bottom: overrides.bottom ?? 0,
    left: overrides.left ?? 0,
    width: overrides.width ?? 0,
    height: overrides.height ?? 0,
    toJSON: () => ({})
  } as DOMRect;
}

function mockReducedMotion(matches: boolean) {
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

async function mountShell(path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push(path);
  await router.isReady();
  const wrapper = mount(JournalRouteShell, {
    attachTo: document.body,
    global: { plugins: [router] },
    slots: { default: '<main class="page-stub">页面内容</main>' }
  });
  await flushPromises();
  return { router, wrapper };
}

beforeEach(() => {
  resetHomeLifecycleForTests();
  vi.stubGlobal('fetch', mockHomeShellFetch());
  vi.mocked(scrollToWithSmoothScroll).mockClear();
  vi.mocked(burstPetals).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetHomeLifecycleForTests();
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('封面与夜色', () => {
  it('封面轮流展示两幅画，两人的名字来自首页数据', async () => {
    const { wrapper } = await mountShell('/');

    expect(wrapper.findAll('.snow-cover__painting')).toHaveLength(2);
    expect(wrapper.get('.snow-cover__painting.is-active').attributes('loading')).toBe('eager');
    expect(wrapper.findAll('.snow-cover__person figcaption').map((item) => item.text())).toEqual(['伴侣 A', '伴侣 B']);
    wrapper.unmount();
  });

  it('首页铺开夜空，其他页面暂时保留纸面底色并用矮一些的封面', async () => {
    const { router, wrapper } = await mountShell('/');
    expect(wrapper.get('.snow-shell').attributes('data-world')).toBe('evening');
    expect(wrapper.find('.snow-sky').exists()).toBe(true);
    expect(wrapper.get('.snow-cover').classes()).not.toContain('snow-cover--short');

    await router.push('/diary');
    await flushPromises();
    expect(wrapper.get('.snow-shell').attributes('data-world')).toBe('paper');
    expect(wrapper.find('.snow-sky').exists()).toBe(false);
    expect(wrapper.get('.snow-cover').classes()).toContain('snow-cover--short');
    wrapper.unmount();
  });

  it('点爱心从爱心中心撒一把花瓣', async () => {
    const { wrapper } = await mountShell('/');
    const heart = wrapper.get('.snow-cover__heart');
    vi.spyOn(heart.element, 'getBoundingClientRect').mockReturnValue(rect({ left: 100, top: 200, width: 60, height: 50 }));

    await heart.trigger('click');

    expect(burstPetals).toHaveBeenCalledWith(130, 225);
    wrapper.unmount();
  });
});

describe('导航牌', () => {
  it('默认路由切换仍回到页面顶部', () => {
    expect(appRouter.options.scrollBehavior?.({} as never, {} as never, null)).toEqual({ top: 0, left: 0 });
  });

  it('导航触发的下一次跨页切换保留当前滚动位置，不先重置到页面开头', () => {
    preserveNextRouteScrollPosition();

    expect(appRouter.options.scrollBehavior?.({} as never, {} as never, null)).toBe(false);
    expect(appRouter.options.scrollBehavior?.({} as never, {} as never, null)).toEqual({ top: 0, left: 0 });
  });

  it('五个入口按留言、日记、首页、相册、清单排列，当前页面亮着灯', async () => {
    const { router, wrapper } = await mountShell('/album');

    const links = wrapper.findAll('.snow-plaque__link');
    expect(links.map((link) => link.attributes('href'))).toEqual(['/messages', '/diary', '/', '/album', '/wishes']);
    expect(links.map((link) => link.text())).toEqual(['留言', '日记', '首页', '相册', '清单']);
    expect(wrapper.get('.snow-plaque__link.is-active').attributes('href')).toBe('/album');
    expect(wrapper.get('.snow-plaque__link.is-active').attributes('aria-current')).toBe('page');

    await router.push('/');
    await flushPromises();
    expect(wrapper.get('.snow-plaque__link.is-active').attributes('href')).toBe('/');
    wrapper.unmount();
  });

  it('点当前页面的入口不跳转，只滚到导航牌刚停靠的位置', async () => {
    const { router, wrapper } = await mountShell('/diary');
    const cover = wrapper.get('.snow-cover').element as HTMLElement;
    Object.defineProperty(cover, 'offsetTop', { configurable: true, value: 0 });
    Object.defineProperty(cover, 'offsetHeight', { configurable: true, value: 600 });

    await wrapper.get('.snow-plaque__link[href="/diary"]').trigger('click', { button: 0 });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/diary');
    expect(scrollToWithSmoothScroll).toHaveBeenCalledWith(524, 0, expect.objectContaining({ immediate: true }));
    wrapper.unmount();
  });

  it('跨页导航保留滚动位置，新页面出现后再滚到导航牌下方', async () => {
    const { router, wrapper } = await mountShell('/');
    const cover = wrapper.get('.snow-cover').element as HTMLElement;
    Object.defineProperty(cover, 'offsetTop', { configurable: true, value: 0 });
    Object.defineProperty(cover, 'offsetHeight', { configurable: true, value: 600 });

    await wrapper.get('.snow-plaque__link[href="/diary"]').trigger('click', { button: 0 });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/diary');
    expect(scrollToWithSmoothScroll).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('按住修饰键点入口时交给浏览器，不额外滚动', async () => {
    const { wrapper } = await mountShell('/diary');

    await wrapper.get('.snow-plaque__link[href="/diary"]').trigger('click', { button: 0, metaKey: true });

    expect(scrollToWithSmoothScroll).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('点滴和关于不在导航牌上，而在顶栏左侧，关于保持锁定且只显示图标', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const shell = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    expect(shell.find('.snow-plaque a[href="/story"]').exists()).toBe(false);
    expect(shell.find('.snow-plaque a[href="/about"]').exists()).toBe(false);
    expect(shell.findAll('.snow-plaque__link').map((item) => item.text())).not.toContain('点滴');
    expect(shell.findAll('.snow-plaque__link').map((item) => item.text())).not.toContain('关于');

    const topbar = mount(AppTopBar, {
      global: { plugins: [router] }
    });
    await flushPromises();

    expect(topbar.get('.app-topbar__story-actions').classes()).toContain('app-topbar__story-actions--left');
    expect(topbar.get('.app-topbar__story-actions').classes()).toContain('app-topbar__dock-motion');
    expect(topbar.get('.app-topbar__story-entry').text()).toBe('');
    expect(topbar.get('.app-topbar__story-entry').attributes('aria-label')).toBe('进入点滴地图');
    expect(topbar.get('.app-topbar__story-entry').attributes('type')).toBe('button');
    expect(topbar.find('.app-topbar__story-entry .app-topbar__entry-icon svg').exists()).toBe(true);
    expect(topbar.get('.app-topbar__about-entry').text()).toBe('');
    expect(topbar.get('.app-topbar__about-entry').attributes('aria-label')).toBe('关于暂未开放');
    expect(topbar.find('.app-topbar__about-entry .app-topbar__entry-icon svg').exists()).toBe(true);
    expect(topbar.get('.app-topbar__about-entry').attributes('aria-disabled')).toBe('true');
    expect(topbar.get('.app-topbar__about-entry').attributes('disabled')).toBeDefined();

    shell.unmount();
    topbar.unmount();
  });
});

describe('顶栏点滴入口', () => {
  it('顶栏点滴点击只扩散纯黑沉浸层，不在转场层显示额外加载动画', async () => {
    await loadStoryRoute();
    vi.useFakeTimers();
    mockReducedMotion(true);
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/diary');
    await router.isReady();

    const wrapper = mount(AppTopBar, {
      global: { plugins: [router] }
    });
    await flushPromises();

    const storyEntry = wrapper.get('.app-topbar__story-entry').element as HTMLElement;
    vi.spyOn(storyEntry, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 12, bottom: 48, left: 24, right: 96, width: 72, height: 36 })
    );

    storyEntry.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await wrapper.vm.$nextTick();

    const transition = document.body.querySelector<HTMLElement>('.story-route-transition');
    expect(transition).not.toBeNull();
    expect(transition?.style.getPropertyValue('--story-route-x')).toBe('60.00px');
    expect(transition?.querySelector('.story-route-transition__blackout')).not.toBeNull();
    expect(transition?.querySelector('.story-route-transition__loader')).toBeNull();
    expect(transition?.textContent).not.toContain('正在进入点滴地图');
    expect(router.currentRoute.value.fullPath).toBe('/diary');

    await vi.advanceTimersByTimeAsync(260);
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/story');
    expect(document.body.querySelector('.story-route-transition')).toBeNull();

    wrapper.unmount();
  });

  it('点滴黑场转场期间连续点击不会重复跳转或留下多个遮罩', async () => {
    await loadStoryRoute();
    vi.useFakeTimers();
    mockReducedMotion(true);
    const router = createRouter({ history: createMemoryHistory(), routes });
    const originalPush = router.push.bind(router);
    const pushSpy = vi.spyOn(router, 'push').mockImplementation((to) => originalPush(to));
    router.push('/');
    await router.isReady();
    pushSpy.mockClear();

    const wrapper = mount(AppTopBar, {
      global: { plugins: [router] }
    });
    await flushPromises();

    const storyEntry = wrapper.get('.app-topbar__story-entry').element as HTMLElement;
    vi.spyOn(storyEntry, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 12, bottom: 48, left: 24, right: 96, width: 72, height: 36 })
    );

    storyEntry.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    storyEntry.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await wrapper.vm.$nextTick();

    expect(document.body.querySelectorAll('.story-route-transition')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(260);
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith('/story');
    expect(document.body.querySelector('.story-route-transition')).toBeNull();

    wrapper.unmount();
  });

  it('顶栏点滴支持 Space 键触发黑场进入 story 路由', async () => {
    await loadStoryRoute();
    vi.useFakeTimers();
    mockReducedMotion(true);
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(AppTopBar, {
      global: { plugins: [router] }
    });
    await flushPromises();

    const storyEntry = wrapper.get('.app-topbar__story-entry').element as HTMLElement;
    vi.spyOn(storyEntry, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 12, bottom: 48, left: 24, right: 96, width: 72, height: 36 })
    );

    storyEntry.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector('.story-route-transition')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(260);
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/story');
    expect(document.body.querySelector('.story-route-transition')).toBeNull();

    wrapper.unmount();
  });
});
