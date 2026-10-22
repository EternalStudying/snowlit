import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Draggable } from 'gsap/Draggable';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Flip } from 'gsap/Flip';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { shouldSkipMotion } from './motion';

/*
 * The shared motion vocabulary. Every plugin is registered here once; pages import what they need from this
 * module instead of registering their own. All helpers return immediately (leaving content in its end state)
 * when motion should be skipped: reduced motion, or the test runner's instant mode.
 */
gsap.registerPlugin(ScrollTrigger, SplitText, Flip, DrawSVGPlugin, MorphSVGPlugin, CustomEase);

let draggableReady = false;

/**
 * Draggable reads the user agent when it registers, so it (and Inertia) register on first use rather than at
 * import: pages that never throw anything never pay for it.
 */
export function useThrowables() {
  if (!draggableReady) {
    gsap.registerPlugin(Draggable, InertiaPlugin);
    draggableReady = true;
  }
  return { Draggable, InertiaPlugin };
}

/** Things arriving: a soft landing with no overshoot. */
export const EASE_SETTLE = CustomEase.create('snowlit-settle', 'M0,0 C0.14,0.86 0.26,1 1,1');
/** Things picked up or released: a small lift past the target, then rest. */
export const EASE_LIFT = CustomEase.create('snowlit-lift', 'M0,0 C0.22,0.9 0.32,1.08 0.56,1.04 0.74,1.01 0.86,1 1,1');

export { gsap, ScrollTrigger, SplitText, Flip, DrawSVGPlugin, MorphSVGPlugin };

/** True when the pointer can hover precisely (pointer tilt, magnetic controls). */
export function hasFinePointer() {
  return Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);
}

/**
 * Raise a title one character at a time from behind its own mask. Chinese titles have no word spaces,
 * so characters (not lines) are the unit. Returns the split so a gsap.context() can revert it.
 */
export function revealTitle(target: Element | null, delay = 0) {
  if (!target || shouldSkipMotion()) {
    return null;
  }
  return SplitText.create(target, {
    type: 'chars',
    mask: 'chars',
    charsClass: 'title-char',
    onSplit(self) {
      return gsap.from(self.chars, {
        yPercent: 110,
        rotate: 6,
        duration: 0.9,
        delay,
        ease: EASE_SETTLE,
        stagger: 0.035
      });
    }
  });
}

/**
 * Let a group of cards settle into place as they scroll into view, one staggered landing per batch.
 * Cards stay visible when motion is skipped.
 */
export function settleOnScroll(targets: Element[] | string, scope?: Element | null) {
  if (shouldSkipMotion()) {
    return;
  }
  const elements = typeof targets === 'string'
    ? gsap.utils.toArray<Element>(targets, scope ?? undefined)
    : targets;
  if (!elements.length) {
    return;
  }
  gsap.set(elements, { autoAlpha: 0, y: 36, rotate: (index) => (index % 2 ? 0.8 : -0.8) });
  ScrollTrigger.batch(elements, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        rotate: 0,
        duration: 0.8,
        ease: EASE_SETTLE,
        stagger: 0.09,
        overwrite: true
      })
  });
}

/** Draw an SVG stroke from nothing; scrubbed to scroll when a trigger is given. */
export function drawStroke(target: Element | Element[] | null, vars: gsap.TweenVars = {}) {
  if (!target || shouldSkipMotion()) {
    return null;
  }
  return gsap.fromTo(target, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.2, ease: 'power2.inOut', ...vars });
}
