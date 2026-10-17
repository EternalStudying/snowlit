import { gsap } from 'gsap';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { scrollToWithSmoothScroll } from '../../../composables/useSmoothScroll';

export interface StoryRouteOrigin {
  fullPath: string;
  scrollX: number;
  scrollY: number;
  triggerRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  enteredAt: number;
}

interface StoryEnterTransitionOptions {
  trigger: HTMLElement;
  router: Router;
  route: RouteLocationNormalizedLoaded;
  reducedMotion?: boolean;
}

interface StoryExitTransitionOptions {
  router: Router;
  root?: HTMLElement | null;
  reducedMotion?: boolean;
}

const STORY_ROUTE_ENTER_DURATION = 0.82;
const STORY_ROUTE_ENTER_SOLID_BLACK_AT = 0.38;
const STORY_ROUTE_AFTER_ENTER_HOLD_MS = 140;
const STORY_ROUTE_EXIT_COVER_DURATION = 0.48;
const STORY_ROUTE_EXIT_TARGETS_DURATION = 0.3;
const STORY_ROUTE_EXIT_ROUTE_SETTLE_MS = 360;
const STORY_ROUTE_EXIT_SCROLL_RESTORE_DELAY_MS = 110;
const STORY_ROUTE_EXIT_REVEAL_DURATION = 0.62;
const STORY_ROUTE_EXIT_SCROLL_DRIFT_PX = 2;

let storyRouteOrigin: StoryRouteOrigin | null = null;
let activeTransitionPromise: Promise<void> | null = null;
let activeTransitionLayer: HTMLElement | null = null;
let activeTransitionTimeline: gsap.core.Timeline | gsap.core.Tween | null = null;

export function playStoryEnterTransition(options: StoryEnterTransitionOptions) {
  if (activeTransitionPromise) {
    return activeTransitionPromise;
  }

  activeTransitionPromise = runStoryEnterTransition(options).finally(() => {
    activeTransitionPromise = null;
  });

  return activeTransitionPromise;
}

export function playStoryExitTransition(options: StoryExitTransitionOptions) {
  if (activeTransitionPromise) {
    return activeTransitionPromise;
  }

  activeTransitionPromise = runStoryExitTransition(options).finally(() => {
    activeTransitionPromise = null;
  });

  return activeTransitionPromise;
}

export function setStoryRouteOriginForTests(origin: StoryRouteOrigin) {
  storyRouteOrigin = origin;
}

export function clearStoryRouteOriginForTests() {
  storyRouteOrigin = null;
  cleanupStoryRouteTransition();
}

async function runStoryEnterTransition({ trigger, router, route, reducedMotion = false }: StoryEnterTransitionOptions) {
  if (route.path === '/story') {
    return;
  }

  const routeReady = preloadRoute(router, '/story');
  storyRouteOrigin = createOrigin(route, trigger);
  const layer = createStoryRouteTransitionLayer(trigger);

  try {
    document.body.appendChild(layer.root);
    activeTransitionLayer = layer.root;

    if (reducedMotion) {
      layer.root.classList.add('story-route-transition--covered');
      layer.root.style.opacity = '1';
      layer.root.style.visibility = 'visible';
      await wait(130);
      await routeReady;
      await pushRoute(router, '/story');
      await wait(80);
      cleanupStoryRouteTransition();
      return;
    }

    await playEnterMotion(layer.root, layer.blackout, layer.finalScale);
    await routeReady;
    await pushRoute(router, '/story');
    await wait(STORY_ROUTE_AFTER_ENTER_HOLD_MS);
    cleanupStoryRouteTransition();
  } catch {
    cleanupStoryRouteTransition();
    await pushRoute(router, '/story');
  }
}

