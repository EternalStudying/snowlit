<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type {
  WeatherAtmosphereData,
  WeatherState
} from '../model';
import type { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState, WeatherRenderer } from '../core/types';
import { getWeatherProfile } from '../profiles/weatherProfiles';

const props = defineProps<{
  weather: WeatherAtmosphereData;
}>();

const RAIN_FAMILY_STATES: WeatherState[] = ['drizzle', 'rain', 'heavyRain'];
const SNOW_FAMILY_STATES: WeatherState[] = ['lightSnow', 'snow', 'blizzard'];
const THREE_WEATHER_STATES: WeatherState[] = [
  'clear',
  'cloudy',
  ...RAIN_FAMILY_STATES,
  'storm',
  ...SNOW_FAMILY_STATES,
  'fog',
  'sandstorm',
  'aurora'
];
const MAX_FRAME_DELTA_SECONDS = 0.06;

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isReady = ref(false);

let renderer: WeatherRenderer | undefined;
let scene: import('three').Scene | undefined;
let camera: import('three').PerspectiveCamera | undefined;
let controller: WeatherController | undefined;
let clockStart = 0;
let lastFrameTime = 0;
let initLayerToken = 0;
let animationLoopActive = false;
let isLayerDisposed = false;

const pointer = { x: 0, y: 0 };
let scrollY = 0;

function updateSize() {
  if (!renderer || !camera) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function handlePointerMove(event: MouseEvent) {
  pointer.x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
  pointer.y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
}

function handleScroll() {
  scrollY = window.scrollY || document.documentElement.scrollTop || 0;
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    stopAnimationLoop();
    return;
  }

  if (document.visibilityState === 'visible') {
    lastFrameTime = performance.now();
    startAnimationLoop();
  }
}

function renderFrame(now: number) {
  if (!renderer || !scene || !camera || !controller) {
    return;
  }

  const delta = Math.min((now - lastFrameTime) / 1000, MAX_FRAME_DELTA_SECONDS);
  lastFrameTime = now;
  const frame: WeatherFrameState = {
    elapsed: (now - clockStart) / 1000,
    delta,
    pointer,
    scrollY
  };

  controller.update(frame);
  renderer.render(scene, camera);
}

function startAnimationLoop() {
  if (!renderer || animationLoopActive || document.visibilityState === 'hidden') {
    return;
  }

  lastFrameTime = performance.now();
  renderer.setAnimationLoop(renderFrame);
  animationLoopActive = true;
}

function stopAnimationLoop() {
  if (!renderer || !animationLoopActive) {
    return;
  }

  renderer.setAnimationLoop(null);
  animationLoopActive = false;
}



function applyWeatherProfileChange() {
  if (!controller || !THREE_WEATHER_STATES.includes(props.weather.weatherState)) {
    return;
  }

  controller.setWeatherProfile(getWeatherProfile({
    weatherState: props.weather.weatherState,
    weatherVariant: props.weather.weatherVariant,
    precipitationKind: props.weather.precipitationKind,
    daylightHint: props.weather.daylightHint
  }));
}

async function initWeatherLayer() {
  const canvas = canvasRef.value;

  if (!canvas || !THREE_WEATHER_STATES.includes(props.weather.weatherState)) {
    return;
  }

  isLayerDisposed = false;
  const token = ++initLayerToken;

  try {
    const [
      THREE,
      { createWeatherRenderer },
      { WeatherController },
      { WindSystem }
    ] = await Promise.all([
      import('three'),
      import('../core/createWeatherRenderer'),
      import('../core/WeatherController'),
      import('../core/WindSystem')
    ]);

    if (!isLayerInitActive(token, canvas)) {
      return;
    }

    const profile = getWeatherProfile({
      weatherState: props.weather.weatherState,
      weatherVariant: props.weather.weatherVariant,
      precipitationKind: props.weather.precipitationKind,
      daylightHint: props.weather.daylightHint
    });

    const renderResult = await createWeatherRenderer(canvas);

    if (!isLayerInitActive(token, canvas)) {
      renderResult.renderer.setAnimationLoop(null);
      renderResult.renderer.dispose();
      return;
    }

    renderer = renderResult.renderer;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);
    controller = new WeatherController(profile, new WindSystem(), {
      scene,
      camera
    });

    clockStart = performance.now();
    lastFrameTime = clockStart;

    window.addEventListener('resize', updateSize);
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    updateSize();
    handleScroll();
    startAnimationLoop();
    isReady.value = true;
  } catch (error) {
    disposeWeatherLayer();
    if (import.meta.env.DEV) {
      console.warn('Three.js weather failed to initialize', error);
    }
  }
}

function isLayerInitActive(token: number, canvas: HTMLCanvasElement) {
  return !isLayerDisposed && token === initLayerToken && canvasRef.value === canvas;
}


function disposeWeatherLayer() {
  isLayerDisposed = true;
  initLayerToken += 1;
  window.removeEventListener('resize', updateSize);
  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('scroll', handleScroll);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (renderer) {
    stopAnimationLoop();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  }
  controller?.dispose();
  renderer = undefined;
  scene = undefined;
  camera = undefined;
  controller = undefined;
  animationLoopActive = false;
  isReady.value = false;
}

onMounted(() => {
  void initWeatherLayer();
});

onUnmounted(disposeWeatherLayer);

watch(
  () =>
    [
      props.weather.weatherState,
      props.weather.weatherVariant,
      props.weather.precipitationKind,
      props.weather.daylightHint
    ] as const,
  () => {
    applyWeatherProfileChange();
  }
);
</script>

<template>
  <div
    class="three-weather-layer"
    :class="{ 'three-weather-layer--ready': isReady }"
    data-weather-engine="three"
    :data-weather-state="weather.weatherState"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="three-weather-layer__canvas"></canvas>
  </div>
</template>

<style scoped>
.three-weather-layer {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  opacity: 0;
  transition: opacity 680ms ease;
}

.three-weather-layer--ready {
  opacity: 1;
}

.three-weather-layer__canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
