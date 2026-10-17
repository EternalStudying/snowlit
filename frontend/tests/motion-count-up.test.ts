import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MotionCountUp from '../src/components/motion/MotionCountUp.vue';

type ObservedEntry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;
  observedElement?: Element;
  observe = vi.fn((element: Element) => {
    this.observedElement = element;
  });
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  enterView() {
    const entry: ObservedEntry = {
      isIntersecting: true,
      target: this.observedElement ?? document.createElement('span')
    };

    this.callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

describe('MotionCountUp', () => {
  let rafCallbacks: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    rafCallbacks = [];
    now = 0;

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('waits until visible before starting the number animation', async () => {
    const wrapper = mount(MotionCountUp, {
      props: {
        value: 100,
        enabled: true,
        duration: 1000
      }
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('0');
    expect(rafCallbacks).toHaveLength(0);

    MockIntersectionObserver.instances[0].enterView();
    await wrapper.vm.$nextTick();
    expect(rafCallbacks).toHaveLength(1);

    now = 500;
    rafCallbacks.shift()?.(now);
    await wrapper.vm.$nextTick();

    expect(Number(wrapper.text())).toBeGreaterThan(0);
    expect(Number(wrapper.text())).toBeLessThan(100);

    now = 1000;
    rafCallbacks.shift()?.(now);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('100');
  });

  it('can wait for a parent module before starting the number animation', async () => {
    const wrapper = mount(MotionCountUp, {
      props: {
        value: 100,
        enabled: true,
        start: false,
        duration: 1000
      }
    });
    await wrapper.vm.$nextTick();

    MockIntersectionObserver.instances[0].enterView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('0');
    expect(rafCallbacks).toHaveLength(0);

    await wrapper.setProps({ start: true });

    expect(rafCallbacks).toHaveLength(1);
  });
});
