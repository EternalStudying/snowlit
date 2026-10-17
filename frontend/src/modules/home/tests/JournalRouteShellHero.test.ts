import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import JournalRouteShell from '../JournalRouteShell.vue';
import { routes } from '../../../router';
import { resetHomeLifecycleForTests } from '../internal/useHomeLifecycle';
import { homeOverviewFixture } from './support/homeOverviewFixture';

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

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value });
}

async function mountShell() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push('/');
  await router.isReady();

  const wrapper = mount(JournalRouteShell, {
    attachTo: document.body,
    global: { plugins: [router] },
    slots: { default: '<main>首页内容</main>' }
  });
  await flushPromises();

  return wrapper;
}

async function expandHero(wrapper: Awaited<ReturnType<typeof mountShell>>) {
  wheel(-900);
  await wrapper.vm.$nextTick();
}

function wheel(deltaY: number) {
  const event = new WheelEvent('wheel', {
    deltaY,
    bubbles: true,
    cancelable: true
  });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetHomeLifecycleForTests();
  vi.stubGlobal('fetch', mockHomeShellFetch());
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  );
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }
  });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: vi.fn() });
  document.body.innerHTML = '<header class="app-topbar"></header>';
  const topbar = document.querySelector<HTMLElement>('.app-topbar');
  vi.spyOn(topbar!, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 58, height: 58 }));
  setScrollY(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetHomeLifecycleForTests();
  document.body.innerHTML = '';
});