async function runStoryExitTransition({ router, root, reducedMotion = false }: StoryExitTransitionOptions) {
  const origin = resolveStoryRouteOrigin();
  const routeReady = preloadRoute(router, origin.fullPath);
  const layer = createStoryRouteTransitionLayerFromOrigin(origin);

  try {
    document.body.appendChild(layer.root);
    activeTransitionLayer = layer.root;

    if (reducedMotion) {
      layer.root.style.opacity = '1';
      layer.root.style.visibility = 'visible';
      await wait(80);
      await routeReady;
      await pushRoute(router, origin.fullPath);
      await wait(80);
      restoreOriginScroll(origin);
      scheduleOriginScrollRestore(origin);
      cleanupStoryRouteTransition();
      storyRouteOrigin = null;
      return;
    }

    await playExitCoverMotion(layer.root, root ?? null);
    await routeReady;
    await pushRoute(router, origin.fullPath);
    await wait(STORY_ROUTE_EXIT_ROUTE_SETTLE_MS);
    restoreOriginScroll(origin);
    await wait(STORY_ROUTE_EXIT_SCROLL_RESTORE_DELAY_MS);
    restoreOriginScrollIfNeeded(origin);
    await playExitRevealMotion(layer.root, origin);
    scheduleOriginScrollRestore(origin);
    cleanupStoryRouteTransition();
    storyRouteOrigin = null;
  } catch {
    cleanupStoryRouteTransition();
    storyRouteOrigin = null;
    await pushRoute(router, origin.fullPath);
    await wait(0);
    restoreOriginScroll(origin);
  }
}

function createOrigin(route: RouteLocationNormalizedLoaded, trigger: HTMLElement): StoryRouteOrigin {
  const rect = trigger.getBoundingClientRect();

  return {
    fullPath: route.fullPath || '/',
    scrollX: getScrollX(),
    scrollY: getScrollY(),
    triggerRect: {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    },
    enteredAt: Date.now()
  };
}

function resolveStoryRouteOrigin(): StoryRouteOrigin {
  if (storyRouteOrigin?.fullPath && !storyRouteOrigin.fullPath.startsWith('/story')) {
    return storyRouteOrigin;
  }

  return {
    fullPath: '/',
    scrollX: 0,
    scrollY: 0,
    enteredAt: Date.now()
  };
}

function createStoryRouteTransitionLayer(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  const centerX = rect.left + rect.width / 2 || viewportWidth / 2;
  const centerY = rect.top + rect.height / 2 || viewportHeight / 2;
  const initialSize = Math.max(rect.width, rect.height, 48);
  const farthestX = Math.max(centerX, viewportWidth - centerX);
  const farthestY = Math.max(centerY, viewportHeight - centerY);
  const finalScale = (Math.hypot(farthestX, farthestY) * 2 + 96) / initialSize;

  return createLayer(centerX, centerY, initialSize, finalScale, 'story-route-transition--enter');
}

function createStoryRouteTransitionLayerFromOrigin(origin: StoryRouteOrigin) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  const rect = origin.triggerRect;
  const centerX = rect ? rect.x + rect.width / 2 : viewportWidth / 2;
  const centerY = rect ? rect.y + rect.height / 2 : viewportHeight / 2;
  const initialSize = rect ? Math.max(rect.width, rect.height, 48) : 72;
  const farthestX = Math.max(centerX, viewportWidth - centerX);
  const farthestY = Math.max(centerY, viewportHeight - centerY);
  const finalScale = (Math.hypot(farthestX, farthestY) * 2 + 96) / initialSize;

  return createLayer(centerX, centerY, initialSize, finalScale, 'story-route-transition--exit');
}

function createLayer(centerX: number, centerY: number, initialSize: number, finalScale: number, modeClass: string) {
  const root = document.createElement('div');
  root.className = `story-route-transition ${modeClass}`;
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--story-route-x', `${centerX.toFixed(2)}px`);
  root.style.setProperty('--story-route-y', `${centerY.toFixed(2)}px`);
  root.style.setProperty('--story-route-size', `${initialSize.toFixed(2)}px`);

  root.innerHTML = `
    <div class="story-route-transition__blackout"></div>
  `;

  const blackout = root.querySelector<HTMLElement>('.story-route-transition__blackout');
  if (!blackout) {
    throw new Error('Story route transition layer was not created');
  }

  return { root, blackout, finalScale };
}

function playEnterMotion(root: HTMLElement, blackout: HTMLElement, finalScale: number) {
  return new Promise<void>((resolve) => {
    activeTransitionTimeline?.kill();
    activeTransitionTimeline = gsap.timeline({
      defaults: { ease: 'power3.inOut', overwrite: 'auto' },
      onComplete: resolve
    });

    activeTransitionTimeline
      .set(root, { autoAlpha: 1 })
      .fromTo(blackout, { scale: 0.18 }, { scale: finalScale, duration: STORY_ROUTE_ENTER_DURATION }, 0)
      .set(root, { backgroundColor: '#000' }, STORY_ROUTE_ENTER_SOLID_BLACK_AT);
  });
}

