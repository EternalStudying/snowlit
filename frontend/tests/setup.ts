import { vi } from 'vitest';
import { setInstantMotion } from '../src/motion';

// Tests check end states, not choreography.
setInstantMotion(true);

// jsdom has no matchMedia; GSAP's ScrollTrigger reads it when it registers at import time. Tests that care
// about media queries still stub their own.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    })
  });
}

// Register the GSAP plugins now, against jsdom's own requestAnimationFrame, then switch ScrollTrigger off.
// Left on, it keeps a requestAnimationFrame loop alive: tests that stub requestAnimationFrame synchronously
// recurse forever, and fake-timer tests that advance minutes spend them running that loop.
const { ScrollTrigger } = await import('../src/motionKit');
ScrollTrigger.disable();

URL.createObjectURL = vi.fn(() => 'blob:fixture-photo');
URL.revokeObjectURL = vi.fn();
