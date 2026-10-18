<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement
} from '@floating-ui/vue';
import { motion } from 'motion-v';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
type TooltipAlign = 'start' | 'center' | 'end';

const TOPBAR_TOOLTIP_OPEN_DELAY = 0;
const TOPBAR_TOOLTIP_CLOSE_DELAY = 300;
const TOPBAR_TOOLTIP_EXIT_DELAY = 220;
const TOPBAR_TOOLTIP_OPEN_EVENT = 'snowlit:topbar-tooltip-open';
const tooltipTransition = { type: 'spring', stiffness: 300, damping: 35 } as const;
const reducedMotionTransition = { duration: 0.01 } as const;

const props = withDefaults(
  defineProps<{
    label: string;
    side?: TooltipSide;
    align?: TooltipAlign;
    sideOffset?: number;
    enabled?: boolean;
  }>(),
  {
    side: 'top',
    align: 'center',
    sideOffset: 10,
    enabled: true
  }
);

const triggerEl = ref<HTMLElement | null>(null);
const floatingEl = ref<HTMLElement | null>(null);
const isDesktopTooltip = ref(false);
const prefersReducedMotion = ref(false);
const isRendered = ref(false);
const isOpen = ref(false);
const tooltipId = `topbar-tooltip-${Math.random().toString(36).slice(2)}`;
let hoverQuery: MediaQueryList | undefined;
let reducedMotionQuery: MediaQueryList | undefined;
let openTimer: number | undefined;
let closeTimer: number | undefined;
let removeTimer: number | undefined;

const placementOption = computed<Placement>(() => {
  if (props.align === 'center') {
    return props.side;
  }

  return `${props.side}-${props.align}` as Placement;
});
const tooltipMiddleware = computed(() => [offset(props.sideOffset), flip(), shift({ padding: 8 })]);
const { floatingStyles, placement, update } = useFloating(triggerEl, floatingEl, {
  placement: placementOption,
  middleware: tooltipMiddleware,
  strategy: 'fixed',
  whileElementsMounted: autoUpdate
});
const resolvedSide = computed<TooltipSide>(() => placement.value.split('-')[0] as TooltipSide);
const resolvedAlign = computed<TooltipAlign>(() => {
  const align = placement.value.split('-')[1];

  return align === 'start' || align === 'end' ? align : 'center';
});
const hiddenMotion = computed(() => ({
  opacity: 0,
  scale: prefersReducedMotion.value ? 1 : 0,
  ...initialFromSide(resolvedSide.value)
}));
const shownMotion = computed(() => ({ opacity: 1, scale: 1, x: 0, y: 0 }));
const currentMotion = computed(() => (isOpen.value ? shownMotion.value : hiddenMotion.value));
const currentTransition = computed(() =>
  prefersReducedMotion.value ? reducedMotionTransition : tooltipTransition
);

function initialFromSide(side: TooltipSide): Partial<Record<'x' | 'y', number>> {
  if (prefersReducedMotion.value) {
    return { x: 0, y: 0 };
  }
  if (side === 'top') return { y: 15 };
  if (side === 'bottom') return { y: -15 };
  if (side === 'left') return { x: 15 };
  return { x: -15 };
}

function clearOpenTimer() {
  if (openTimer !== undefined) {
    window.clearTimeout(openTimer);
    openTimer = undefined;
  }
}

function clearCloseTimers() {
  if (closeTimer !== undefined) {
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
  }
  if (removeTimer !== undefined) {
    window.clearTimeout(removeTimer);
    removeTimer = undefined;
  }
}

function showTooltip() {
  if (!props.enabled || !isDesktopTooltip.value || !props.label) {
    return;
  }

  window.dispatchEvent(new CustomEvent(TOPBAR_TOOLTIP_OPEN_EVENT, { detail: { id: tooltipId } }));
  clearOpenTimer();
  clearCloseTimers();
  openTimer = window.setTimeout(() => {
    isRendered.value = true;
    isOpen.value = true;
    void nextTick(update);
  }, TOPBAR_TOOLTIP_OPEN_DELAY);
}

function scheduleCloseTooltip() {
  clearOpenTimer();
  clearCloseTimers();
  closeTimer = window.setTimeout(() => {
    isOpen.value = false;
    removeTimer = window.setTimeout(() => {
      isRendered.value = false;
    }, prefersReducedMotion.value ? 0 : TOPBAR_TOOLTIP_EXIT_DELAY);
  }, TOPBAR_TOOLTIP_CLOSE_DELAY);
}

function hideImmediately() {
  clearOpenTimer();
  clearCloseTimers();
  isOpen.value = false;
  isRendered.value = false;
}

function syncMediaState() {
  isDesktopTooltip.value = Boolean(hoverQuery?.matches);
  prefersReducedMotion.value = Boolean(reducedMotionQuery?.matches);
}

function handleExternalOpen(event: Event) {
  const detail = (event as CustomEvent<{ id?: string }>).detail;
  if (detail?.id !== tooltipId) {
    hideImmediately();
  }
}

function handlePointerDown() {
  hideImmediately();
}

function addQueryListener(query: MediaQueryList | undefined, listener: () => void) {
  query?.addEventListener?.('change', listener);
  query?.addListener?.(listener);
}

function removeQueryListener(query: MediaQueryList | undefined, listener: () => void) {
  query?.removeEventListener?.('change', listener);
  query?.removeListener?.(listener);
}

watch(isDesktopTooltip, (enabled) => {
  if (!enabled) {
    hideImmediately();
  }
});

watch(
  () => props.enabled,
  (enabled) => {
    if (!enabled) {
      hideImmediately();
    }
  }
);

onMounted(() => {
  if (typeof window.matchMedia !== 'function') {
    return;
  }

  hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncMediaState();
  addQueryListener(hoverQuery, syncMediaState);
  addQueryListener(reducedMotionQuery, syncMediaState);
  window.addEventListener(TOPBAR_TOOLTIP_OPEN_EVENT, handleExternalOpen);
});

onBeforeUnmount(() => {
  hideImmediately();
  removeQueryListener(hoverQuery, syncMediaState);
  removeQueryListener(reducedMotionQuery, syncMediaState);
  window.removeEventListener(TOPBAR_TOOLTIP_OPEN_EVENT, handleExternalOpen);
});
</script>

<template>
  <span
    ref="triggerEl"
    class="topbar-tooltip-trigger"
    :aria-describedby="isRendered ? tooltipId : undefined"
    @mouseenter="showTooltip"
    @mouseleave="scheduleCloseTooltip"
    @focusin="showTooltip"
    @focusout="scheduleCloseTooltip"
    @pointerdown="handlePointerDown"
  >
    <slot />
  </span>

  <Teleport to="body">
    <div
      v-if="isRendered"
      :id="tooltipId"
      ref="floatingEl"
      class="topbar-tooltip"
      data-testid="topbar-tooltip"
      role="tooltip"
      :data-state="isOpen ? 'open' : 'closed'"
      :data-side="resolvedSide"
      :data-align="resolvedAlign"
      :style="floatingStyles"
    >
      <motion.div
        class="topbar-tooltip__content"
        :initial="hiddenMotion"
        :animate="currentMotion"
        :transition="currentTransition"
      >
        <span class="topbar-tooltip__label">{{ label }}</span>
        <span class="topbar-tooltip__arrow" :data-side="resolvedSide" aria-hidden="true"></span>
      </motion.div>
    </div>
  </Teleport>
</template>
