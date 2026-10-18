<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import { useWeatherAtmosphereData } from './internal/useWeatherAtmosphereData';
import { getWeatherRenderMode } from './profiles/weatherProfiles';
import SunnyWeatherLayer from './components/SunnyWeatherLayer.vue';

const ThreeWeatherLayer = defineAsyncComponent(
  () => import('./components/ThreeWeatherLayer.vue')
);

const LARGE_VIEWPORT_QUERY = '(max-width: 1020px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const { weather, loadWeather } = useWeatherAtmosphereData();
const isSmallViewport = ref(false);
const prefersReducedMotion = ref(false);

let viewportMediaQuery: MediaQueryList | undefined;
let reducedMotionMediaQuery: MediaQueryList | undefined;

const renderMode = computed(() =>
  getWeatherRenderMode({
    weatherState: weather.value?.weatherState ?? 'cloudy',
    isLargeViewport: !isSmallViewport.value,
    prefersReducedMotion: prefersReducedMotion.value
  })
);

function updateMediaState() {
  isSmallViewport.value = viewportMediaQuery?.matches ?? false;
  prefersReducedMotion.value = reducedMotionMediaQuery?.matches ?? false;
}

function setupMediaQueries() {
  if (!window.matchMedia) {
    return;
  }

  viewportMediaQuery = window.matchMedia(LARGE_VIEWPORT_QUERY);
  reducedMotionMediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  updateMediaState();

  viewportMediaQuery.addEventListener('change', updateMediaState);
  reducedMotionMediaQuery.addEventListener('change', updateMediaState);
}

function cleanupMediaQueries() {
  viewportMediaQuery?.removeEventListener('change', updateMediaState);
  reducedMotionMediaQuery?.removeEventListener('change', updateMediaState);
}

onMounted(() => {
  setupMediaQueries();
  void loadWeather();
});

onUnmounted(cleanupMediaQueries);
</script>

<template>
  <template v-if="weather && renderMode === 'none'"></template>
  <SunnyWeatherLayer
    v-else-if="weather && renderMode === 'three-clear'"
    :active="renderMode === 'three-clear'"
    intensity="bright"
    :static="prefersReducedMotion"
  />
  <ThreeWeatherLayer
    v-else-if="weather"
    :weather="weather"
  />
</template>
