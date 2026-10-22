import { shouldSkipMotion } from './motion';
import { EASE_SETTLE, gsap } from './motionKit';

const FLAKE =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
  '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/></svg>';

type SparkTone = 'camellia' | 'lamp' | 'pine';

/**
 * A small burst of snowflakes from a point: the confirmation for a save, publish or completion that succeeded.
 * Adapted from React Bits' ClickSpark. Does nothing when motion is skipped.
 */
export function sparkAt(x: number, y: number, tone: SparkTone = 'lamp', count = 10) {
  if (shouldSkipMotion() || typeof document === 'undefined') {
    return;
  }
  const layer = document.createElement('div');
  layer.className = 'snow-spark';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;z-index:9000;pointer-events:none;color:var(--${tone})`;

  const flakes = Array.from({ length: count }, () => {
    const flake = document.createElement('span');
    const size = gsap.utils.random(9, 16);
    flake.style.cssText = `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px`;
    flake.innerHTML = FLAKE;
    layer.appendChild(flake);
    return flake;
  });
  document.body.appendChild(layer);

  const timeline = gsap.timeline({ onComplete: () => layer.remove() });
  flakes.forEach((flake, index) => {
    const angle = (index / count) * Math.PI * 2 + gsap.utils.random(-0.25, 0.25);
    const distance = gsap.utils.random(34, 70);
    timeline.fromTo(
      flake,
      { x: 0, y: 0, scale: 0.4, rotate: 0, autoAlpha: 1 },
      {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance + 10,
        scale: 1,
        rotate: gsap.utils.random(-120, 120),
        autoAlpha: 0,
        duration: gsap.utils.random(0.7, 1),
        ease: EASE_SETTLE
      },
      0
    );
  });
}

/** Burst from the centre of an element (the button that was pressed). */
export function sparkFrom(element: Element | null | undefined, tone?: SparkTone) {
  if (!element) {
    return;
  }
  const rect = element.getBoundingClientRect();
  sparkAt(rect.left + rect.width / 2, rect.top + rect.height / 2, tone);
}
