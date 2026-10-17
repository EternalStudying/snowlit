<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { X } from 'lucide-vue-next';
import type { AlbumCollection, AlbumPhoto } from '../model';

gsap.registerPlugin(ScrollTrigger);

const CODEPEN_IMAGE_OFFSETS = [
  { x: 300, y: 0 },
  { x: 200, y: 250 },
  { x: -100, y: -150 },
  { x: -500, y: 50 },
  { x: -60, y: -10 },
  { x: -200, y: -200 },
  { x: 100, y: -150 },
  { x: -300, y: 50 },
  { x: -50, y: -200 },
  { x: -120, y: 60 },
  { x: 400, y: -100 },
  { x: -60, y: 150 },
  { x: -200, y: 200 },
  { x: 300, y: -120 }
] as const;

const ACTIVE_PHOTO_VISIBLE_WINDOW = {
  enterOffset: 0.12,
  activeOffset: 0.42,
  exitOffset: 1.14,
  fadeDuration: 0.16
} as const;

const NEAR_SCREEN_FADE = {
  startOffset: 1.02,
  duration: 0.06,
  opacity: 0.32,
  filter: 'blur(14px)'
} as const;

const props = defineProps<{
  collection: AlbumCollection;
  photos: AlbumPhoto[];
}>();

const emit = defineEmits<{
  close: [];
  preview: [index: number];
}>();

const rootRef = ref<HTMLElement | null>(null);
const scrollRef = ref<HTMLElement | null>(null);
const scrollTrackRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const isReducedMotion = ref(false);
const galleryReady = ref(false);
let context: gsap.Context | undefined;
let scrollTrigger: ScrollTrigger | undefined;
let galleryChromeIntroTimeline: gsap.core.Timeline | undefined;
let reduceMotionQuery: MediaQueryList | undefined;
let refreshTimer: number | undefined;

const galleryPhotos = computed(() => (props.photos.length > 0 ? props.photos : props.collection.previewPhotos));
const scrollDistance = computed(() => Math.max(2600, galleryPhotos.value.length * 620 + 1200));
const scrollTrackStyle = computed(() => ({
  minHeight: `${scrollDistance.value}px`
}));

function syncReducedMotion() {
  const nextValue = reduceMotionQuery?.matches ?? false;
  isReducedMotion.value = nextValue;

  if (nextValue) {
    cleanupGallery();
    galleryReady.value = true;
    return;
  }

  void nextTick(() => setupGalleryTimeline());
}

function handlePointerMove(event: PointerEvent) {
  if (!stageRef.value || isReducedMotion.value) {
    return;
  }

  const x = (event.clientX / window.innerWidth - 0.5) * 10;
  const y = (event.clientY / window.innerHeight - 0.5) * -7;
  gsap.to(stageRef.value, {
    rotateY: x,
    rotateX: y,
    duration: 0.45,
    ease: 'power2.out'
  });
}

function handleResize() {
  ScrollTrigger.refresh();
}

