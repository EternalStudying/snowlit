import { flushPromises, mount } from '@vue/test-utils';

import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import AppTopBar from '../../components/AppTopBar.vue';
import JournalRouteShell from '../JournalRouteShell.vue';
import { preserveNextRouteScrollPosition } from '../../navigation/routeScrollPolicy';
import appRouter, { routes } from '../../router';
import { loadStoryRoute } from '../../modules/story';
import { resetHomeLifecycleForTests } from '../../modules/home/internal/useHomeLifecycle';
import { homeOverviewFixture } from '../../modules/home/tests/support/homeOverviewFixture';

function mockHomeShellFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/home') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(homeOverviewFixture)
      });
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

function mockDesktopTooltipMedia(enabled: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('(hover: hover)') && query.includes('(pointer: fine)') ? enabled : false,
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

function getNavTooltipTrigger(wrapper: ReturnType<typeof mount>, label: string) {
  const trigger = wrapper
    .findAll('.topbar-tooltip-trigger')
    .find((candidate) => candidate.find(`[data-label="${label}"]`).exists());

  if (!trigger) {
    throw new Error(`Missing tooltip trigger for nav item: ${label}`);
  }

  return trigger;
}

beforeEach(() => {
  resetHomeLifecycleForTests();
  vi.stubGlobal('fetch', mockHomeShellFetch());
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }
  });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, writable: true, value: vi.fn() });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
  document.body.innerHTML = '<header class="app-topbar"></header>';
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetHomeLifecycleForTests();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('首页导航点击定位', () => {
  it('默认路由切换仍回到页面顶部，导航点击由外壳补滚到下方页面上方', () => {
    expect(appRouter.options.scrollBehavior?.({} as never, {} as never, null)).toEqual({
      top: 0,
      left: 0
    });
  });

  it('导航触发的下一次跨页切换保留当前滚动位置，不先重置到页面开头', () => {
    preserveNextRouteScrollPosition();

    expect(appRouter.options.scrollBehavior?.({} as never, {} as never, null)).toBe(false);
    expect(appRouter.options.scrollBehavior?.({} as never, {} as never, null)).toEqual({
      top: 0,
      left: 0
    });
  });

  it('渲染共享 active 轨道，并在路由变化后用 active 链接位置更新 CSS 变量', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    expect(wrapper.find('.journal-nav__active-track').exists()).toBe(true);

    const navContent = wrapper.get('.paper-nav-shell__content').element as HTMLElement;
    vi.spyOn(navContent, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 0, bottom: 52, left: 100, right: 720, width: 620, height: 52 })
    );
    const albumLink = wrapper.get('a[href="/album"]').element as HTMLElement;
    vi.spyOn(albumLink, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 8, bottom: 46, left: 356, right: 446, width: 90, height: 38 })
    );

    await router.push('/album');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const style = wrapper.get('.journal-shell').attributes('style');
    expect(style).toContain('--nav-active-x: 256.00px;');
    expect(style).toContain('--nav-active-width: 90.00px;');
    expect(style).toContain('--nav-active-opacity: 1;');

    wrapper.unmount();
  });

  it('导航融合压缩和展开时按当前显示形态重测 active 下划线宽度', async () => {
    vi.useFakeTimers();
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    const navAnchorRect = vi
      .spyOn(navAnchor, 'getBoundingClientRect')
      .mockReturnValue(rect({ top: 220, bottom: 290, left: 40, right: 950, width: 910, height: 70 }));
    const navContent = wrapper.get('.paper-nav-shell__content').element as HTMLElement;
    vi.spyOn(navContent, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 0, bottom: 52, left: 100, right: 720, width: 620, height: 52 })
    );
    const albumLink = wrapper.get('a[href="/album"]').element as HTMLElement;
    vi.spyOn(albumLink, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 8, bottom: 46, left: 356, right: 446, width: 90, height: 38 })
    );
    const albumIcon = albumLink.querySelector<HTMLElement>('.journal-nav__icon');
    expect(albumIcon).not.toBeNull();
    vi.spyOn(albumIcon!, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 18, bottom: 36, left: 392, right: 410, width: 18, height: 18 })
    );

    animationFrames.splice(0).forEach((callback) => callback(16));
    await wrapper.vm.$nextTick();

    await router.push('/album');
    await flushPromises();
    await wrapper.vm.$nextTick();

    let style = wrapper.get('.journal-shell').attributes('style');
    expect(style).toContain('--nav-active-x: 256.00px;');
    expect(style).toContain('--nav-active-width: 90.00px;');

    navAnchorRect.mockReturnValue(rect({ top: -6, bottom: 64, left: 40, right: 950, width: 910, height: 70 }));
    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(32));
    await wrapper.vm.$nextTick();
    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();
    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.journal-nav').attributes('data-nav-compact')).toBe('true');
    style = wrapper.get('.journal-shell').attributes('style');
    expect(style).toContain('--nav-active-x: 292.00px;');
    expect(style).toContain('--nav-active-width: 18.00px;');

    wrapper.unmount();
  });

  it('首次挂载时下一帧复测 active 轨道，避免初始 layout 未就绪导致轨道透明', async () => {
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });

    const navContent = wrapper.get('.paper-nav-shell__content').element as HTMLElement;
    vi.spyOn(navContent, 'getBoundingClientRect')
      .mockReturnValueOnce(rect({ top: 0, bottom: 0, left: 100, right: 100, width: 0, height: 0 }))
      .mockReturnValue(rect({ top: 0, bottom: 52, left: 100, right: 720, width: 620, height: 52 }));
    const homeLink = wrapper.get('a[href="/"]').element as HTMLElement;
    vi.spyOn(homeLink, 'getBoundingClientRect')
      .mockReturnValueOnce(rect({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }))
      .mockReturnValue(rect({ top: 8, bottom: 46, left: 356, right: 436, width: 80, height: 38 }));

    await flushPromises();
    await wrapper.vm.$nextTick();
    animationFrames.forEach((callback) => callback(16));
    await wrapper.vm.$nextTick();

    const style = wrapper.get('.journal-shell').attributes('style');
    expect(style).toContain('--nav-active-x: 256.00px;');
    expect(style).toContain('--nav-active-width: 80.00px;');
    expect(style).toContain('--nav-active-opacity: 1;');

    wrapper.unmount();
  });

  it('点击可用导航项短暂触发扫光状态，留言入口开放为可点击链接', async () => {
    const timeoutCallbacks: Array<() => void> = [];
    vi.spyOn(window, 'setTimeout').mockImplementation((callback: TimerHandler) => {
      if (typeof callback === 'function') {
        timeoutCallbacks.push(callback as () => void);
      }

      return timeoutCallbacks.length;
    });
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    const nav = wrapper.get('.journal-nav');
    const messagesEntry = wrapper.get('.journal-nav a[href="/messages"][data-label="留言"]');
    expect(messagesEntry.element.tagName).toBe('A');
    expect(wrapper.find('.journal-nav__link--locked[data-label="留言"]').exists()).toBe(false);
    await messagesEntry.trigger('click');
    expect(nav.attributes('data-nav-switching')).toBe('true');

    timeoutCallbacks.forEach((callback) => callback());
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-switching')).toBeUndefined();

    await wrapper.get('a[href="/album"]').trigger('click');
    expect(nav.attributes('data-nav-switching')).toBe('true');

    timeoutCallbacks.forEach((callback) => callback());
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-switching')).toBeUndefined();

    wrapper.unmount();
  });

  it('点滴和关于从原导航移到融合后顶栏左侧，关于保持锁定且只显示图标', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const shell = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    expect(shell.find('.journal-nav a[href="/story"]').exists()).toBe(false);
    expect(shell.find('.journal-nav a[href="/about"]').exists()).toBe(false);
    expect(shell.findAll('.journal-nav__link').map((item) => item.text())).not.toContain('点滴');
    expect(shell.findAll('.journal-nav__link').map((item) => item.text())).not.toContain('关于');

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

  it('中间导航只在融合到顶栏后显示和左侧按钮一致的 Teleport tooltip', async () => {
    vi.useFakeTimers();
    mockDesktopTooltipMedia(true);
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    const navAnchorRect = vi
      .spyOn(navAnchor, 'getBoundingClientRect')
      .mockReturnValue(rect({ top: 220, bottom: 290, left: 40, right: 950, width: 910, height: 70 }));
    animationFrames.splice(0).forEach((callback) => callback(16));
    await wrapper.vm.$nextTick();

    const albumTrigger = getNavTooltipTrigger(wrapper, '相册');
    await albumTrigger.trigger('mouseenter');
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    expect(document.body.querySelector('[data-testid="topbar-tooltip"]')).toBeNull();

    navAnchorRect.mockReturnValue(rect({ top: -6, bottom: 64, left: 40, right: 950, width: 910, height: 70 }));
    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(32));
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.journal-nav').attributes('data-nav-fusion')).toBe('docked');

    await albumTrigger.trigger('mouseenter');
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    const tooltip = document.body.querySelector<HTMLElement>('[data-testid="topbar-tooltip"]');
    expect(tooltip?.parentElement).toBe(document.body);
    expect(tooltip?.textContent).toContain('相册');
    expect(tooltip?.dataset.state).toBe('open');

    wrapper.unmount();
  });

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

  it('点击跨页导航时，路由完成后滚到导航刚好进入融合态的位置', async () => {
    const scrollTo = vi.fn();
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>当前内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    vi.spyOn(navAnchor, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 220, bottom: 284, left: 40, right: 950, width: 910, height: 64 })
    );
    const routeContent = wrapper.get('.journal-route-content').element as HTMLElement;
    vi.spyOn(routeContent, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 332, bottom: 860, left: 0, right: 1000, width: 1000, height: 528 })
    );

    animationFrames.length = 0;
    await wrapper.get('a[href="/diary"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.fullPath).toBe('/diary');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 343, behavior: 'smooth' });
  });

  it('当前已在首页时点击首页导航会滚到导航刚好进入融合态的位置', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    vi.spyOn(navAnchor, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 260, bottom: 324, left: 40, right: 950, width: 910, height: 64 })
    );
    const routeContent = wrapper.get('.journal-route-content').element as HTMLElement;
    vi.spyOn(routeContent, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 350, bottom: 900, left: 0, right: 1000, width: 1000, height: 550 })
    );

    await wrapper.get('a[href="/"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(scrollTo).toHaveBeenCalledWith({ top: 383, behavior: 'smooth' });
  });

  it('当前首页导航未产生实际滚动时，已经进入视口的首页模块也会立刻显示', async () => {
    class PassiveIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(_callback: IntersectionObserverCallback) {}
    }

    vi.stubGlobal('IntersectionObserver', PassiveIntersectionObserver);
    const scrollTo = vi.fn();
    const animationFrames: FrameRequestCallback[] = [];
    let moduleRect = rect({ top: 900, bottom: 1020, left: 0, right: 360, width: 360, height: 120 });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('route-motion-module')) {
        return moduleRect;
      }

      return rect({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: {
        default:
          '<main><section class="route-motion-module" data-motion-module="dailyNote" data-motion-enabled="true">首页内容</section></main>'
      }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    vi.spyOn(navAnchor, 'getBoundingClientRect').mockReturnValue(
      rect({ top: -3, bottom: 61, left: 40, right: 950, width: 910, height: 64 })
    );

    while (animationFrames.length > 0) {
      animationFrames.splice(0).forEach((callback) => callback(16));
    }
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.route-motion-module').attributes('data-motion-visible')).toBeUndefined();

    moduleRect = rect({ top: 120, bottom: 240, left: 0, right: 360, width: 360, height: 120 });
    await wrapper.get('a[href="/"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    while (animationFrames.length > 0) {
      animationFrames.splice(0).forEach((callback) => callback(32));
    }
    await wrapper.vm.$nextTick();

    expect(scrollTo).toHaveBeenCalledWith({ top: 120, behavior: 'smooth' });
    expect(wrapper.get('.route-motion-module').attributes('data-motion-visible')).toBe('true');

    wrapper.unmount();
  });

  it('从其他页面点击首页导航时，路由切换后滚到导航刚好进入融合态的位置', async () => {
    const scrollTo = vi.fn();
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 520 });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/diary');
    await router.isReady();
    window.history.replaceState({}, '', '/diary');

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>日记内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    vi.spyOn(navAnchor, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 220, bottom: 284, left: 40, right: 950, width: 910, height: 64 })
    );
    const routeContent = wrapper.get('.journal-route-content').element as HTMLElement;
    vi.spyOn(routeContent, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 300, bottom: 900, left: 0, right: 1000, width: 1000, height: 600 })
    );

    animationFrames.length = 0;
    await wrapper.get('a[href="/"]').trigger('click');
    expect(scrollTo).not.toHaveBeenCalled();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    window.history.replaceState({}, '', '/');
    await flushPromises();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    animationFrames.forEach((callback) => callback(16));

    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 223, behavior: 'smooth' });
  });

  it('导航已融合后跨页切换仍回到融合入口，不因路由同步 scrollY 为 0 跳到页顶', async () => {
    const scrollTo = vi.fn();
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 520 });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/album');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>相册内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    vi.spyOn(navAnchor, 'getBoundingClientRect').mockReturnValue(
      rect({ top: -6, bottom: 64, left: 40, right: 950, width: 910, height: 70 })
    );

    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(16));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.journal-nav').attributes('data-nav-fusion')).toBe('docked');

    await wrapper.get('a[href="/diary"]').trigger('click');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    await flushPromises();
    await wrapper.vm.$nextTick();
    animationFrames.splice(0).forEach((callback) => callback(32));

    expect(router.currentRoute.value.fullPath).toBe('/diary');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 520, behavior: 'smooth' });

    wrapper.unmount();
  });

  it('先点当前导航滚到融合点后，再直接点其他导航仍使用刚记录的融合入口', async () => {
    const scrollTo = vi.fn();
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    const navAnchorRect = vi.spyOn(navAnchor, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 260, bottom: 324, left: 40, right: 950, width: 910, height: 64 })
    );

    await wrapper.get('a[href="/"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(scrollTo).toHaveBeenCalledWith({ top: 383, behavior: 'smooth' });
    expect(wrapper.get('.journal-nav').attributes('data-nav-fusion')).toBe('idle');

    scrollTo.mockClear();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 383 });
    navAnchorRect.mockReturnValue(rect({ top: -3, bottom: 61, left: 40, right: 950, width: 910, height: 64 }));

    await wrapper.get('a[href="/album"]').trigger('click');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    await flushPromises();
    await wrapper.vm.$nextTick();
    animationFrames.splice(0).forEach((callback) => callback(16));

    expect(router.currentRoute.value.fullPath).toBe('/album');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 383, behavior: 'smooth' });

    wrapper.unmount();
  });

  it('滚动时按导航与顶栏中心线二态切换，不再输出 fusing', async () => {
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>首页内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    const shell = wrapper.get('.journal-shell');
    const nav = wrapper.get('.journal-nav');
    const navAnchorRect = vi
      .spyOn(navAnchor, 'getBoundingClientRect')
      .mockReturnValue(rect({ top: 0, bottom: 70, left: 40, right: 950, width: 910, height: 70 }));

    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(16));
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-fusion')).toBe('idle');
    expect(nav.attributes('data-nav-compact')).toBeUndefined();
    expect(shell.attributes('style')).toContain('--nav-fusion-progress: 0.0000;');

    navAnchorRect.mockReturnValue(rect({ top: -6, bottom: 64, left: 40, right: 950, width: 910, height: 70 }));
    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(32));
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-fusion')).toBe('docked');
    expect(nav.attributes('data-nav-fusion')).not.toBe('fusing');
    expect(shell.attributes('style')).toContain('--nav-fusion-progress: 1.0000;');
    expect(shell.attributes('style')).toContain('--nav-fusion-left: 40.00px;');
    expect(shell.attributes('style')).toContain('--nav-fusion-width: 910.00px;');
    expect(shell.attributes('style')).toContain('--nav-fusion-top: 0.00px;');
  });

  it('导航进入 docked 后先隐藏标签，再收紧图标间距', async () => {
    vi.useFakeTimers();
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/album');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>相册内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    const nav = wrapper.get('.journal-nav');
    vi.spyOn(navAnchor, 'getBoundingClientRect').mockReturnValue(
      rect({ top: -6, bottom: 64, left: 40, right: 950, width: 910, height: 70 })
    );

    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(16));
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-fusion')).toBe('docked');
    expect(nav.attributes('data-nav-labels')).toBe('hiding');
    expect(nav.attributes('data-nav-density')).toBe('regular');
    expect(nav.attributes('data-nav-compact')).toBeUndefined();

    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-labels')).toBe('hidden');
    expect(nav.attributes('data-nav-density')).toBe('compacting');
    expect(nav.attributes('data-nav-compact')).toBe('true');

    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-density')).toBe('compact');
    expect(nav.attributes('data-nav-compact')).toBe('true');

    wrapper.unmount();
  });

  it('导航退出 docked 使用 12px 回退缓冲，并先展开间距再恢复标签', async () => {
    vi.useFakeTimers();
    const scrollTo = vi.fn();
    const animationFrames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }
    });

    const topbar = document.querySelector<HTMLElement>('.app-topbar');
    expect(topbar).not.toBeNull();
    vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));

    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/album');
    await router.isReady();

    const wrapper = mount(JournalRouteShell, {
      global: { plugins: [router] },
      slots: { default: '<main>相册内容</main>' }
    });
    await flushPromises();

    const navAnchor = wrapper.get('.journal-nav-anchor').element as HTMLElement;
    const nav = wrapper.get('.journal-nav');
    const navAnchorRect = vi
      .spyOn(navAnchor, 'getBoundingClientRect')
      .mockReturnValue(rect({ top: -6, bottom: 64, left: 40, right: 950, width: 910, height: 70 }));

    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(16));
    vi.advanceTimersByTime(400);
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-fusion')).toBe('docked');
    expect(nav.attributes('data-nav-compact')).toBe('true');
    expect(nav.attributes('data-nav-labels')).toBe('hidden');
    expect(nav.attributes('data-nav-density')).toBe('compact');

    navAnchorRect.mockReturnValue(rect({ top: 6, bottom: 76, left: 40, right: 950, width: 910, height: 70 }));
    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(32));
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-fusion')).toBe('docked');

    navAnchorRect.mockReturnValue(rect({ top: 132, bottom: 202, left: 40, right: 950, width: 910, height: 70 }));
    window.dispatchEvent(new Event('scroll'));
    animationFrames.splice(0).forEach((callback) => callback(48));
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-fusion')).toBe('docked');
    expect(nav.attributes('data-nav-density')).toBe('expanding');
    expect(nav.attributes('data-nav-labels')).toBe('hidden');

    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-density')).toBe('regular');
    expect(nav.attributes('data-nav-labels')).toBe('showing');

    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-fusion')).toBe('idle');
    expect(nav.attributes('data-nav-restoring')).toBe('true');
    expect(nav.attributes('data-nav-compact')).toBeUndefined();
    expect(nav.attributes('data-nav-labels')).toBe('visible');
    expect(wrapper.get('.journal-shell').attributes('style')).toContain('--nav-restore-y: 0.00px;');
    animationFrames.splice(0).forEach((callback) => callback(64));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.journal-shell').attributes('style')).toContain('--nav-restore-y: 132.00px;');

    vi.advanceTimersByTime(260);
    await wrapper.vm.$nextTick();

    expect(nav.attributes('data-nav-restoring')).toBeUndefined();
    expect(wrapper.get('.journal-shell').attributes('style')).toContain('--nav-restore-y: 0.00px;');
    expect(wrapper.get('.journal-shell').attributes('style')).toContain('--nav-fusion-left: 40.00px;');
    expect(wrapper.get('.journal-shell').attributes('style')).toContain('--nav-fusion-width: 910.00px;');
    expect(wrapper.get('a[href="/album"]').classes()).toContain('journal-nav__link--home');
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
