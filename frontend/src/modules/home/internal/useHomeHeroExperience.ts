import { prefersReducedMotion } from '../../../motion';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue';
import { homeHeroSlides } from './homeHeroSlides';

type HeroStickerSide = 'left' | 'right';

interface HeroBurstParticle {
  id: number;
  side: HeroStickerSide;
  symbol: string;
  style: Record<string, string>;
}

const HERO_EXPANSION_TOP_THRESHOLD = 2;
const HERO_EXPANSION_INTENT_THRESHOLD = 240;
const HERO_EXPANSION_INTENT_RESET_MS = 420;
const HERO_EXPANSION_RESTORE_LOCK_MS = 560;
const HERO_EXPANSION_COMPLETE_THRESHOLD = 0.995;
const HERO_INTERACTION_SYNC_WINDOW_MS = 2000;
const HERO_HEART_BEAT_MS = 520;
const HERO_SYNC_PULSE_MS = 680;
const HERO_BURST_CLEANUP_MS = 760;
const HERO_SLIDE_WARMUP_MS = 1400;
const HERO_AUTOPLAY_MS = 5000;

export function useHomeHeroExperience() {
  const activeSlideIndex = ref(0);
  const loadedSlideIndexes = ref<ReadonlySet<number>>(new Set([0]));
  const paused = ref(false);
  const expansionProgress = ref(0);
  const isExpanded = ref(false);
  const isRestoring = ref(false);
  const activeStickerSide = ref<HeroStickerSide | null>(null);
  const isHeartBeating = ref(false);
  const isSyncing = ref(false);
  const burstParticles = ref<HeroBurstParticle[]>([]);
  const reducedMotion = prefersReducedMotion();

  let autoplayTimer: number | undefined;
  let slideWarmupTimer: number | undefined;
  let expansionFrame: number | undefined;
  let pendingExpansionProgress: number | null = null;
  let expansionIntent = 0;
  let expansionIntentResetTimer: number | undefined;
  let expansionRestoreLockTimer: number | undefined;
  let burstParticleId = 0;
  let recentLeftClickAt = 0;
  let recentRightClickAt = 0;
  const interactionTimers = new Set<number>();

  const activeSlide = computed(
    () => homeHeroSlides[activeSlideIndex.value] ?? homeHeroSlides[0]
  );
  const isImmersive = computed(
    () =>
      isRestoring.value ||
      isExpanded.value ||
      expansionProgress.value > 0.001
  );
  const immersiveAttr = computed(() =>
    isImmersive.value ? 'true' : 'false'
  );
  const expandedAttr = computed(() =>
    isExpanded.value ? 'true' : 'false'
  );
  const style = computed(() => {
    const progress = expansionProgress.value;

    return {
      '--hero-expansion-progress': progress.toFixed(4),
      '--hero-snow-spread': progress.toFixed(4),
      '--hero-snow-opacity': (1 - progress).toFixed(4),
      '--hero-image-scale': (1 + progress * 0.14).toFixed(4),
      '--hero-sticker-scale': (1 + progress * 0.16).toFixed(4),
      '--hero-nav-opacity': (1 - progress).toFixed(4)
    };
  });

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function setExpansionProgress(progress: number) {
    const nextProgress = clamp(progress, 0, 1);

    if (nextProgress >= HERO_EXPANSION_COMPLETE_THRESHOLD) {
      expansionProgress.value = 1;
      isExpanded.value = true;
      return;
    }

    expansionProgress.value = nextProgress;
    isExpanded.value = false;
  }

  function requestExpansionProgress(progress: number) {
    pendingExpansionProgress = progress;

    if (expansionFrame !== undefined) {
      return;
    }

    let frameCompletedSynchronously = false;
    const nextFrame = window.requestAnimationFrame(() => {
      frameCompletedSynchronously = true;
      expansionFrame = undefined;

      if (pendingExpansionProgress === null) {
        return;
      }

      const nextProgress = pendingExpansionProgress;
      pendingExpansionProgress = null;
      setExpansionProgress(nextProgress);
    });

    if (!frameCompletedSynchronously) {
      expansionFrame = nextFrame;
    }
  }

  function clearIntentReset() {
    if (expansionIntentResetTimer === undefined) {
      return;
    }

    window.clearTimeout(expansionIntentResetTimer);
    expansionIntentResetTimer = undefined;
  }

  function clearRestoreLock() {
    if (expansionRestoreLockTimer === undefined) {
      return;
    }

    window.clearTimeout(expansionRestoreLockTimer);
    expansionRestoreLockTimer = undefined;
  }

  function lockRestoreScroll() {
    clearRestoreLock();
    isRestoring.value = true;
    expansionRestoreLockTimer = window.setTimeout(() => {
      expansionRestoreLockTimer = undefined;
      isRestoring.value = false;
    }, HERO_EXPANSION_RESTORE_LOCK_MS);
  }

  function scheduleIntentReset() {
    clearIntentReset();
    expansionIntentResetTimer = window.setTimeout(() => {
      expansionIntentResetTimer = undefined;
      expansionIntent = 0;
    }, HERO_EXPANSION_INTENT_RESET_MS);
  }

  function exitExpansion() {
    clearIntentReset();
    expansionIntent = 0;
    pendingExpansionProgress = null;
    resetStickerInteraction();
    lockRestoreScroll();
    requestExpansionProgress(0);
  }

  function markSlideLoaded(index: number) {
    if (loadedSlideIndexes.value.has(index)) {
      return;
    }
    loadedSlideIndexes.value = new Set([
      ...loadedSlideIndexes.value,
      index
    ]);
  }

  function showSlide(index: number) {
    const nextIndex =
      (index + homeHeroSlides.length) % homeHeroSlides.length;
    markSlideLoaded(nextIndex);
    activeSlideIndex.value = nextIndex;
  }

  function shouldRenderSlideImage(index: number) {
    return loadedSlideIndexes.value.has(index);
  }

  function scheduleSlideWarmup() {
    if (homeHeroSlides.length < 2) {
      return;
    }
    slideWarmupTimer = window.setTimeout(() => {
      slideWarmupTimer = undefined;
      homeHeroSlides.forEach((_, index) => markSlideLoaded(index));
    }, HERO_SLIDE_WARMUP_MS);
  }

  function showNextSlide() {
    showSlide(activeSlideIndex.value + 1);
  }

  function showPreviousSlide() {
    showSlide(activeSlideIndex.value - 1);
  }

  function startAutoplay() {
    if (reducedMotion || homeHeroSlides.length < 2) {
      return;
    }

    autoplayTimer = window.setInterval(() => {
      if (!paused.value && !isImmersive.value) {
        showNextSlide();
      }
    }, HERO_AUTOPLAY_MS);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = undefined;
    }
  }

  function scheduleInteractionTimer(
    callback: () => void,
    delay: number
  ) {
    const timer = window.setTimeout(() => {
      interactionTimers.delete(timer);
      callback();
    }, delay);
    interactionTimers.add(timer);
  }

  function clearInteractionTimers() {
    interactionTimers.forEach((timer) => window.clearTimeout(timer));
    interactionTimers.clear();
  }

  function resetStickerInteraction() {
    clearInteractionTimers();
    activeStickerSide.value = null;
    isHeartBeating.value = false;
    isSyncing.value = false;
    burstParticles.value = [];
    recentLeftClickAt = 0;
    recentRightClickAt = 0;
  }

  function setStickerTarget(side: HeroStickerSide) {
    if (!isExpanded.value) {
      return;
    }

    activeStickerSide.value = side;
  }

  function clearStickerTarget(side: HeroStickerSide) {
    if (activeStickerSide.value === side) {
      activeStickerSide.value = null;
    }
  }

  function pulseHeart() {
    isHeartBeating.value = true;
    scheduleInteractionTimer(() => {
      isHeartBeating.value = false;
    }, HERO_HEART_BEAT_MS);
  }

  function triggerSyncPulse() {
    isSyncing.value = true;
    recentLeftClickAt = 0;
    recentRightClickAt = 0;
    scheduleInteractionTimer(() => {
      isSyncing.value = false;
    }, HERO_SYNC_PULSE_MS);
  }

  function createBurstParticles(side: HeroStickerSide) {
    const direction = side === 'left' ? -1 : 1;
    const symbols = ['♡', '♥', '✦', '·'];
    const particles = symbols.map((symbol, index) => {
      const id = ++burstParticleId;
      const startX = direction * (158 + index * 15);
      const midX = direction * (72 + index * 8);
      const startY = -20 + index * 7;
      const midY = -58 - index * 6;

      return {
        id,
        side,
        symbol,
        style: {
          '--burst-start-x': `${startX}px`,
          '--burst-start-y': `${startY}px`,
          '--burst-mid-x': `${midX}px`,
          '--burst-mid-y': `${midY}px`,
          '--burst-delay': `${index * 34}ms`,
          '--burst-spin': `${direction * (16 + index * 9)}deg`
        }
      };
    });

    burstParticles.value = [...burstParticles.value, ...particles];
    const particleIds = new Set(
      particles.map((particle) => particle.id)
    );
    scheduleInteractionTimer(() => {
      burstParticles.value = burstParticles.value.filter(
        (particle) => !particleIds.has(particle.id)
      );
    }, HERO_BURST_CLEANUP_MS);
  }

  function triggerStickerInteraction(side: HeroStickerSide) {
    if (!isExpanded.value) {
      return;
    }

    activeStickerSide.value = side;

    if (reducedMotion) {
      return;
    }

    createBurstParticles(side);
    pulseHeart();

    const now = Date.now();
    if (side === 'left') {
      recentLeftClickAt = now;
    } else {
      recentRightClickAt = now;
    }

    const recentLeft =
      now - recentLeftClickAt <= HERO_INTERACTION_SYNC_WINDOW_MS;
    const recentRight =
      now - recentRightClickAt <= HERO_INTERACTION_SYNC_WINDOW_MS;
    if (recentLeft && recentRight) {
      triggerSyncPulse();
    }
  }

  function getCurrentScrollY() {
    return (
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0
    );
  }

  function handleExpansionWheel(event: WheelEvent) {
    if (reducedMotion) {
      if (
        getCurrentScrollY() <= HERO_EXPANSION_TOP_THRESHOLD &&
        event.deltaY < 0
      ) {
        event.preventDefault();
        setExpansionProgress(1);
        return;
      }

      if (isImmersive.value && event.deltaY > 0) {
        event.preventDefault();
        setExpansionProgress(0);
      }
      return;
    }

    if (isRestoring.value && event.deltaY > 0) {
      event.preventDefault();
      return;
    }

    if (isImmersive.value && event.deltaY > 0) {
      event.preventDefault();
      exitExpansion();
      return;
    }

    if (
      getCurrentScrollY() > HERO_EXPANSION_TOP_THRESHOLD ||
      event.deltaY >= 0
    ) {
      return;
    }

    event.preventDefault();
    expansionIntent += Math.abs(event.deltaY);

    if (expansionIntent >= HERO_EXPANSION_INTENT_THRESHOLD) {
      clearIntentReset();
      clearRestoreLock();
      isRestoring.value = false;
      expansionIntent = 0;
      requestExpansionProgress(1);
      return;
    }

    scheduleIntentReset();
  }

  onMounted(() => {
    startAutoplay();
    scheduleSlideWarmup();
    window.addEventListener('wheel', handleExpansionWheel, {
      passive: false
    });
  });

  onBeforeUnmount(() => {
    stopAutoplay();
    if (slideWarmupTimer !== undefined) {
      window.clearTimeout(slideWarmupTimer);
      slideWarmupTimer = undefined;
    }
    window.removeEventListener('wheel', handleExpansionWheel);
    clearIntentReset();
    clearRestoreLock();
    if (expansionFrame !== undefined) {
      window.cancelAnimationFrame(expansionFrame);
      expansionFrame = undefined;
    }
    resetStickerInteraction();
  });

  watch(isExpanded, (expanded) => {
    if (!expanded) {
      resetStickerInteraction();
    }
  });

  return {
    slides: homeHeroSlides,
    activeSlide,
    activeSlideIndex,
    paused,
    isExpanded,
    isImmersive,
    immersiveAttr,
    expandedAttr,
    style,
    activeStickerSide,
    isHeartBeating,
    isSyncing,
    burstParticles,
    shouldRenderSlideImage,
    showSlide,
    showNextSlide,
    showPreviousSlide,
    setStickerTarget,
    clearStickerTarget,
    triggerStickerInteraction
  };
}
