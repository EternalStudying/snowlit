<script setup lang="ts">
import { formatDottedDate } from '../../../display';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { CalendarDays, ChevronLeft, ChevronRight, Edit3, MapPin, Tag, Trash2, X } from 'lucide-vue-next';
import { STORY_CATEGORY_LABELS, type StoryMoment } from '../model';

const props = defineProps<{
  moment: StoryMoment | null;
  canManage: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'edit', moment: StoryMoment): void;
  (event: 'delete', moment: StoryMoment): void;
}>();

const renderedMoment = ref<StoryMoment | null>(props.moment);
const detailRoot = ref<HTMLElement | null>(null);
const viewerIndex = ref<number | null>(null);
const brokenViewerImages = ref<Record<string, boolean>>({});
let detailContext: gsap.Context | undefined;
let detailOpenTl: gsap.core.Timeline | undefined;
let detailCloseTl: gsap.core.Timeline | undefined;
let hasHandledMomentChange = false;

const viewerImages = computed(() => (renderedMoment.value?.images ?? []).slice(0, 3));
const currentViewerImage = computed(() => (viewerIndex.value === null ? null : viewerImages.value[viewerIndex.value] ?? null));
const canShowPreviousImage = computed(() => viewerIndex.value !== null && viewerIndex.value > 0);
const canShowNextImage = computed(() => viewerIndex.value !== null && viewerIndex.value < viewerImages.value.length - 1);

watch(
  () => props.moment,
  async (moment) => {
    if (moment) {
      const shouldPlayOpen = !hasHandledMomentChange || renderedMoment.value?.id !== moment.id;
      if (shouldPlayOpen) {
        closeImageViewer();
      }
      hasHandledMomentChange = true;
      renderedMoment.value = moment;
      await nextTick();
      if (shouldPlayOpen) {
        playDetailOpen();
      } else {
        detailCloseTl?.kill();
      }
      return;
    }
    hasHandledMomentChange = true;
    closeImageViewer();
    playDetailClose();
  },
  { immediate: true, flush: 'post' }
);

onMounted(() => {
  window.addEventListener('keydown', handleViewerKeydown, { capture: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleViewerKeydown, { capture: true });
  detailOpenTl?.kill();
  detailCloseTl?.kill();
  detailContext?.revert();
});

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function isTestEnvironment() {
  return import.meta.env.MODE === 'test';
}

function playDetailOpen() {
  if (!detailRoot.value) {
    return;
  }
  detailOpenTl?.kill();
  detailCloseTl?.kill();
  detailContext?.revert();

  const root = detailRoot.value;
  detailContext = gsap.context(() => {
    const softTargets = Array.from(
      root.querySelectorAll<HTMLElement>('.moment-detail__paper-content > *, .moment-detail__scroll > *, .moment-detail__actions button')
    );
    if (isTestEnvironment() || prefersReducedMotion()) {
      gsap.set([root, ...softTargets], { autoAlpha: 1, scale: 1, y: 0, rotation: 0, clearProps: 'transform,visibility' });
      return;
    }
    const isMobile = window.matchMedia?.('(max-width: 767px)').matches;
    detailOpenTl = gsap.timeline({ defaults: { ease: 'power2.out', overwrite: 'auto' } });
    detailOpenTl
      .fromTo(
        root,
        { autoAlpha: 0, scale: 0.965, y: isMobile ? 16 : 10, rotation: isMobile ? 0 : 0.4 },
        { autoAlpha: 1, scale: 1, y: 0, rotation: 0, duration: isMobile ? 0.2 : 0.24, clearProps: 'transform,visibility' },
        0
      )
      .fromTo(
        softTargets,
        { autoAlpha: 0, y: 4 },
        { autoAlpha: 1, y: 0, duration: 0.16, stagger: { each: 0.025, from: 'start' }, clearProps: 'transform,visibility' },
        0.08
      );
  }, root);
}

function playDetailClose() {
  detailOpenTl?.kill();
  detailCloseTl?.kill();
  if (!renderedMoment.value) {
    return;
  }
  if (isTestEnvironment() || !detailRoot.value) {
    renderedMoment.value = null;
    detailContext?.revert();
    return;
  }
  const root = detailRoot.value;
  const finish = () => {
    renderedMoment.value = null;
    closeImageViewer();
    detailContext?.revert();
  };
  detailCloseTl = gsap.timeline({ defaults: { ease: 'power1.out', overwrite: 'auto' }, onComplete: finish });
  if (prefersReducedMotion()) {
    detailCloseTl.to(root, { autoAlpha: 0, duration: 0.08 }, 0);
    return;
  }
  detailCloseTl.to(root, { autoAlpha: 0, scale: 0.985, y: 4, duration: 0.12, clearProps: 'transform,visibility' }, 0);
}

function openImageViewer(index: number) {
  if (!viewerImages.value[index]) {
    return;
  }
  viewerIndex.value = index;
}

function closeImageViewer() {
  viewerIndex.value = null;
}

function showPreviousImage() {
  if (canShowPreviousImage.value && viewerIndex.value !== null) {
    viewerIndex.value -= 1;
  }
}

function showNextImage() {
  if (canShowNextImage.value && viewerIndex.value !== null) {
    viewerIndex.value += 1;
  }
}

function handleViewerKeydown(event: KeyboardEvent) {
  if (viewerIndex.value === null) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeImageViewer();
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    event.stopImmediatePropagation();
    showPreviousImage();
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    event.stopImmediatePropagation();
    showNextImage();
  }
}

