import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PointerEffects from '../src/components/PointerEffects.vue';

type MediaListener = (event: MediaQueryListEvent) => void;

function mockMatchMedia({ finePointer, reducedMotion }: { finePointer: boolean; reducedMotion: boolean }) {
  const listeners = new Map<string, Set<MediaListener>>();

  vi.stubGlobal('matchMedia', (query: string) => {
    const queryListeners = listeners.get(query) ?? new Set<MediaListener>();
    listeners.set(query, queryListeners);

    return {
      matches: query.includes('pointer: fine') ? finePointer : query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: (_event: 'change', listener: MediaListener) => queryListeners.add(listener),
      removeEventListener: (_event: 'change', listener: MediaListener) => queryListeners.delete(listener),
      addListener: (listener: MediaListener) => queryListeners.add(listener),
      removeListener: (listener: MediaListener) => queryListeners.delete(listener),
      dispatchEvent: () => true
    } as unknown as MediaQueryList;
  });
}

describe('PointerEffects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('generates click hearts and throttled trail particles on fine pointer devices', async () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });
    const wrapper = mount(PointerEffects);

    window.dispatchEvent(new MouseEvent('pointerdown', { clientX: 120, clientY: 80 }));
    await wrapper.vm.$nextTick();

    const hearts = wrapper.findAll('.pointer-heart');
    expect(hearts.length).toBeGreaterThanOrEqual(3);
    expect(hearts.length).toBeLessThanOrEqual(5);

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 130, clientY: 90 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.pointer-trail')).toHaveLength(1);

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 132, clientY: 92 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.pointer-trail')).toHaveLength(1);
  });

  it('does not generate particles when reduced motion is requested', async () => {
    mockMatchMedia({ finePointer: true, reducedMotion: true });
    const wrapper = mount(PointerEffects);

    window.dispatchEvent(new MouseEvent('pointerdown', { clientX: 120, clientY: 80 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 130, clientY: 90 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.pointer-heart')).toHaveLength(0);
    expect(wrapper.findAll('.pointer-trail')).toHaveLength(0);
  });

  it('limits trail particles to avoid DOM buildup', async () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });
    const wrapper = mount(PointerEffects);

    for (let index = 0; index < 80; index += 1) {
      vi.advanceTimersByTime(50);
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 + index, clientY: 100 }));
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.pointer-trail').length).toBeLessThanOrEqual(40);
  });
});