function handleGalleryWheel(event: WheelEvent) {
  if (isReducedMotion.value || !scrollRef.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  scrollRef.value.scrollTop += dominantDelta;
}

function getDepthTransform(depth: number) {
  return `translateZ(${depth}px)`;
}

function getCodePenImageOffset(index: number) {
  return CODEPEN_IMAGE_OFFSETS[index % CODEPEN_IMAGE_OFFSETS.length];
}

function setupGalleryTimeline() {
  const root = rootRef.value;
  if (!root || !scrollRef.value || !scrollTrackRef.value || isReducedMotion.value || scrollTrigger) {
    galleryReady.value = true;
    return;
  }

  context = gsap.context(() => {
    const cards = gsap.utils.toArray<HTMLElement>('.album-immersive-gallery__photo', root);
    const imagePapers = gsap.utils.toArray<HTMLElement>('.album-immersive-gallery__paper', root);
    const introText = root.querySelector<HTMLElement>('.album-immersive-gallery__scroll-text--intro');
    const outroText = root.querySelector<HTMLElement>('.album-immersive-gallery__scroll-text--outro');
    const timeline = gsap.timeline({ defaults: { duration: 1, ease: 'none' } });
    const imageStart = 0.3;
    const imageStagger = 0.3;
    const imageSpan = Math.max(cards.length - 1, 0) * imageStagger;

    scrollRef.value!.scrollTop = 0;
    gsap.set(introText, { opacity: 1, xPercent: -50, yPercent: -50, y: 0, scale: 1 });
    gsap.set(outroText, { opacity: 0, xPercent: -50, yPercent: -50, y: 30, scale: 0.96 });
    playGalleryChromeIntro();

    cards.forEach((card, index) => {
      const offset = getCodePenImageOffset(index);
      gsap.set(card, { transform: getDepthTransform(-5000) });
      gsap.set(card, {
        pointerEvents: 'none',
        autoAlpha: 0,
        filter: 'blur(0px)',
        x: offset.x,
        y: offset.y,
        z: -5000
      });
    });
    gsap.set(imagePapers, { scale: 3, transformOrigin: 'center center' });

    timeline.to(introText, { opacity: 0, y: -28, scale: 0.94, duration: 0.35, ease: 'power2.out' }, 0);
    timeline.to(cards, { z: 350, duration: 1, stagger: imageStagger, ease: 'none' }, imageStart);
    timeline.to(imagePapers, { scale: 1.15, duration: 1, stagger: imageStagger, ease: 'none' }, imageStart);
    cards.forEach((card, index) => {
      const passStart = imageStart + index * imageStagger;
      timeline.to(
        card,
        { autoAlpha: 1, duration: ACTIVE_PHOTO_VISIBLE_WINDOW.fadeDuration, ease: 'power1.out' },
        passStart + ACTIVE_PHOTO_VISIBLE_WINDOW.enterOffset
      );
      timeline.set(card, { pointerEvents: 'auto' }, passStart + ACTIVE_PHOTO_VISIBLE_WINDOW.activeOffset);
      timeline.to(
        card,
        {
          autoAlpha: NEAR_SCREEN_FADE.opacity,
          filter: NEAR_SCREEN_FADE.filter,
          duration: NEAR_SCREEN_FADE.duration,
          ease: 'power1.in'
        },
        passStart + NEAR_SCREEN_FADE.startOffset
      );
      timeline.set(card, { pointerEvents: 'none' }, passStart + NEAR_SCREEN_FADE.startOffset);
      timeline.set(card, { pointerEvents: 'none' }, passStart + ACTIVE_PHOTO_VISIBLE_WINDOW.exitOffset);
      timeline.to(
        card,
        { autoAlpha: 0, filter: 'blur(18px)', duration: ACTIVE_PHOTO_VISIBLE_WINDOW.fadeDuration, ease: 'power1.in' },
        passStart + ACTIVE_PHOTO_VISIBLE_WINDOW.exitOffset
      );
    });
    timeline.to(
      outroText,
      { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power2.out' },
      imageStart + imageSpan + 1.5
    );

    scrollTrigger = ScrollTrigger.create({
      animation: timeline,
      trigger: scrollTrackRef.value,
      scroller: scrollRef.value,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      invalidateOnRefresh: true
    });
  }, root);

  galleryReady.value = true;
  refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 80);
}

function playGalleryChromeIntro() {
  const root = rootRef.value;
  const stage = stageRef.value;

  if (!root || !stage) {
    return;
  }

  const chromeTitleParts = Array.from(
    root.querySelectorAll<HTMLElement>(
      '.album-immersive-gallery__title p, .album-immersive-gallery__title h2, .album-immersive-gallery__title span'
    )
  );
  const introTextParts = Array.from(
    root.querySelectorAll<HTMLElement>(
      '.album-immersive-gallery__scroll-text--intro p, .album-immersive-gallery__scroll-text--intro span'
    )
  );

  galleryChromeIntroTimeline?.kill();
  galleryChromeIntroTimeline = gsap.timeline({
    defaults: {
      ease: 'power3.out',
      overwrite: 'auto'
    }
  });

  galleryChromeIntroTimeline
    .fromTo(
      '.album-immersive-gallery__header',
      { autoAlpha: 0, y: -18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.42,
        clearProps: 'opacity,transform,visibility'
      }
    )
    .fromTo(
      chromeTitleParts,
      { autoAlpha: 0, y: -8 },
      {
        autoAlpha: 1,
        y: 0,
        stagger: 0.045,
        duration: 0.32,
        clearProps: 'opacity,transform,visibility'
      },
      '<0.06'
    )
    .fromTo(
      '.album-immersive-gallery__close',
      { autoAlpha: 0, y: 12, scale: 0.86, rotation: 8 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        rotation: 0,
        duration: 0.38,
        ease: 'back.out(1.5)',
        clearProps: 'opacity,transform,visibility'
      },
      '<0.08'
    )
    .fromTo(
      stage,
      { autoAlpha: 0, scale: 0.985 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.46,
        clearProps: 'opacity,transform,visibility'
      },
      '<0.04'
    )
    .fromTo(
      introTextParts,
      { autoAlpha: 0, y: 14, scale: 0.96 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        stagger: 0.05,
        duration: 0.36,
        clearProps: 'opacity,transform,visibility'
      },
      '<0.12'
    );
}

function cleanupGallery() {
  if (refreshTimer !== undefined) {
    window.clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }

  galleryChromeIntroTimeline?.kill();
  galleryChromeIntroTimeline = undefined;
  scrollTrigger?.kill();
  scrollTrigger = undefined;
  if (context) {
    context.revert();
    context = undefined;
  }
}

function closeGallery() {
  cleanupGallery();
  emit('close');
}

onMounted(async () => {
  reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncReducedMotion();
  reduceMotionQuery.addEventListener('change', syncReducedMotion);
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });
  await nextTick();
  setupGalleryTimeline();
});

