<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { AlbumCollection, AlbumPhoto } from '../model';

type PhotoRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

const props = defineProps<{
  collection: AlbumCollection;
  photos: AlbumPhoto[];
  sourceRect: DOMRect | null;
  photoRects: PhotoRect[];
}>();

const emit = defineEmits<{
  done: [];
}>();

const isGathered = ref(false);
const albumMemoryLineAnimation = 'album-memory-line-gather';
let finishTimer: number | undefined;
let animationFrame: number | undefined;

const sourceStyle = computed(() => {
  const rect = props.sourceRect;
  if (!rect) {
    return {};
  }

  return {
    '--album-enter-left': `${rect.left}px`,
    '--album-enter-top': `${rect.top}px`,
    '--album-enter-width': `${rect.width}px`,
    '--album-enter-height': `${rect.height}px`
  };
});

function getFallbackSourceRect() {
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;

  return (
    props.sourceRect ?? {
      left: viewportWidth / 2 - 210,
      top: viewportHeight / 2 - 260,
      width: 420,
      height: 520
    }
  );
}

function getEstimatedPhotoRect(index: number): PhotoRect {
  const rect = getFallbackSourceRect();
  const row = Math.floor(index / 3);
  const col = index % 3;
  const gap = 6;
  const padding = 22;
  const gridWidth = Math.max(180, Math.min(rect.width - padding * 2, 520));
  const size = Math.max(48, Math.min((gridWidth - gap * 2) / 3, 142));
  const previewTop = Math.min(
    Math.max(rect.height * 0.38, 126),
    Math.max(padding, rect.height - padding - size * 3 - gap * 2)
  );

  return {
    left: rect.left + padding + col * (size + gap),
    top: rect.top + previewTop + row * (size + gap),
    width: size,
    height: size
  };
}

function getFlightPhotoStyle(index: number) {
  const rect = props.photoRects[index] ?? getEstimatedPhotoRect(index);
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const row = Math.floor(index / 3);
  const col = index % 3;
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const toX = viewportWidth / 2 - width / 2 - rect.left;
  const toY = viewportHeight / 2 - height / 2 - rect.top;
  const arcX = (col - 1) * 58 + (row === 0 ? -20 : row === 2 ? 20 : 0);
  const arcY = (row - 1) * -46 + (col === 0 ? 18 : col === 2 ? -18 : 0);

  return {
    '--album-enter-photo-index': `${index}`,
    '--album-flight-start-left': `${rect.left}px`,
    '--album-flight-start-top': `${rect.top}px`,
    '--album-flight-width': `${width}px`,
    '--album-flight-height': `${height}px`,
    '--album-flight-mid-x': `${toX * 0.55 + arcX}px`,
    '--album-flight-mid-y': `${toY * 0.55 + arcY}px`,
    '--album-flight-to-x': `${toX}px`,
    '--album-flight-to-y': `${toY}px`,
    '--album-flight-rotate': `${(index - 4) * 5}deg`
  };
}

function getMemoryLineStyle(index: number) {
  const rect = props.photoRects[index] ?? getEstimatedPhotoRect(index);
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const toX = viewportWidth / 2 - startX;
  const toY = viewportHeight / 2 - startY;
  const length = Math.hypot(toX, toY);
  const angle = (Math.atan2(toY, toX) * 180) / Math.PI;

  return {
    '--album-memory-line-index': `${index}`,
    '--album-memory-line-left': `${startX}px`,
    '--album-memory-line-top': `${startY}px`,
    '--album-memory-line-length': `${Math.max(length, 1)}px`,
    '--album-memory-line-angle': `${angle}deg`
  };
}

onMounted(() => {
  animationFrame = window.requestAnimationFrame(() => {
    isGathered.value = true;
  });
  finishTimer = window.setTimeout(() => emit('done'), 860);
});

onBeforeUnmount(() => {
  if (animationFrame !== undefined) {
    window.cancelAnimationFrame(animationFrame);
  }

  if (finishTimer !== undefined) {
    window.clearTimeout(finishTimer);
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      class="album-enter-transition"
      :class="{ 'album-enter-transition--gathered': isGathered }"
      :style="sourceStyle"
      aria-hidden="true"
    >
      <div class="album-enter-transition__card">
        <p class="album-enter-transition__eyebrow">{{ collection.author }} / {{ collection.date }}</p>
        <h2>{{ collection.title }}</h2>
        <div class="album-enter-transition__preview">
          <span
            v-for="(photo, index) in photos.slice(0, 9)"
            :key="photo.cardId"
            class="album-enter-transition__photo"
            :style="{ '--album-enter-photo-index': index }"
          >
            <img :src="photo.url" :alt="photo.caption" draggable="false" />
          </span>
        </div>
      </div>

      <div class="album-enter-transition__flight">
        <span
          v-for="(photo, index) in photos.slice(0, 9)"
          :key="`flight-${photo.cardId}`"
          class="album-enter-transition__flight-photo"
          :style="getFlightPhotoStyle(index)"
        >
          <img :src="photo.url" :alt="photo.caption" draggable="false" />
        </span>
      </div>

      <div class="album-enter-transition__memory-lines">
        <span
          v-for="(photo, index) in photos.slice(0, 9)"
          :key="`memory-line-${photo.cardId}`"
          class="album-enter-transition__memory-line"
          :data-memory-line-animation="albumMemoryLineAnimation"
          :style="getMemoryLineStyle(index)"
        ></span>
      </div>
    </div>
  </Teleport>
</template>
