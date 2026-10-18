import { prefersReducedMotion } from '../motion';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref
} from 'vue';
import { useRoute } from 'vue-router';
import { scrollToWithSmoothScroll } from '../composables/useSmoothScroll';
import { preserveNextRouteScrollPosition } from '../navigation/routeScrollPolicy';

type NavFusionState = 'idle' | 'docked';
type NavLabelState = 'visible' | 'hiding' | 'hidden' | 'showing';
type NavDensityState =
  | 'regular'
  | 'compacting'
  | 'compact'
  | 'expanding';

interface JournalNavFusionOptions {
  isHeroImmersive: Readonly<Ref<boolean>>;
  requestMotionRevealCheck(): void;
}

const NAV_DOCKED_NAV_HEIGHT = 58;
const NAV_FUSION_EXIT_BUFFER = 12;
const NAV_LABEL_PHASE_MS = 200;
const NAV_DENSITY_PHASE_MS = 200;
const NAV_RESTORE_DROP_MS = 260;
const NAV_SWITCH_GLOW_MS = 340;
const NAV_ACTIVE_TRACK_SETTLE_FRAMES = 36;

export function useJournalNavFusion({
  isHeroImmersive,
  requestMotionRevealCheck
}: JournalNavFusionOptions) {
  const route = useRoute();
  const navAnchorRef = ref<HTMLElement | null>(null);
  const navRef = ref<HTMLElement | null>(null);
  const navContentRef = ref<HTMLElement | null>(null);
  const navFusionState = ref<NavFusionState>('idle');
  const navLabelState = ref<NavLabelState>('visible');
  const navDensityState = ref<NavDensityState>('regular');
  const navFusionProgress = ref(0);
  const navFusionTop = ref(0);
  const navFusionLeft = ref(0);
  const navFusionWidth = ref(0);
  const navRestoreY = ref(0);
  const isNavRestoring = ref(false);
  const navActiveX = ref(0);
  const navActiveWidth = ref(0);
  const navActiveOpacity = ref(0);
  const navSwitchGlowX = ref(0);
  const isNavSwitching = ref(false);
  const isNavActiveTrackSettling = ref(false);
  const reducedMotion = prefersReducedMotion();

  let navFusionFrame: number | undefined;
  let navLabelTimer: number | undefined;
  let navDensityTimer: number | undefined;
  let navRestoreFrame: number | undefined;
  let navRestoreTimer: number | undefined;
  let navRestoreSequence = 0;
  let pendingRouteContentScrollPath: string | null = null;
  let rememberedNavFusionEntryScrollTarget: number | null = null;
  let navSwitchTimer: number | undefined;
  let navActiveTrackSettleFrame: number | undefined;
  let navActiveTrackSettleFramesRemaining = 0;

  const navFusionCompactAttr = computed(() =>
    navDensityState.value === 'compacting' ||
    navDensityState.value === 'compact'
      ? 'true'
      : undefined
  );
  const navSwitchingAttr = computed(() =>
    isNavSwitching.value ? 'true' : undefined
  );
  const navActiveTrackSettlingAttr = computed(() =>
    isNavActiveTrackSettling.value ? 'true' : undefined
  );
  const navRestoringAttr = computed(() =>
    isNavRestoring.value ? 'true' : undefined
  );
  const style = computed(() => ({
    '--nav-fusion-progress': navFusionProgress.value.toFixed(4),
    '--nav-fusion-top': `${navFusionTop.value.toFixed(2)}px`,
    '--nav-fusion-left': `${navFusionLeft.value.toFixed(2)}px`,
    '--nav-fusion-width': `${navFusionWidth.value.toFixed(2)}px`,
    '--nav-restore-y': `${navRestoreY.value.toFixed(2)}px`,
    '--nav-active-x': `${navActiveX.value.toFixed(2)}px`,
    '--nav-active-width': `${navActiveWidth.value.toFixed(2)}px`,
    '--nav-active-opacity': navActiveOpacity.value.toFixed(0),
    '--nav-switch-glow-x': `${navSwitchGlowX.value.toFixed(2)}px`
  }));

  function getCurrentScrollY() {
    return (
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0
    );
  }

  function measureTopbarRect() {
    const topbar = document.querySelector<HTMLElement>('.app-topbar');

    return topbar?.getBoundingClientRect() ?? null;
  }

  function measureNavFusionEntryScrollTarget() {
    const anchor = navAnchorRef.value;
    const topbarRect = measureTopbarRect();
    if (!anchor || !topbarRect || topbarRect.height <= 0) {
      return null;
    }

    const anchorRect = anchor.getBoundingClientRect();
    if (anchorRect.width <= 0 || anchorRect.height <= 0) {
      return null;
    }

    const topbarCenterY = topbarRect.top + topbarRect.height / 2;
    const anchorCenterY = anchorRect.top + anchorRect.height / 2;

    return Math.max(
      0,
      getCurrentScrollY() + anchorCenterY - topbarCenterY
    );
  }

  function rememberNavFusionEntryScrollTarget(target: number | null) {
    if (target === null || target <= 1) {
      return;
    }

    rememberedNavFusionEntryScrollTarget = target;
  }

  function getNavFusionEntryScrollTarget() {
    const target = measureNavFusionEntryScrollTarget();
    rememberNavFusionEntryScrollTarget(target);

    if (target !== null && target > 1) {
      return target;
    }

    if (
      rememberedNavFusionEntryScrollTarget !== null &&
      target !== null &&
      target <= 1
    ) {
      return rememberedNavFusionEntryScrollTarget;
    }

    return target;
  }

  function scrollNavToFusionEntry() {
    const target = getNavFusionEntryScrollTarget();
    if (target === null) {
      requestMotionRevealCheck();
      return;
    }

    scrollToWithSmoothScroll(Math.ceil(target), 0, {
      immediate: reducedMotion,
      behavior: reducedMotion ? 'auto' : 'smooth',
      duration: reducedMotion ? 0 : 0.85
    });
    requestNavFusionUpdate();
    requestMotionRevealCheck();
  }

  function isPlainPrimaryClick(event: MouseEvent) {
    return (
      (event.button ?? 0) === 0 &&
      !event.metaKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    );
  }

  function handleCozyNavClick(
    targetPath: string,
    event: MouseEvent
  ) {
    if (!isPlainPrimaryClick(event)) {
      return;
    }

    if (targetPath === route.path) {
      event.preventDefault();
      nextTick(scrollNavToFusionEntry);
      return;
    }

    triggerNavSwitchGlow();
    preserveNextRouteScrollPosition();
    pendingRouteContentScrollPath = targetPath;
  }

  function handleCozyNavRootClick(event: MouseEvent) {
    if (!isPlainPrimaryClick(event)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest<HTMLAnchorElement>(
      '.home-cozy-nav__link[href]'
    );
    if (!link || !navRef.value?.contains(link)) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    handleCozyNavClick(
      new URL(href, window.location.href).pathname,
      event
    );
  }

  function updateNavActiveTrack() {
    const content = navContentRef.value;
    const activeLink = content?.querySelector<HTMLElement>(
      '.home-cozy-nav__link--home'
    );
    if (!content || !activeLink) {
      navActiveOpacity.value = 0;
      return;
    }

    const contentRect = content.getBoundingClientRect();
    const activeTarget =
      navFusionCompactAttr.value === 'true'
        ? activeLink.querySelector<HTMLElement>(
            '.home-cozy-nav__icon'
          ) ?? activeLink
        : activeLink;
    const activeRect = activeTarget.getBoundingClientRect();
    const activeX = activeRect.left - contentRect.left;

    navActiveX.value = Math.max(0, activeX);
    navActiveWidth.value = Math.max(0, activeRect.width);
    navActiveOpacity.value = activeRect.width > 0 ? 1 : 0;
    navSwitchGlowX.value =
      navActiveX.value + navActiveWidth.value / 2;
  }

  function isCompactDensity(
    density = navDensityState.value
  ) {
    return density === 'compacting' || density === 'compact';
  }

  function refreshNavActiveTrackAfterShapeChange(
    wasCompact: boolean
  ) {
    nextTick(() => {
      updateNavActiveTrack();

      if (wasCompact !== isCompactDensity()) {
        requestSettledNavActiveTrackUpdate();
      }
    });
  }

  function setNavDensityState(nextDensity: NavDensityState) {
    if (navDensityState.value === nextDensity) {
      return;
    }

    const wasCompact = isCompactDensity();
    navDensityState.value = nextDensity;
    refreshNavActiveTrackAfterShapeChange(wasCompact);
  }

  function setNavFusionLayout(nextState: NavFusionState) {
    if (navFusionState.value === nextState) {
      navFusionProgress.value =
        nextState === 'docked' ? 1 : 0;
      return;
    }

    navFusionState.value = nextState;
    navFusionProgress.value =
      nextState === 'docked' ? 1 : 0;
    nextTick(updateNavActiveTrack);
  }

  function clearNavFusionPhaseTimers() {
    if (navLabelTimer !== undefined) {
      window.clearTimeout(navLabelTimer);
      navLabelTimer = undefined;
    }

    if (navDensityTimer !== undefined) {
      window.clearTimeout(navDensityTimer);
      navDensityTimer = undefined;
    }
  }

  function clearNavRestoreTransition() {
    navRestoreSequence += 1;

    if (navRestoreFrame !== undefined) {
      window.cancelAnimationFrame(navRestoreFrame);
      navRestoreFrame = undefined;
    }

    if (navRestoreTimer !== undefined) {
      window.clearTimeout(navRestoreTimer);
      navRestoreTimer = undefined;
    }

    isNavRestoring.value = false;
    navRestoreY.value = 0;
  }

  function resetNavFusionToIdle() {
    clearNavFusionPhaseTimers();
    clearNavRestoreTransition();
    navLabelState.value = 'visible';
    setNavDensityState('regular');
    setNavFusionLayout('idle');
  }

  function beginNavDock() {
    rememberNavFusionEntryScrollTarget(
      measureNavFusionEntryScrollTarget()
    );
    clearNavRestoreTransition();
    clearNavFusionPhaseTimers();
    setNavFusionLayout('docked');

    if (reducedMotion) {
      navLabelState.value = 'hidden';
      setNavDensityState('compact');
      return;
    }

    navLabelState.value = 'hiding';
    setNavDensityState('regular');
    navLabelTimer = window.setTimeout(() => {
      navLabelTimer = undefined;
      navLabelState.value = 'hidden';
      setNavDensityState('compacting');
      navDensityTimer = window.setTimeout(() => {
        navDensityTimer = undefined;
        setNavDensityState('compact');
      }, NAV_DENSITY_PHASE_MS);
    }, NAV_LABEL_PHASE_MS);
  }

  function finishNavRestoreToIdle() {
    navRestoreTimer = undefined;
    isNavRestoring.value = false;
    navRestoreY.value = 0;
    nextTick(updateNavActiveTrack);
  }

  function beginNavRestoreToIdle() {
    clearNavRestoreTransition();
    navLabelState.value = 'visible';
    setNavDensityState('regular');

    const anchor = navAnchorRef.value;
    const topbarRect = measureTopbarRect();
    if (!anchor || !topbarRect || topbarRect.height <= 0) {
      setNavFusionLayout('idle');
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    if (anchorRect.width <= 0) {
      setNavFusionLayout('idle');
      return;
    }

    navFusionTop.value =
      topbarRect.top +
      (topbarRect.height - NAV_DOCKED_NAV_HEIGHT) / 2;
    navFusionLeft.value = anchorRect.left;
    navFusionWidth.value = anchorRect.width;

    const restoreY = Math.max(
      0,
      anchorRect.top - navFusionTop.value
    );
    if (reducedMotion || restoreY <= 1) {
      setNavFusionLayout('idle');
      return;
    }

    const sequence = navRestoreSequence + 1;
    navRestoreSequence = sequence;
    navRestoreY.value = 0;
    isNavRestoring.value = true;
    setNavFusionLayout('idle');

    nextTick(() => {
      if (
        sequence !== navRestoreSequence ||
        !isNavRestoring.value
      ) {
        return;
      }

      let frameCompletedSynchronously = false;
      const frame = window.requestAnimationFrame(() => {
        frameCompletedSynchronously = true;
        navRestoreFrame = undefined;

        if (
          sequence !== navRestoreSequence ||
          !isNavRestoring.value
        ) {
          return;
        }

        navRestoreY.value = restoreY;
        navRestoreTimer = window.setTimeout(() => {
          if (sequence === navRestoreSequence) {
            finishNavRestoreToIdle();
          }
        }, NAV_RESTORE_DROP_MS);
      });

      if (!frameCompletedSynchronously) {
        navRestoreFrame = frame;
      }
    });
  }

  function beginNavUndock() {
    if (reducedMotion) {
      resetNavFusionToIdle();
      return;
    }

    if (
      navDensityState.value === 'expanding' ||
      navLabelState.value === 'showing'
    ) {
      return;
    }

    clearNavFusionPhaseTimers();
    navLabelState.value = 'hidden';
    setNavDensityState('expanding');
    navDensityTimer = window.setTimeout(() => {
      navDensityTimer = undefined;
      setNavDensityState('regular');
      navLabelState.value = 'showing';
      navLabelTimer = window.setTimeout(() => {
        navLabelTimer = undefined;
        navLabelState.value = 'visible';
        beginNavRestoreToIdle();
      }, NAV_LABEL_PHASE_MS);
    }, NAV_DENSITY_PHASE_MS);
  }

  function clearNavActiveTrackSettleFrame() {
    if (navActiveTrackSettleFrame !== undefined) {
      window.cancelAnimationFrame(navActiveTrackSettleFrame);
      navActiveTrackSettleFrame = undefined;
    }

    navActiveTrackSettleFramesRemaining = 0;
    isNavActiveTrackSettling.value = false;
  }

  function requestSettledNavActiveTrackUpdate() {
    clearNavActiveTrackSettleFrame();
    isNavActiveTrackSettling.value = true;
    navActiveTrackSettleFramesRemaining =
      NAV_ACTIVE_TRACK_SETTLE_FRAMES;

    const queueFrame = () => {
      let frameCompletedSynchronously = false;
      const frame = window.requestAnimationFrame(() => {
        frameCompletedSynchronously = true;
        navActiveTrackSettleFrame = undefined;
        updateNavActiveTrack();
        navActiveTrackSettleFramesRemaining -= 1;

        if (navActiveTrackSettleFramesRemaining > 0) {
          queueFrame();
          return;
        }

        isNavActiveTrackSettling.value = false;
        updateNavActiveTrack();
      });

      if (!frameCompletedSynchronously) {
        navActiveTrackSettleFrame = frame;
      }
    };

    queueFrame();
  }

  function requestImmediateNavActiveTrackUpdate() {
    window.requestAnimationFrame(() => {
      updateNavActiveTrack();
      window.requestAnimationFrame(updateNavActiveTrack);
    });
  }

  function triggerNavSwitchGlow() {
    if (reducedMotion) {
      return;
    }

    isNavSwitching.value = true;
    if (navSwitchTimer !== undefined) {
      window.clearTimeout(navSwitchTimer);
    }

    navSwitchTimer = window.setTimeout(() => {
      navSwitchTimer = undefined;
      isNavSwitching.value = false;
    }, NAV_SWITCH_GLOW_MS);
  }

  function updateNavFusionProgress() {
    navFusionFrame = undefined;

    if (isHeroImmersive.value) {
      resetNavFusionToIdle();
      return;
    }

    const anchor = navAnchorRef.value;
    if (!anchor) {
      resetNavFusionToIdle();
      return;
    }

    const topbarRect = measureTopbarRect();
    if (!topbarRect || topbarRect.height <= 0) {
      resetNavFusionToIdle();
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    if (anchorRect.width <= 0 || anchorRect.height <= 0) {
      resetNavFusionToIdle();
      return;
    }

    const topbarCenterY =
      topbarRect.top + topbarRect.height / 2;
    const anchorCenterY =
      anchorRect.top + anchorRect.height / 2;
    const isExiting =
      navDensityState.value === 'expanding' ||
      navLabelState.value === 'showing';

    navFusionTop.value =
      topbarRect.top +
      (topbarRect.height - NAV_DOCKED_NAV_HEIGHT) / 2;
    navFusionLeft.value = anchorRect.left;
    navFusionWidth.value = anchorRect.width;

    if (isNavRestoring.value) {
      if (anchorCenterY <= topbarCenterY) {
        beginNavDock();
      }
      return;
    }

    if (navFusionState.value === 'docked') {
      if (
        anchorCenterY >
        topbarCenterY + NAV_FUSION_EXIT_BUFFER
      ) {
        beginNavUndock();
        return;
      }

      if (anchorCenterY <= topbarCenterY && isExiting) {
        beginNavDock();
      }
      return;
    }

    if (anchorCenterY <= topbarCenterY) {
      beginNavDock();
      return;
    }

    resetNavFusionToIdle();
  }

  function requestNavFusionUpdate() {
    if (navFusionFrame !== undefined) {
      return;
    }

    let frameCompletedSynchronously = false;
    const nextFrame = window.requestAnimationFrame(() => {
      frameCompletedSynchronously = true;
      updateNavFusionProgress();
    });

    if (!frameCompletedSynchronously) {
      navFusionFrame = nextFrame;
    }
  }

  function stop() {
    if (navFusionFrame !== undefined) {
      window.cancelAnimationFrame(navFusionFrame);
      navFusionFrame = undefined;
    }

    window.removeEventListener('scroll', requestNavFusionUpdate);
    window.removeEventListener('resize', requestNavFusionUpdate);
    window.removeEventListener('resize', updateNavActiveTrack);

    if (navSwitchTimer !== undefined) {
      window.clearTimeout(navSwitchTimer);
      navSwitchTimer = undefined;
    }

    clearNavFusionPhaseTimers();
    clearNavRestoreTransition();
    clearNavActiveTrackSettleFrame();
  }

  onMounted(() => {
    window.addEventListener('scroll', requestNavFusionUpdate, {
      passive: true
    });
    window.addEventListener('resize', requestNavFusionUpdate);
    window.addEventListener('resize', updateNavActiveTrack);
    nextTick(() => {
      requestNavFusionUpdate();
      updateNavActiveTrack();
      requestImmediateNavActiveTrackUpdate();
    });
  });

  onBeforeUnmount(stop);

  watch(
    () => route.path,
    (path) => {
      nextTick(() => {
        requestNavFusionUpdate();
        updateNavActiveTrack();

        if (pendingRouteContentScrollPath === path) {
          pendingRouteContentScrollPath = null;
          scrollNavToFusionEntry();
        }
      });
    },
    { flush: 'post' }
  );

  return {
    navAnchorRef,
    navRef,
    navContentRef,
    navFusionState,
    navLabelState,
    navDensityState,
    navFusionCompactAttr,
    navSwitchingAttr,
    navActiveTrackSettlingAttr,
    navRestoringAttr,
    style,
    handleCozyNavRootClick
  };
}