function markViewerImageFailed(src: string) {
  brokenViewerImages.value = {
    ...brokenViewerImages.value,
    [src]: true
  };
}
</script>

<template>
  <article v-if="renderedMoment" ref="detailRoot" class="moment-detail moment-detail--motion" role="dialog" aria-modal="false" :aria-label="renderedMoment.title">
    <button class="moment-detail__close" type="button" aria-label="关闭点滴详情" @click="emit('close')" />

    <div class="moment-detail__paper-content">
      <p class="moment-detail__category">
        <Tag :size="14" />
        {{ STORY_CATEGORY_LABELS[renderedMoment.category] }}
      </p>

      <h2 class="moment-detail__title">{{ renderedMoment.title }}</h2>

      <div class="moment-detail__meta">
        <span><CalendarDays :size="15" />开始 {{ formatDottedDate(renderedMoment.eventTime) }}</span>
        <span v-if="renderedMoment.endTime"><CalendarDays :size="15" />结束 {{ formatDottedDate(renderedMoment.endTime) }}</span>
        <span><MapPin :size="15" />{{ renderedMoment.locationName }}</span>
      </div>

      <div class="moment-detail__scroll">
        <p class="moment-detail__content">{{ renderedMoment.content }}</p>

        <div v-if="viewerImages.length" class="moment-detail__thumbs" aria-label="点滴图片">
          <button
            v-for="(image, index) in viewerImages.slice(0, 2)"
            :key="image"
            class="moment-detail__thumb"
            :class="{ 'moment-detail__thumb--more': index === 1 && viewerImages.length > 2 }"
            type="button"
            :aria-label="`查看图片 ${index + 1} / ${viewerImages.length}`"
            @click="openImageViewer(index)"
          >
            <img :src="image" alt="" />
            <span v-if="index === 1 && viewerImages.length > 2" class="moment-detail__thumb-more" aria-hidden="true">
              +{{ viewerImages.length - 2 }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="canManage" class="moment-detail__actions">
      <button class="moment-detail__edit" type="button" @click="emit('edit', renderedMoment)">
        <Edit3 :size="16" />
        编辑
      </button>
      <button class="moment-detail__delete" type="button" @click="emit('delete', renderedMoment)">
        <Trash2 :size="16" />
        删除
      </button>
    </div>

    <div v-if="viewerIndex !== null && currentViewerImage" class="moment-image-viewer" role="dialog" aria-modal="true" aria-label="点滴图片查看器" @click="closeImageViewer">
      <div class="moment-image-viewer__panel" @click.stop>
        <button class="moment-image-viewer__close" type="button" aria-label="关闭图片查看器" @click="closeImageViewer">
          <X :size="20" aria-hidden="true" />
        </button>
        <p class="moment-image-viewer__count">{{ (viewerIndex ?? 0) + 1 }} / {{ viewerImages.length }}</p>
        <div class="moment-image-viewer__stage">
          <img
            v-if="!brokenViewerImages[currentViewerImage]"
            class="moment-image-viewer__image"
            :src="currentViewerImage"
            alt=""
            @error="markViewerImageFailed(currentViewerImage)"
          />
          <p v-else class="moment-image-viewer__fallback">这张照片暂时没能加载出来</p>
        </div>
        <button
          v-if="viewerImages.length > 1"
          class="moment-image-viewer__nav moment-image-viewer__nav--prev"
          type="button"
          aria-label="上一张图片"
          :disabled="!canShowPreviousImage"
          @click="showPreviousImage"
        >
          <ChevronLeft :size="27" aria-hidden="true" />
        </button>
        <button
          v-if="viewerImages.length > 1"
          class="moment-image-viewer__nav moment-image-viewer__nav--next"
          type="button"
          aria-label="下一张图片"
          :disabled="!canShowNextImage"
          @click="showNextImage"
        >
          <ChevronRight :size="27" aria-hidden="true" />
        </button>
      </div>
    </div>
  </article>
</template>