onBeforeUnmount(() => {
  cleanupGallery();
  reduceMotionQuery?.removeEventListener('change', syncReducedMotion);
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <Teleport to="body">
    <section
      ref="rootRef"
      class="album-immersive-gallery"
      :class="{ 'album-immersive-gallery--ready': galleryReady }"
      :data-reduced-motion="isReducedMotion ? 'true' : 'false'"
      role="dialog"
      aria-modal="true"
      :aria-label="`${collection.title}沉浸式照片走廊`"
      @wheel="handleGalleryWheel"
    >
      <div ref="scrollRef" class="album-immersive-gallery__scroll" aria-hidden="true">
        <div ref="scrollTrackRef" class="album-immersive-gallery__scroll-track" :style="scrollTrackStyle"></div>
      </div>

      <header class="album-immersive-gallery__header">
        <div class="album-immersive-gallery__title">
          <p>{{ collection.author }} / {{ collection.date }}</p>
          <h2>{{ collection.title }}</h2>
          <span>{{ collection.location }} · {{ galleryPhotos.length }} 张照片</span>
        </div>
      </header>

      <div ref="stageRef" class="album-immersive-gallery__stage">
        <div class="album-immersive-gallery__scroll-text album-immersive-gallery__scroll-text--intro">
          <p>{{ collection.title }}</p>
          <span>向前滚动，翻开这段回忆</span>
        </div>

        <button
          v-for="(photo, index) in galleryPhotos"
          :key="photo.cardId"
          class="album-immersive-gallery__photo"
          type="button"
          :aria-label="`查看大图：${photo.caption}`"
          @click="emit('preview', index)"
        >
          <span class="album-immersive-gallery__paper">
            <img :src="photo.url" :alt="photo.caption" draggable="false" loading="lazy" />
            <span class="album-immersive-gallery__caption">
              <strong>{{ photo.caption }}</strong>
              <time :datetime="photo.date">{{ photo.date }}</time>
              <span>{{ photo.location }}</span>
            </span>
          </span>
        </button>

        <div class="album-immersive-gallery__scroll-text album-immersive-gallery__scroll-text--outro">
          <p>先合上这一页</p>
          <span>{{ collection.author }} 把 {{ galleryPhotos.length }} 张照片留在这里</span>
        </div>
      </div>

      <button class="album-immersive-gallery__close" type="button" aria-label="退出沉浸相册" @click="closeGallery">
        <X :size="22" aria-hidden="true" />
      </button>
    </section>
  </Teleport>
</template>
