import { prefersReducedMotion, useReducedMotion } from '../motion';
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type SmoothScrollRouteGetter = () => string;

interface ScrollToWithSmoothScrollOptions {
  immediate?: boolean;
  behavior?: ScrollBehavior;
  duration?: number;
}

const SMOOTH_SCROLL_PREVENT_SELECTOR = [
  '[data-lenis-prevent]',
  '[data-smooth-scroll-prevent]',
  '[role="dialog"]',
  'input',
  'select',
  'textarea',
  '.story-map-page',
  '.story-map-canvas',
  '.story-map-canvas__surface',
  '.amap-container',
  '.amap-layers',
  '.amap-marker',
  '.album-immersive-gallery',
  '.moment-detail',
  '.moment-editor',
  '.moment-image-viewer',
  '.story-delete-confirm',
  '.story-map-group-popover'
].join(', ');
const NAIVE_MODAL_CONTAINER_SELECTOR = '.n-modal-container';
const NAIVE_MODAL_CONTENT_PREVENT_SELECTOR = '[data-smooth-scroll-prevent], [role="dialog"]';

let smoothScrollInstance: Lenis | null = null;
let smoothScrollTicker: ((time: number) => void) | null = null;
let refreshFrame: number | null = null;

export function useSmoothScroll(routePath?: SmoothScrollRouteGetter) {
  useReducedMotion((reduced) => {
    if (reduced) {
      destroySmoothScrollInstance();
      return;
    }
    startSmoothScroll();
    scheduleSmoothScrollRefresh();
  });

  onMounted(() => {
    startSmoothScroll();
    scheduleSmoothScrollRefresh();
  });

  if (routePath) {
    watch(
      routePath,
      async () => {
        await nextTick();
        scheduleSmoothScrollRefresh();
      },
      { flush: 'post' }
    );
  }

  onBeforeUnmount(() => {
    destroySmoothScroll();
  });
}

export function scrollToWithSmoothScroll(top: number, left = 0, options: ScrollToWithSmoothScrollOptions = {}) {
  if (smoothScrollInstance) {
    smoothScrollInstance.scrollTo(top, {
      immediate: options.immediate ?? true,
      force: true,
      ...(options.duration !== undefined ? { duration: options.duration } : {})
    });
    return;
  }

  if (options.behavior) {
    const target: ScrollToOptions = {
      top,
      behavior: options.behavior
    };
    if (left !== 0) {
      target.left = left;
    }
    window.scrollTo(target);
    return;
  }

  window.scrollTo(left, top);
}

export function getSmoothScrollInstanceForTests() {
  return smoothScrollInstance;
}

export function destroySmoothScrollForTests() {
  destroySmoothScroll();
}

function startSmoothScroll() {
  if (!canUseSmoothScroll()) {
    return null;
  }

  if (prefersReducedMotion()) {
    destroySmoothScrollInstance();
    return null;
  }

  if (smoothScrollInstance) {
    return smoothScrollInstance;
  }

  smoothScrollInstance = new Lenis({
    smoothWheel: true,
    syncTouch: true,
    duration: 1.05,
    wheelMultiplier: 0.86,
    touchMultiplier: 1.1,
    easing: (time) => 1 - Math.pow(1 - time, 3),
    prevent: shouldPreventSmoothScroll
  });
  smoothScrollInstance.on('scroll', ScrollTrigger.update);
  smoothScrollTicker = (time: number) => smoothScrollInstance?.raf(time * 1000);
  gsap.ticker.add(smoothScrollTicker);
  gsap.ticker.lagSmoothing(0);

  return smoothScrollInstance;
}

function destroySmoothScroll() {
  destroySmoothScrollInstance();
  if (refreshFrame !== null) {
    window.cancelAnimationFrame(refreshFrame);
    refreshFrame = null;
  }
}

function destroySmoothScrollInstance() {
  if (smoothScrollTicker) {
    gsap.ticker.remove(smoothScrollTicker);
    smoothScrollTicker = null;
  }
  smoothScrollInstance?.destroy();
  smoothScrollInstance = null;
}

function scheduleSmoothScrollRefresh() {
  if (!canUseSmoothScroll() || refreshFrame !== null) {
    return;
  }

  refreshFrame = window.requestAnimationFrame(() => {
    refreshFrame = null;
    smoothScrollInstance?.resize();
    ScrollTrigger.refresh();
  });
}

function shouldPreventSmoothScroll(node: HTMLElement) {
  const element = resolveElement(node);
  if (!element) {
    return false;
  }

  return (
    Boolean(element.closest(SMOOTH_SCROLL_PREVENT_SELECTOR)) ||
    isInsidePreventedNaiveModal(element) ||
    hasScrollableAncestor(element)
  );
}

function isInsidePreventedNaiveModal(element: Element) {
  const modalContainer = element.closest(NAIVE_MODAL_CONTAINER_SELECTOR);
  return Boolean(modalContainer?.querySelector(NAIVE_MODAL_CONTENT_PREVENT_SELECTOR));
}

function hasScrollableAncestor(element: Element) {
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    if (isLocallyScrollable(current as HTMLElement)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function isLocallyScrollable(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
  const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX);

  return (
    (canScrollY && element.scrollHeight > element.clientHeight + 1) ||
    (canScrollX && element.scrollWidth > element.clientWidth + 1)
  );
}

function resolveElement(node: unknown) {
  if (node instanceof Element) {
    return node;
  }
  if (node instanceof Node) {
    return node.parentElement;
  }
  return null;
}

function canUseSmoothScroll() {
  return typeof window.ResizeObserver === 'function';
}
