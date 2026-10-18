<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number | string;
    enabled: boolean;
    start?: boolean;
    duration?: number;
  }>(),
  {
    start: true,
    duration: 720
  }
);

const displayValue = ref(String(props.value));
const rootRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
let frameId: number | undefined;
let visibilityObserver: IntersectionObserver | undefined;

const numericValue = computed(() => {
  const numberValue = Number(props.value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
});

function stopAnimation() {
  if (frameId !== undefined) {
    window.cancelAnimationFrame(frameId);
    frameId = undefined;
  }
}

function renderStaticValue() {
  displayValue.value = String(props.value);
}

function renderStartValue() {
  displayValue.value = '0';
}

function animateValue(target: number) {
  stopAnimation();

  if (
    !props.enabled ||
    !props.start ||
    target <= 0 ||
    !window.requestAnimationFrame
  ) {
    renderStaticValue();
    return;
  }

  renderStartValue();
  const start = performance.now();

  function tick(now: number) {
    const progress = Math.min((now - start) / props.duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    displayValue.value = String(Math.round(target * eased));

    if (progress < 1) {
      frameId = window.requestAnimationFrame(tick);
    } else {
      frameId = undefined;
      renderStaticValue();
    }
  }

  frameId = window.requestAnimationFrame(tick);
}

function stopVisibilityObserver() {
  visibilityObserver?.disconnect();
  visibilityObserver = undefined;
}

function startVisibilityObserver() {
  const element = rootRef.value;

  if (!element || !('IntersectionObserver' in window)) {
    isVisible.value = true;
    return;
  }

  visibilityObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      isVisible.value = true;
      visibilityObserver?.unobserve(element);
    },
    {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.18
    }
  );

  visibilityObserver.observe(element);
}

watch(
  () => [props.value, props.enabled, props.start, isVisible.value] as const,
  () => {
    if (numericValue.value === undefined) {
      renderStaticValue();
      return;
    }

    if (!props.start) {
      stopAnimation();
      renderStartValue();
      return;
    }

    if (!props.enabled || numericValue.value <= 0 || !window.requestAnimationFrame) {
      renderStaticValue();
      return;
    }

    if (!isVisible.value) {
      stopAnimation();
      renderStartValue();
      return;
    }

    animateValue(numericValue.value);
  },
  { immediate: true }
);

onMounted(startVisibilityObserver);

onBeforeUnmount(() => {
  stopAnimation();
  stopVisibilityObserver();
});
</script>

<template>
  <span ref="rootRef">{{ displayValue }}</span>
</template>
