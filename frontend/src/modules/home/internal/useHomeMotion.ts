import { computed } from 'vue';

export type HomeMotionModuleKey =
  | 'hero'
  | 'memoryCard'
  | 'dailyNote'
  | 'statusCards'
  | 'progressLedger'
  | 'recentCards'
  | 'nextPlan';

const homeMotionModules: Record<HomeMotionModuleKey, boolean> = {
  hero: true,
  memoryCard: true,
  dailyNote: true,
  statusCards: true,
  progressLedger: true,
  recentCards: true,
  nextPlan: true
};

function boolAttr(value: boolean) {
  return value ? 'true' : 'false';
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function useHomeMotion() {
  const enabled = computed(() => true);
  const isCountUpEnabled = computed(() => !prefersReducedMotion());
  const rootAttrs = computed(() => ({
    'data-home-motion': 'warm-journal',
    'data-motion-image-drift': 'true',
    'data-motion-paper-float': 'true',
    'data-motion-count-up': 'true',
    'data-motion-sticker-pop': 'true',
    'data-motion-paper-lift': 'true'
  }));
  const rootStyle = computed(() => ({
    '--motion-duration-scale': '1.087',
    '--motion-stagger': '105ms',
    '--motion-softness': '0.82',
    '--motion-float-intensity': '0.32',
    '--motion-scale-intensity': '0.28'
  }));

  function moduleEnabledAttr(module: HomeMotionModuleKey) {
    return boolAttr(homeMotionModules[module]);
  }

  return {
    enabled,
    rootAttrs,
    rootStyle,
    moduleEnabledAttr,
    isCountUpEnabled
  };
}
