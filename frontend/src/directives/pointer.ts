import type { Directive } from 'vue';
import { shouldSkipMotion } from '../motion';
import { EASE_LIFT, gsap, hasFinePointer } from '../motionKit';

type Cleanup = () => void;
const cleanups = new WeakMap<HTMLElement, Cleanup>();

function enabled() {
  return !shouldSkipMotion() && hasFinePointer();
}

/**
 * Cards you can open lean toward the pointer, and a lamplight glow follows it across the surface
 * (via --lamp-x / --lamp-y, read by the .lamp-glow class). Pass a number to change the maximum tilt in degrees.
 */
export const vTilt: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (!enabled()) {
      return;
    }
    const max = binding.value ?? 5;
    gsap.set(el, { transformPerspective: 900, transformStyle: 'preserve-3d' });
    const toRotateX = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const toRotateY = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const toLift = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });

    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      toRotateY((x - 0.5) * max * 2);
      toRotateX((0.5 - y) * max * 2);
      toLift(-4);
      el.style.setProperty('--lamp-x', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--lamp-y', `${(y * 100).toFixed(1)}%`);
    };
    const enter = () => el.classList.add('is-lamp-lit');
    const leave = () => {
      el.classList.remove('is-lamp-lit');
      gsap.to(el, { rotationX: 0, rotationY: 0, y: 0, duration: 0.9, ease: EASE_LIFT, overwrite: 'auto' });
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    cleanups.set(el, () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'transform,transformPerspective,transformStyle' });
    });
  },
  beforeUnmount(el) {
    cleanups.get(el)?.();
    cleanups.delete(el);
  }
};

/** Buttons lean a little toward a nearby pointer and spring back when it leaves. Value: pull strength (0–1). */
export const vMagnetic: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (!enabled()) {
      return;
    }
    const strength = binding.value ?? 0.3;
    const toX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const toY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });

    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      toX((event.clientX - (rect.left + rect.width / 2)) * strength);
      toY((event.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: EASE_LIFT, overwrite: 'auto' });

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    cleanups.set(el, () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'x,y' });
    });
  },
  beforeUnmount(el) {
    cleanups.get(el)?.();
    cleanups.delete(el);
  }
};
