<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type {
  WeatherAtmosphereData,
  WeatherState
} from '../model';
import type { WeatherController } from '../core/WeatherController';
import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRenderer,
  WeatherRuntimeState
} from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';
import { getWeatherProfile } from '../profiles/weatherProfiles';

type WeatherScene = {
  setProfile(profile: WeatherProfile): void;
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
};

type WeatherSceneFamily = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'sandstorm' | 'aurora';

const props = defineProps<{
  weather: WeatherAtmosphereData;
  weatherState: WeatherState;
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
let weatherScene: WeatherScene | undefined;
let currentSceneFamily: WeatherSceneFamily | null = null;
let clockStart = 0;
let lastFrameTime = 0;
let initLayerToken = 0;
let sceneLoadToken = 0;
let animationLoopActive = false;
let isLayerDisposed = false;

const pointer = { x: 0, y: 0 };
let scrollY = 0;

function hasBrowserGlobals() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function updateSize() {
  if (!renderer || !camera || !hasBrowserGlobals()) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function handlePointerMove(event: MouseEvent) {
  if (!hasBrowserGlobals()) {
    return;
  }

  pointer.x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
  pointer.y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
}

function handleScroll() {
  if (!hasBrowserGlobals()) {
    return;
  }

  scrollY = window.scrollY || document.documentElement.scrollTop || 0;
}

function handleVisibilityChange() {
  if (!hasBrowserGlobals()) {
    return;
  }

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
  if (!renderer || !scene || !camera || !controller || !weatherScene) {
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

  const runtime = controller.update(frame);
  weatherScene.update(frame, runtime);
  renderer.render(scene, camera);
}

function startAnimationLoop() {
  if (!renderer || animationLoopActive || !hasBrowserGlobals() || document.visibilityState === 'hidden') {
    return;
  }

  lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
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

function getWeatherSceneFamily(weatherState: WeatherState): WeatherSceneFamily | null {
  if (weatherState === 'clear') {
    return 'clear';
  }

  if (weatherState === 'cloudy') {
    return 'cloudy';
  }

  if (RAIN_FAMILY_STATES.includes(weatherState)) {
    return 'rain';
  }

  if (SNOW_FAMILY_STATES.includes(weatherState)) {
    return 'snow';
  }

  if (weatherState === 'storm' || weatherState === 'fog' || weatherState === 'sandstorm') {
    return weatherState;
  }

  if (weatherState === 'aurora') {
    return 'aurora';
  }

  return null;
}

async function loadWeatherScene(profile: WeatherProfile) {
  if (!scene || !camera || !controller) {
    return;
  }

  const activeController = controller;
  const nextSceneFamily = getWeatherSceneFamily(profile.weatherState);

  if (!nextSceneFamily) {
    return;
  }

  const token = ++sceneLoadToken;
  let nextScene: WeatherScene;

  try {
    if (!isSceneLoadActive(token, activeController) || currentSceneFamily !== null) {
      return;
    }

    if (profile.weatherState === 'aurora') {
      const { AuroraWeatherScene } = await import('../effects/aurora/AuroraWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new AuroraWeatherScene(activeController, profile);
    } else if (profile.weatherState === 'cloudy') {
      const { CloudyWeatherScene } = await import('../effects/cloudy/CloudyWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new CloudyWeatherScene(activeController, profile);
    } else if (profile.weatherState === 'sandstorm') {
      const { SandstormWeatherScene } = await import('../effects/sandstorm/SandstormWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new SandstormWeatherScene(activeController, profile);
    } else if (profile.weatherState === 'fog') {
      const { FogWeatherScene } = await import('../effects/fog/FogWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new FogWeatherScene(activeController, profile);
    } else if (profile.weatherState === 'storm') {
      const { StormWeatherScene } = await import('../effects/storm/StormWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new StormWeatherScene(activeController, profile);
    } else if (SNOW_FAMILY_STATES.includes(profile.weatherState)) {
      const { SnowWeatherScene } = await import('../effects/snow/SnowWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new SnowWeatherScene(activeController, profile);
    } else if (RAIN_FAMILY_STATES.includes(profile.weatherState)) {
      const { RainWeatherScene } = await import('../effects/rain/RainWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new RainWeatherScene(activeController, profile);
    } else {
      const { SunnyWeatherScene } = await import('../effects/sunny/SunnyWeatherScene');
      if (!isSceneLoadActive(token, activeController)) return;
      nextScene = new SunnyWeatherScene(activeController, profile);
    }
  } catch (error) {
    warnWeatherLayerLoadFailure('ThreeWeatherLayer scene adapter', error);
    return;
  }

  if (!isSceneLoadActive(token, activeController)) {
    nextScene.dispose();
    return;
  }

  weatherScene = nextScene;
  currentSceneFamily = nextSceneFamily;
  weatherScene.setProfile(profile);
}

async function applyWeatherProfileChange() {
  if (!controller) {
    return;
  }

  const nextProfile = getWeatherProfile({
    weatherState: props.weatherState,
    weatherVariant: props.weather.weatherVariant,
    precipitationKind: props.weather.precipitationKind,
    daylightHint: props.weather.daylightHint
  });
  const nextSceneFamily = getWeatherSceneFamily(nextProfile.weatherState);

  if (!nextSceneFamily) {
    return;
  }

  controller.setWeatherProfile(nextProfile);

  if (weatherScene && currentSceneFamily === nextSceneFamily) {
    weatherScene.setProfile(nextProfile);
    return;
  }

  weatherScene?.dispose();
  weatherScene = undefined;
  currentSceneFamily = null;
  await loadWeatherScene(nextProfile);
}

async function initWeatherLayer() {
  const canvas = canvasRef.value;

  if (!canvas || !THREE_WEATHER_STATES.includes(props.weatherState)) {
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
      weatherState: props.weatherState,
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
    await loadWeatherScene(profile);

    if (!isLayerInitActive(token, canvas) || !renderer || !scene || !camera || !controller || !weatherScene) {
      disposeWeatherLayer();
      return;
    }

    clockStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    lastFrameTime = clockStart;

    if (!hasBrowserGlobals()) {
      disposeWeatherLayer();
      return;
    }

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

function isSceneLoadActive(token: number, activeController: WeatherController) {
  return !isLayerDisposed && token === sceneLoadToken && controller === activeController && Boolean(scene && camera);
}

function disposeWeatherLayer() {
  isLayerDisposed = true;
  initLayerToken += 1;
  sceneLoadToken += 1;
  if (hasBrowserGlobals()) {
    window.removeEventListener('resize', updateSize);
    window.removeEventListener('mousemove', handlePointerMove);
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
  if (renderer) {
    stopAnimationLoop();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  }
  weatherScene?.dispose();
  controller?.dispose();
  renderer = undefined;
  scene = undefined;
  camera = undefined;
  controller = undefined;
  weatherScene = undefined;
  currentSceneFamily = null;
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
      props.weatherState,
      props.weather.weatherVariant,
      props.weather.precipitationKind,
      props.weather.daylightHint
    ] as const,
  () => {
    void applyWeatherProfileChange();
  }
);
</script>

<template>
  <div
    class="three-weather-layer"
    :class="{ 'three-weather-layer--ready': isReady }"
    data-weather-engine="three"
    :data-weather-state="weatherState"
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
