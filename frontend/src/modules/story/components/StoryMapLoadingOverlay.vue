<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { isInstantMotion, useMotionSlots } from '../../../motion';
import loaderTitleArt from '../assets/story-loader-title.webp';

const props = defineProps<{
  progress: number;
  stageLabel: string;
  leaving: boolean;
  reducedMotion: boolean;
}>();

const emit = defineEmits<{
  (event: 'after-leave'): void;
}>();

const root = ref<HTMLElement | null>(null);
const routeFill = ref<HTMLElement | null>(null);
const nodeCount = 5;
const thresholds = [8, 28, 52, 76, 100];

let introTl: gsap.core.Timeline | undefined;
let progressTween: gsap.core.Tween | undefined;
let leaveTl: gsap.core.Timeline | undefined;
let ctx: gsap.Context | undefined;
const slots = useMotionSlots<'introTl' | 'progressTween' | 'leaveTl' | 'ctx'>();
let hasStartedProgress = false;

const safeProgress = computed(() => Math.min(100, Math.max(0, Math.round(props.progress))));

onMounted(() => {
  nextTick(playIntro);
});

watch(
  safeProgress,
  () => {
    nextTick(animateProgress);
  },
  { flush: 'post' }
);

watch(
  () => props.leaving,
  (leaving) => {
    if (leaving) {
      nextTick(playLeave);
    }
  },
  { flush: 'post' }
);

function progressScale() {
  return safeProgress.value / 100;
}

function isNodeActive(index: number) {
  return safeProgress.value >= thresholds[index];
}

function playIntro() {
  if (!root.value) {
    return;
  }

  slots.stop('introTl');
  slots.stop('ctx');

  if (props.reducedMotion || isInstantMotion()) {
    gsap.set(root.value, { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)' });
    gsap.set(root.value.querySelector<HTMLElement>('.story-map-loader__content'), { autoAlpha: 1, y: 0 });
    gsap.set(routeFill.value, { scaleX: progressScale(), transformOrigin: 'left center' });
    return;
  }

  ctx = slots.hold('ctx', gsap.context(() => {
    const loaderContent = root.value?.querySelector<HTMLElement>('.story-map-loader__content');
    const title = root.value?.querySelector<HTMLElement>('.story-map-loader__paper');
    const text = root.value?.querySelector<HTMLElement>('.story-map-loader__text');
    const nodes = root.value ? Array.from(root.value.querySelectorAll<HTMLElement>('.story-map-loader__node')) : [];
    if (!loaderContent) {
      return;
    }
    const titleTarget = title ? [title] : [];
    const textTarget = text ? [text] : [];

    introTl = slots.hold('introTl', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }));
    gsap.set(routeFill.value, { scaleX: 0, transformOrigin: 'left center' });
    introTl
      .set(root.value, { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)' })
      .fromTo(loaderContent, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.76, ease: 'power2.out' }, 0.18)
      .fromTo(titleTarget, { autoAlpha: 0, y: -10, rotation: -1.2 }, { autoAlpha: 1, y: 0, rotation: 0, duration: 0.36 }, 0.28)
      .fromTo(textTarget, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.34 }, 0.44);

    if (nodes.length) {
      introTl.fromTo(nodes, { autoAlpha: 0.34, xPercent: -50, yPercent: -50, scale: 0.72 }, { autoAlpha: 1, xPercent: -50, yPercent: -50, scale: 1, duration: 0.22, stagger: { each: 0.055, from: 'start' } }, 0.56);
    }
  }, root.value));
  animateProgress();
}

function animateProgress() {
  if (!routeFill.value) {
    return;
  }
  slots.stop('progressTween');
  if (props.reducedMotion || isInstantMotion()) {
    gsap.set(routeFill.value, { scaleX: progressScale(), transformOrigin: 'left center' });
    return;
  }
  const duration = hasStartedProgress ? 0.34 : 0.62;
  hasStartedProgress = true;
  progressTween = slots.hold('progressTween', gsap.to(routeFill.value, {
    scaleX: progressScale(),
    transformOrigin: 'left center',
    duration,
    ease: 'power2.out',
    overwrite: 'auto'
  }));
}

function playLeave() {
  if (!root.value) {
    emit('after-leave');
    return;
  }

  slots.stop('introTl');
  slots.stop('progressTween');
  slots.stop('leaveTl');

  if (props.reducedMotion || isInstantMotion()) {
    gsap.to(root.value, {
      autoAlpha: 0,
      duration: props.reducedMotion ? 0.1 : 0,
      onComplete: () => emit('after-leave')
    });
    return;
  }

  leaveTl = slots.hold('leaveTl', gsap.timeline({
    defaults: { ease: 'power3.inOut', overwrite: 'auto' },
    onComplete: () => emit('after-leave')
  }));
  leaveTl
    .to(routeFill.value, { scaleX: 1, transformOrigin: 'left center', duration: 0.18, ease: 'power2.out' }, 0)
    .to(root.value, { clipPath: 'inset(0% 0% 0% 100%)', autoAlpha: 0, duration: 0.56 }, 0.12);
}
</script>

<template>
  <section ref="root" class="story-map-loader" role="status" aria-live="polite" aria-label="点滴地图加载中">
    <div class="story-map-loader__texture" aria-hidden="true" />
    <div class="story-map-loader__content">
      <div class="story-map-loader__paper" aria-hidden="true">
        <img :src="loaderTitleArt" alt="" class="story-map-loader__paper-img" decoding="async" />
      </div>
      <div class="story-map-loader__route" aria-hidden="true">
        <span class="story-map-loader__track" />
        <span ref="routeFill" class="story-map-loader__fill" />
        <span
          v-for="index in nodeCount"
          :key="index"
          class="story-map-loader__node"
          :class="{ 'is-active': isNodeActive(index - 1) }"
          :style="{ left: `${(index - 1) * 25}%` }"
        />
      </div>
      <div class="story-map-loader__text">
        <p>正在铺开我们的点滴地图...</p>
        <span>{{ stageLabel }} · {{ safeProgress }}%</span>
      </div>
    </div>
  </section>
</template>