describe('首页首屏雪坡扩散', () => {
  it('页面顶部小幅向上滚动只累计意图，不提前拖动首屏', async () => {
    const wrapper = await mountShell();

    const event = wheel(-80);
    await wrapper.vm.$nextTick();

    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.attributes('data-hero-immersive')).toBe('false');
    expect(wrapper.attributes('data-hero-expanded')).toBe('false');
    expect(wrapper.attributes('style')).toContain('--hero-expansion-progress: 0.0000');
    expect(wrapper.attributes('style')).toContain('--hero-snow-opacity: 1.0000');
  });

  it('页面顶部向上滚动达到缩小后的蓄力阈值后进入全屏驻留态并隐藏导航', async () => {
    const wrapper = await mountShell();

    const event = wheel(-240);
    await wrapper.vm.$nextTick();

    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.attributes('data-hero-immersive')).toBe('true');
    expect(wrapper.attributes('data-hero-expanded')).toBe('true');
    expect(wrapper.get('.home-cozy-nav').classes()).toContain('is-hero-hidden');
    expect(wrapper.attributes('style')).toContain('--hero-expansion-progress: 1.0000');
    expect(wrapper.attributes('style')).toContain('--hero-snow-opacity: 0.0000');
  });

  it('驻留态向下滚动会退出，并在恢复动画结束前继续锁住页面滚动', async () => {
    const wrapper = await mountShell();

    wheel(-900);
    await wrapper.vm.$nextTick();
    const exitEvent = wheel(180);
    await wrapper.vm.$nextTick();

    expect(exitEvent.defaultPrevented).toBe(true);
    expect(wrapper.attributes('data-hero-immersive')).toBe('true');
    expect(wrapper.attributes('data-hero-expanded')).toBe('false');
    expect(wrapper.get('.home-cozy-nav').classes()).toContain('is-hero-hidden');
    expect(wrapper.attributes('style')).toContain('--hero-expansion-progress: 0.0000');
    expect(wrapper.attributes('style')).toContain('--hero-snow-opacity: 1.0000');

    const lockedEvent = wheel(180);
    await wrapper.vm.$nextTick();
    expect(lockedEvent.defaultPrevented).toBe(true);
    expect(wrapper.attributes('data-hero-immersive')).toBe('true');

    vi.advanceTimersByTime(560);
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('data-hero-immersive')).toBe('false');
    expect(wrapper.get('.home-cozy-nav').classes()).not.toContain('is-hero-hidden');

    const releasedEvent = wheel(180);
    await wrapper.vm.$nextTick();
    expect(releasedEvent.defaultPrevented).toBe(false);
  });

  it('离开页面顶部时不拦截普通向上滚动', async () => {
    const wrapper = await mountShell();
    setScrollY(120);

    const event = wheel(-900);
    await wrapper.vm.$nextTick();

    expect(event.defaultPrevented).toBe(false);
    expect(wrapper.attributes('data-hero-immersive')).toBe('false');
    expect(wrapper.attributes('data-hero-expanded')).toBe('false');
  });

  it('全屏驻留态支持左右箭头和底部圆点手动切图', async () => {
    const wrapper = await mountShell();
    wheel(-900);
    await wrapper.vm.$nextTick();

    const firstActiveSrc = wrapper.get('.home-hero-slide.is-active img').attributes('src');

    await wrapper.get('.home-hero-arrow--next').trigger('click');
    await wrapper.vm.$nextTick();
    const nextActiveSrc = wrapper.get('.home-hero-slide.is-active img').attributes('src');
    expect(nextActiveSrc).not.toBe(firstActiveSrc);

    await wrapper.get('.home-hero-arrow--prev').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.home-hero-slide.is-active img').attributes('src')).toBe(firstActiveSrc);

    const dots = wrapper.findAll('.home-hero-dot');
    expect(dots.length).toBeGreaterThan(1);
    await dots[1].trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.home-hero-slide.is-active img').attributes('src')).toBe(nextActiveSrc);
    expect(wrapper.get('.home-hero-arrow--next .home-hero-arrow__glyph').text()).toBe('');
  });

  it('全屏驻留态暂停自动轮播', async () => {
    const wrapper = await mountShell();
    wheel(-900);
    await wrapper.vm.$nextTick();

    const activeBeforeTimer = wrapper.get('.home-hero-slide.is-active img').attributes('src');
    vi.advanceTimersByTime(5100);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.home-hero-slide.is-active img').attributes('src')).toBe(activeBeforeTimer);
  });

  it('普通态不启用头像与爱心互动', async () => {
    const wrapper = await mountShell();
    const cluster = wrapper.get('.hero-sticker-cluster');
    const leftSticker = wrapper.get('.hero-person-sticker--left');

    await leftSticker.trigger('mouseenter');
    await leftSticker.trigger('click');
    await wrapper.vm.$nextTick();

    expect(cluster.attributes('data-heart-target')).toBe('none');
    expect(leftSticker.attributes('aria-disabled')).toBe('true');
    expect(leftSticker.attributes('tabindex')).toBe('-1');
    expect(wrapper.findAll('.hero-heart-burst-particle')).toHaveLength(0);
    expect(cluster.attributes('data-hero-heart-beating')).toBeUndefined();
  });

  it('放大态 hover 和 focus 头像时牵引中心爱心方向', async () => {
    const wrapper = await mountShell();
    await expandHero(wrapper);

    const cluster = wrapper.get('.hero-sticker-cluster');
    const leftSticker = wrapper.get('.hero-person-sticker--left');
    const rightSticker = wrapper.get('.hero-person-sticker--right');

    expect(leftSticker.attributes('aria-disabled')).toBe('false');
    expect(leftSticker.attributes('tabindex')).toBe('0');

    await leftSticker.trigger('mouseenter');
    expect(cluster.attributes('data-heart-target')).toBe('left');

    await leftSticker.trigger('mouseleave');
    expect(cluster.attributes('data-heart-target')).toBe('none');

    await rightSticker.trigger('focus');
    expect(cluster.attributes('data-heart-target')).toBe('right');

    await rightSticker.trigger('blur');
    expect(cluster.attributes('data-heart-target')).toBe('none');
  });

  it('点击头像生成飞向爱心的临时粒子并在动画后清理', async () => {
    const wrapper = await mountShell();
    await expandHero(wrapper);

    const cluster = wrapper.get('.hero-sticker-cluster');
    await wrapper.get('.hero-person-sticker--left').trigger('click');
    await wrapper.vm.$nextTick();

    expect(cluster.attributes('data-heart-target')).toBe('left');
    expect(cluster.attributes('data-hero-heart-beating')).toBe('true');
    expect(wrapper.findAll('.hero-heart-burst-particle').length).toBeGreaterThanOrEqual(3);
    expect(wrapper.findAll('.hero-heart-burst-particle').length).toBeLessThanOrEqual(5);

    vi.advanceTimersByTime(900);
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.hero-heart-burst-particle')).toHaveLength(0);
    expect(cluster.attributes('data-hero-heart-beating')).toBeUndefined();
  });

  it('2 秒内左右头像都被点击时触发并清理合拍彩蛋', async () => {
    const wrapper = await mountShell();
    await expandHero(wrapper);

    const cluster = wrapper.get('.hero-sticker-cluster');
    await wrapper.get('.hero-person-sticker--left').trigger('click');
    vi.advanceTimersByTime(1000);
    await wrapper.get('.hero-person-sticker--right').trigger('click');
    await wrapper.vm.$nextTick();

    expect(cluster.attributes('data-hero-sync-pulse')).toBe('true');

    vi.advanceTimersByTime(700);
    await wrapper.vm.$nextTick();
    expect(cluster.attributes('data-hero-sync-pulse')).toBeUndefined();
  });

  it('退出放大态后清理头像互动状态和粒子', async () => {
    const wrapper = await mountShell();
    await expandHero(wrapper);

    await wrapper.get('.hero-person-sticker--left').trigger('mouseenter');
    await wrapper.get('.hero-person-sticker--left').trigger('click');
    await wrapper.vm.$nextTick();

    wheel(180);
    await wrapper.vm.$nextTick();

    const cluster = wrapper.get('.hero-sticker-cluster');
    expect(cluster.attributes('data-heart-target')).toBe('none');
    expect(cluster.attributes('data-hero-heart-beating')).toBeUndefined();
    expect(cluster.attributes('data-hero-sync-pulse')).toBeUndefined();
    expect(wrapper.findAll('.hero-heart-burst-particle')).toHaveLength(0);
  });

  it('减少动态时关闭持续动画、飞行粒子和合拍扩散', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as unknown as MediaQueryList);
    const wrapper = await mountShell();
    await expandHero(wrapper);

    const cluster = wrapper.get('.hero-sticker-cluster');
    await wrapper.get('.hero-person-sticker--left').trigger('click');
    await wrapper.get('.hero-person-sticker--right').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.hero-heart-burst-particle')).toHaveLength(0);
    expect(cluster.attributes('data-hero-heart-beating')).toBeUndefined();
    expect(cluster.attributes('data-hero-sync-pulse')).toBeUndefined();
  });
});