function playExitCoverMotion(root: HTMLElement, storyRoot: HTMLElement | null) {
  return new Promise<void>((resolve) => {
    activeTransitionTimeline?.kill();
    const storyTargets = storyRoot
      ? storyRoot.querySelectorAll<HTMLElement>(
          [
            '.story-status-badge',
            '.story-memory-entry',
            '.story-home-link',
            '.story-filter-panel',
            '.story-filter-trigger',
            '.story-add-button',
            '.story-timeline',
            '.moment-detail',
            '.moment-editor',
            '.story-delete-confirm',
            '.story-marker__visual'
          ].join(', ')
        )
      : [];

    activeTransitionTimeline = gsap.timeline({
      defaults: { ease: 'power3.out', overwrite: 'auto' },
      onComplete: resolve
    });

    activeTransitionTimeline
      .set(root, { autoAlpha: 1, backgroundColor: '#000' })
      .fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: STORY_ROUTE_EXIT_COVER_DURATION, ease: 'power2.inOut' }, 0);

    if (storyTargets.length) {
      activeTransitionTimeline.to(
        storyTargets,
        {
          autoAlpha: 0,
          y: -5,
          scale: 0.985,
          duration: STORY_ROUTE_EXIT_TARGETS_DURATION,
          stagger: { each: 0.012, from: 'end' }
        },
        0
      );
    }
  });
}

function playExitRevealMotion(root: HTMLElement, origin: StoryRouteOrigin) {
  return new Promise<void>((resolve) => {
    const point = getOriginCenter(origin);
    activeTransitionTimeline?.kill();
    activeTransitionTimeline = gsap.fromTo(
      root,
      { clipPath: `circle(150% at ${point.x}px ${point.y}px)`, autoAlpha: 1 },
      {
        clipPath: `circle(0% at ${point.x}px ${point.y}px)`,
        duration: STORY_ROUTE_EXIT_REVEAL_DURATION,
        ease: 'power3.inOut',
        overwrite: 'auto',
        onComplete: resolve
      }
    );
  });
}

function getOriginCenter(origin: StoryRouteOrigin) {
  if (!origin.triggerRect) {
    return {
      x: (window.innerWidth || document.documentElement.clientWidth || 1) / 2,
      y: (window.innerHeight || document.documentElement.clientHeight || 1) / 2
    };
  }

  return {
    x: origin.triggerRect.x + origin.triggerRect.width / 2,
    y: origin.triggerRect.y + origin.triggerRect.height / 2
  };
}

async function pushRoute(router: Router, path: string) {
  await router.push(path).catch(() => undefined);
}

async function preloadRoute(router: Router, path: string) {
  const loaders = router
    .resolve(path)
    .matched
    .flatMap(({ components }) => Object.values(components ?? {}))
    .filter((component): component is () => unknown => typeof component === 'function');

  await Promise.all(
    loaders.map((loadRoute) => Promise.resolve(loadRoute()).catch(() => undefined))
  );
}

function restoreOriginScroll(origin: StoryRouteOrigin) {
  scrollToWithSmoothScroll(origin.scrollY, origin.scrollX);
}

function restoreOriginScrollIfNeeded(origin: StoryRouteOrigin) {
  const isScrollStable =
    Math.abs(getScrollY() - origin.scrollY) <= STORY_ROUTE_EXIT_SCROLL_DRIFT_PX &&
    Math.abs(getScrollX() - origin.scrollX) <= STORY_ROUTE_EXIT_SCROLL_DRIFT_PX;

  if (isScrollStable) {
    return;
  }

  restoreOriginScroll(origin);
}

function scheduleOriginScrollRestore(origin: StoryRouteOrigin) {
  [180, 480].forEach((delay) => {
    window.setTimeout(() => restoreOriginScrollIfNeeded(origin), delay);
  });
}

function cleanupStoryRouteTransition() {
  activeTransitionTimeline?.kill();
  activeTransitionTimeline = null;
  activeTransitionLayer?.remove();
  activeTransitionLayer = null;
}

function getScrollX() {
  return window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0;
}

function getScrollY() {
  return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
}

function wait(duration: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });
}
