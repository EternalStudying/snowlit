<script setup lang="ts">
import { computed } from 'vue';
import type { WeatherAtmosphereData } from '../model';
import type { LegacyWeatherKind } from '../core/types';
import { getWeatherProfile } from '../profiles/weatherProfiles';

type CloudConfig = {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  speed: number;
  phase: number;
  drift: number;
};

const CLOUDY_CLOUDS: CloudConfig[] = [
  { x: 0.1, y: 0.08, w: 340, h: 144, alpha: 0.62, speed: 16, phase: 0.2, drift: 1.2 },
  { x: 0.28, y: 0.06, w: 372, h: 156, alpha: 0.7, speed: 19, phase: 1.1, drift: 0.8 },
  { x: 0.52, y: 0.15, w: 334, h: 142, alpha: 0.64, speed: 17, phase: 2.2, drift: 1.1 },
  { x: 0.76, y: 0.11, w: 306, h: 132, alpha: 0.58, speed: 14, phase: 3.1, drift: 0.9 },
  { x: 0.04, y: 0.36, w: 404, h: 164, alpha: 0.56, speed: 12, phase: 4.4, drift: 1.3 },
  { x: 0.34, y: 0.32, w: 382, h: 154, alpha: 0.61, speed: 15, phase: 5.2, drift: 1 },
  { x: 0.7, y: 0.42, w: 352, h: 146, alpha: 0.57, speed: 13, phase: 6.3, drift: 1.15 }
];

const THUNDER_FLASHES = [
  { delay: '-1.1s', duration: 7.2 },
  { delay: '-4.8s', duration: 8.6 }
];

const WIND_LINES = Array.from({ length: 14 }, (_, index) => ({
  top: `${14 + (index % 7) * 8}%`,
  left: `${(index * 9) % 86}%`,
  width: `${72 + (index % 4) * 20}px`,
  duration: 4.6 + (index % 5) * 0.45,
  delay: `-${index * 0.38}s`
}));

const WIND_GUSTS = Array.from({ length: 9 }, (_, index) => ({
  top: `${10 + (index * 9.2) % 72}%`,
  left: `${-42 + (index % 3) * 4}vw`,
  width: `${380 + (index % 4) * 92}px`,
  height: `${54 + (index % 3) * 16}px`,
  duration: 7.6 + (index % 5) * 0.72,
  delay: `-${index * 0.82}s`,
  opacity: 0.23 + (index % 3) * 0.08,
  depth: index % 3 === 0 ? 'far' : index % 3 === 1 ? 'mid' : 'near',
  bend: `${-4 + (index % 5) * 2}deg`
}));

const WIND_SCRAPS = Array.from({ length: 12 }, (_, index) => ({
  top: `${18 + (index % 6) * 11}%`,
  left: `${(index * 8.2) % 92}%`,
  size: 8 + (index % 3) * 5,
  rotate: `${-18 + (index % 5) * 9}deg`,
  duration: 4.2 + (index % 4) * 0.4,
  delay: `-${index * 0.44}s`
}));

const FIREFLIES = Array.from({ length: 18 }, (_, index) => ({
  left: `${8 + (index * 4.9) % 86}%`,
  top: `${16 + (index * 6.8) % 52}%`,
  size: 4 + (index % 3) * 2,
  duration: 3.6 + (index % 5) * 0.6,
  delay: `-${index * 0.52}s`
}));

const LANTERN_GLOWS = [
  { left: '14%', top: '18%', size: '180px', duration: '5.6s', delay: '-1.2s' },
  { left: '78%', top: '28%', size: '164px', duration: '6.4s', delay: '-3.8s' }
];

const props = defineProps<{
  weather: WeatherAtmosphereData;
  isStatic?: boolean;
}>();

const prefersReducedMotion = computed(() => props.isStatic === true);

const weather = computed(() => props.weather);
const weatherProfile = computed(() =>
  getWeatherProfile({
    weatherState: props.weather.weatherState,
    weatherVariant: props.weather.weatherVariant
  })
);
const normalizedLegacyKind = computed<LegacyWeatherKind>(() => weatherProfile.value.legacyKind);
const showCloudLayer = computed(() =>
  ['cloudy', 'thunder', 'windy', 'night'].includes(normalizedLegacyKind.value)
);

const cloudVariant = computed(() => {
  switch (normalizedLegacyKind.value) {
    case 'thunder':
      return 'storm';
    case 'windy':
      return 'windy';
    case 'night':
      return 'night';
    default:
      return 'cloudy';
  }
});

const cloudConfigs = computed(() => {
  switch (normalizedLegacyKind.value) {
    case 'thunder':
      return CLOUDY_CLOUDS.slice(0, 5).map((cloud) => ({
        ...cloud,
        alpha: cloud.alpha * 0.86,
        speed: cloud.speed * 0.88
      }));
    case 'windy':
      return CLOUDY_CLOUDS.slice(0, 4).map((cloud) => ({
        ...cloud,
        alpha: cloud.alpha * 0.72,
        speed: cloud.speed * 1.18
      }));
    case 'night':
      return CLOUDY_CLOUDS.slice(0, 3).map((cloud) => ({
        ...cloud,
        alpha: cloud.alpha * 0.46,
        speed: cloud.speed * 0.78
      }));
    case 'cloudy':
    default:
      return CLOUDY_CLOUDS;
  }
});

function getCloudStyle(cloud: CloudConfig, index: number) {
  const duration = Math.max(10, Math.round(cloud.speed * 0.8));

  return {
    '--cloud-left': `${-cloud.w - 80 - index * 44}px`,
    '--cloud-top': `${cloud.y * 100}vh`,
    '--cloud-width': `${cloud.w}px`,
    '--cloud-height': `${cloud.h}px`,
    '--cloud-opacity': `${cloud.alpha}`,
    '--cloud-speed': `${duration}s`,
    '--cloud-delay': `${-cloud.phase * 2.8}s`,
    '--cloud-distance': `calc(100vw + ${cloud.w + 220 + index * 18}px)`,
    '--cloud-drift-y': `${cloud.drift}vh`
  };
}

</script>

<template>
  <div class="weather-atmosphere" :class="{ 'is-static': prefersReducedMotion }"
    :data-weather-state="weather.weatherState" :data-weather-kind="normalizedLegacyKind" :data-daytime="weather.daylightHint">
    <div v-if="showCloudLayer" class="weather-atmosphere__layer weather-atmosphere__cloud-layer" aria-hidden="true">
      <span v-for="(cloud, index) in cloudConfigs" :key="`${cloud.phase}-${cloud.speed}-${index}`" class="weather-cloud"
        :class="`weather-cloud--${cloudVariant}`" :style="getCloudStyle(cloud, index)">
        <span class="weather-cloud__body"></span>
        <span class="weather-cloud__puff weather-cloud__puff--a"></span>
        <span class="weather-cloud__puff weather-cloud__puff--b"></span>
        <span class="weather-cloud__puff weather-cloud__puff--c"></span>
        <span class="weather-cloud__puff weather-cloud__puff--d"></span>
      </span>
    </div>

    <div v-if="normalizedLegacyKind === 'thunder'" class="weather-atmosphere__layer weather-atmosphere__layer--thunder"
      aria-hidden="true">
      <span v-for="(flash, index) in THUNDER_FLASHES" :key="`flash-${index}`" class="weather-thunder-flash" :style="{
        '--flash-delay': flash.delay,
        '--flash-duration': `${flash.duration}s`
      }"></span>
      <span class="weather-thunder-mist"></span>
      <span class="weather-thunder-strike">
        <span class="weather-thunder-trunk"></span>
        <span class="weather-thunder-branch weather-thunder-branch--left-a"></span>
        <span class="weather-thunder-branch weather-thunder-branch--right-a"></span>
        <span class="weather-thunder-branch weather-thunder-branch--left-b"></span>
        <span class="weather-thunder-branch weather-thunder-branch--right-b"></span>
        <span class="weather-thunder-branch weather-thunder-branch--left-c"></span>
        <span class="weather-thunder-branch weather-thunder-branch--right-c"></span>
      </span>
      <span class="weather-thunder-cloud-mask"></span>
    </div>

    <div v-if="normalizedLegacyKind === 'windy'" class="weather-atmosphere__layer weather-atmosphere__layer--windy"
      aria-hidden="true">
      <span v-for="(gust, index) in WIND_GUSTS" :key="`wind-gust-${index}`" class="weather-wind-gust"
        :class="`weather-wind-gust--${gust.depth}`" :style="{
          '--gust-left': gust.left,
          '--gust-top': gust.top,
          '--gust-width': gust.width,
          '--gust-height': gust.height,
          '--gust-duration': `${gust.duration}s`,
          '--gust-delay': gust.delay,
          '--gust-opacity': `${gust.opacity}`,
          '--gust-bend': gust.bend
        }"></span>
      <span v-for="(line, index) in WIND_LINES" :key="`wind-line-${index}`" class="weather-wind-line" :style="{
        '--wind-left': line.left,
        '--wind-top': line.top,
        '--wind-width': line.width,
        '--wind-duration': `${line.duration}s`,
        '--wind-delay': line.delay
      }"></span>
      <span v-for="(scrap, index) in WIND_SCRAPS" :key="`scrap-${index}`" class="weather-wind-scrap" :style="{
        '--scrap-left': scrap.left,
        '--scrap-top': scrap.top,
        '--scrap-size': `${scrap.size}px`,
        '--scrap-rotate': scrap.rotate,
        '--scrap-duration': `${scrap.duration}s`,
        '--scrap-delay': scrap.delay
      }"></span>
    </div>

    <div v-if="normalizedLegacyKind === 'night'" class="weather-atmosphere__layer weather-atmosphere__layer--night"
      aria-hidden="true">
      <span class="weather-night-veil"></span>
      <span v-for="(glow, index) in LANTERN_GLOWS" :key="`lantern-${index}`" class="weather-lantern-glow" :style="{
        '--lantern-left': glow.left,
        '--lantern-top': glow.top,
        '--lantern-size': glow.size,
        '--lantern-duration': glow.duration,
        '--lantern-delay': glow.delay
      }"></span>
      <span v-for="(bug, index) in FIREFLIES" :key="`firefly-${index}`" class="weather-firefly" :style="{
        '--bug-left': bug.left,
        '--bug-top': bug.top,
        '--bug-size': `${bug.size}px`,
        '--bug-duration': `${bug.duration}s`,
        '--bug-delay': bug.delay
      }"></span>
    </div>
  </div>
</template>

<style scoped>
.weather-atmosphere {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
}

.weather-atmosphere__layer {
  position: fixed;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
}

.weather-atmosphere.is-static .weather-atmosphere__layer * {
  animation: none !important;
}

.weather-atmosphere__cloud-layer {
  z-index: 2;
}

.weather-cloud {
  position: absolute;
  left: var(--cloud-left);
  top: var(--cloud-top);
  width: var(--cloud-width);
  height: var(--cloud-height);
  opacity: var(--cloud-opacity);
  pointer-events: none;
  filter: drop-shadow(0 18px 24px rgba(108, 120, 138, 0.16));
  animation: weather-cloud-drift calc(var(--cloud-speed) * 1.8) linear infinite;
  animation-delay: var(--cloud-delay);
}

.weather-cloud__body,
.weather-cloud__puff {
  position: absolute;
  border-radius: 999px;
  background:
    radial-gradient(circle at 40% 34%, rgba(255, 255, 255, 0.78), rgba(247, 250, 255, 0.56) 38%, rgba(224, 232, 242, 0.3) 70%, transparent 100%);
  box-shadow:
    inset 0 -16px 24px rgba(122, 136, 154, 0.22),
    inset 0 10px 18px rgba(255, 255, 255, 0.28);
  filter: blur(6px);
}

.weather-cloud__body {
  inset: 30% 10% 8% 12%;
}

.weather-cloud__puff--a {
  left: 8%;
  top: 28%;
  width: 34%;
  height: 38%;
}

.weather-cloud__puff--b {
  left: 26%;
  top: 12%;
  width: 36%;
  height: 46%;
}

.weather-cloud__puff--c {
  left: 48%;
  top: 18%;
  width: 30%;
  height: 40%;
}

.weather-cloud__puff--d {
  left: 62%;
  top: 30%;
  width: 24%;
  height: 30%;
}

.weather-cloud--storm {
  filter: drop-shadow(0 22px 34px rgba(50, 62, 86, 0.34));
}

.weather-cloud--storm .weather-cloud__body,
.weather-cloud--storm .weather-cloud__puff {
  background:
    radial-gradient(circle at 38% 30%, rgba(220, 230, 244, 0.72), rgba(158, 172, 194, 0.58) 42%, rgba(62, 76, 104, 0.52) 78%, transparent 100%);
  box-shadow:
    inset 0 -20px 28px rgba(42, 54, 82, 0.32),
    inset 0 10px 16px rgba(242, 247, 255, 0.18);
}

.weather-cloud--windy {
  filter: drop-shadow(0 14px 18px rgba(110, 126, 144, 0.12));
}

.weather-cloud--windy .weather-cloud__body,
.weather-cloud--windy .weather-cloud__puff {
  background:
    radial-gradient(circle at 40% 34%, rgba(248, 250, 255, 0.62), rgba(231, 238, 245, 0.42) 38%, rgba(214, 223, 235, 0.22) 74%, transparent 100%);
}

.weather-cloud--night {
  filter: drop-shadow(0 12px 18px rgba(32, 28, 42, 0.18));
}

.weather-cloud--night .weather-cloud__body,
.weather-cloud--night .weather-cloud__puff {
  background:
    radial-gradient(circle at 40% 34%, rgba(190, 201, 226, 0.42), rgba(118, 128, 154, 0.32) 42%, rgba(58, 64, 90, 0.26) 78%, transparent 100%);
}

.weather-atmosphere__layer--thunder {
  z-index: 3;
}

.weather-thunder-flash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 69% 24%, rgba(255, 239, 180, 0.26), transparent 22%),
    radial-gradient(circle at 72% 30%, rgba(133, 188, 255, 0.22), transparent 30%),
    linear-gradient(180deg, rgba(255, 231, 164, 0.1), transparent 62%);
  opacity: 0;
  animation: weather-thunder-flash var(--flash-duration) ease-in-out infinite;
  animation-delay: var(--flash-delay);
}

.weather-thunder-mist {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 68% 34%, rgba(255, 216, 118, 0.12), transparent 28%),
    linear-gradient(112deg, transparent 48%, rgba(126, 172, 218, 0.12) 49%, transparent 56%),
    linear-gradient(106deg, transparent 57%, rgba(126, 172, 218, 0.1) 58%, transparent 64%);
  opacity: 0.72;
}

.weather-thunder-strike {
  position: absolute;
  left: 62%;
  top: 15vh;
  z-index: 3;
  width: 220px;
  height: min(58vh, 430px);
  min-height: 320px;
  opacity: 0;
  transform: rotate(2deg) scale(0.96);
  transform-origin: 48% 12%;
  filter:
    drop-shadow(0 0 8px rgba(255, 244, 202, 0.88))
    drop-shadow(0 0 24px rgba(246, 198, 72, 0.46))
    drop-shadow(0 0 34px rgba(114, 179, 255, 0.34));
  animation: weather-thunder-strike 7.2s ease-in-out infinite;
  animation-delay: -1.1s;
}

.weather-thunder-trunk,
.weather-thunder-trunk::before,
.weather-thunder-trunk::after,
.weather-thunder-branch,
.weather-thunder-branch::before,
.weather-thunder-branch::after {
  content: "";
  position: absolute;
}

.weather-thunder-trunk {
  left: 68px;
  top: 0;
  width: 84px;
  height: 100%;
}

.weather-thunder-trunk::before,
.weather-thunder-trunk::after {
  inset: 0;
  clip-path: polygon(46% 0, 72% 0, 58% 24%, 79% 24%, 52% 52%, 69% 52%, 24% 100%, 38% 60%, 17% 60%, 42% 34%, 28% 34%);
}

.weather-thunder-trunk::before {
  z-index: 2;
  background: linear-gradient(180deg, #fffdf0 0%, #ffe28d 44%, #fff7cc 58%, #f0bd34 100%);
}

.weather-thunder-trunk::after {
  z-index: 1;
  background: rgba(120, 189, 255, 0.46);
  filter: blur(10px);
  transform: scale(1.5);
}

.weather-thunder-branch {
  width: var(--branch-width);
  height: var(--branch-height, 34px);
  left: var(--branch-left);
  top: var(--branch-top);
  transform: rotate(var(--branch-rotate));
  transform-origin: var(--branch-origin, 12% 46%);
}

.weather-thunder-branch::before,
.weather-thunder-branch::after {
  inset: 0;
  clip-path: polygon(0 38%, 58% 34%, 48% 0, 100% 54%, 44% 55%, 56% 100%);
}

.weather-thunder-branch::before {
  z-index: 2;
  background: linear-gradient(90deg, rgba(255, 253, 231, 0.95), rgba(246, 205, 87, 0.9));
}

.weather-thunder-branch::after {
  z-index: 1;
  background: rgba(128, 194, 255, 0.34);
  filter: blur(6px);
  transform: scale(1.4);
}

.weather-thunder-branch--left-a {
  --branch-left: 38px;
  --branch-top: 24%;
  --branch-width: 76px;
  --branch-height: 38px;
  --branch-rotate: 202deg;
}

.weather-thunder-branch--right-a {
  --branch-left: 118px;
  --branch-top: 31%;
  --branch-width: 64px;
  --branch-height: 32px;
  --branch-rotate: -8deg;
}

.weather-thunder-branch--left-b {
  --branch-left: 28px;
  --branch-top: 42%;
  --branch-width: 48px;
  --branch-height: 28px;
  --branch-rotate: 218deg;
}

.weather-thunder-branch--right-b {
  --branch-left: 116px;
  --branch-top: 52%;
  --branch-width: 90px;
  --branch-height: 40px;
  --branch-rotate: 18deg;
}

.weather-thunder-branch--left-c {
  --branch-left: 44px;
  --branch-top: 64%;
  --branch-width: 58px;
  --branch-height: 30px;
  --branch-rotate: 196deg;
}

.weather-thunder-branch--right-c {
  --branch-left: 110px;
  --branch-top: 76%;
  --branch-width: 42px;
  --branch-height: 26px;
  --branch-rotate: 32deg;
}

.weather-thunder-cloud-mask {
  position: absolute;
  left: 53%;
  top: 6vh;
  z-index: 4;
  width: min(430px, 40vw);
  height: 168px;
  border-radius: 46% 54% 44% 50%;
  background:
    radial-gradient(ellipse at 18% 56%, rgba(82, 96, 124, 0.72), transparent 42%),
    radial-gradient(ellipse at 44% 42%, rgba(96, 110, 136, 0.72), transparent 42%),
    radial-gradient(ellipse at 75% 58%, rgba(65, 78, 106, 0.68), transparent 44%),
    linear-gradient(180deg, rgba(138, 151, 172, 0.18), rgba(48, 60, 88, 0.54) 58%, rgba(38, 49, 76, 0.46) 100%);
  box-shadow:
    inset 0 -26px 34px rgba(28, 38, 64, 0.32),
    0 20px 32px rgba(52, 64, 92, 0.2);
  filter: blur(5px);
}

.weather-thunder-cloud-mask::before,
.weather-thunder-cloud-mask::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.weather-thunder-cloud-mask::before {
  left: -12%;
  right: -8%;
  bottom: 24px;
  height: 98px;
  border-radius: 999px;
  background:
    radial-gradient(ellipse at 10% 58%, rgba(66, 78, 108, 0.58), transparent 34%),
    radial-gradient(ellipse at 32% 44%, rgba(92, 106, 132, 0.62), transparent 38%),
    radial-gradient(ellipse at 58% 56%, rgba(58, 70, 100, 0.6), transparent 36%),
    radial-gradient(ellipse at 86% 48%, rgba(78, 90, 116, 0.5), transparent 36%);
  filter: blur(9px);
}

.weather-thunder-cloud-mask::after {
  left: -4%;
  right: 2%;
  bottom: -10px;
  height: 78px;
  border-radius: 48%;
  background:
    radial-gradient(ellipse at 18% 28%, rgba(92, 106, 132, 0.34), transparent 42%),
    radial-gradient(ellipse at 46% 24%, rgba(48, 60, 88, 0.46), transparent 42%),
    radial-gradient(ellipse at 72% 32%, rgba(42, 54, 82, 0.42), transparent 44%),
    linear-gradient(180deg, rgba(62, 74, 102, 0.18), rgba(32, 42, 68, 0));
  filter: blur(13px);
}

.weather-atmosphere.is-static .weather-atmosphere__layer--thunder .weather-thunder-flash {
  opacity: 0.16;
}

.weather-atmosphere.is-static .weather-atmosphere__layer--thunder .weather-thunder-strike {
  opacity: 0.86;
  transform: rotate(2deg) scale(1);
}

.weather-atmosphere__layer--windy {
  z-index: 3;
}

.weather-wind-gust {
  position: absolute;
  left: var(--gust-left);
  top: var(--gust-top);
  width: var(--gust-width);
  height: var(--gust-height);
  --gust-line-width: 2.6px;
  border-top: var(--gust-line-width) solid rgba(235, 247, 252, var(--gust-opacity));
  border-radius: 58% 42% 0 0;
  background: linear-gradient(90deg, transparent, rgba(242, 250, 255, 0.14) 28%, transparent 72%) 16% 42% / 64% 2px no-repeat;
  filter: drop-shadow(0 0 3px rgba(220, 240, 248, 0.16));
  opacity: 0;
  transform: translate3d(-18vw, 0, 0) rotate(var(--gust-bend));
  animation: weather-wind-gust-flow var(--gust-duration) cubic-bezier(0.32, 0.04, 0.22, 1) infinite;
  animation-delay: var(--gust-delay);
}

.weather-wind-gust::before,
.weather-wind-gust::after {
  content: '';
  position: absolute;
  height: 58%;
  border-top: var(--gust-line-width) solid rgba(235, 247, 252, var(--gust-opacity));
  border-radius: 58% 42% 0 0;
  pointer-events: none;
}

.weather-wind-gust::before {
  left: 12%;
  top: 18%;
  width: 64%;
}

.weather-wind-gust::after {
  right: 10%;
  top: 50%;
  width: 42%;
}

.weather-wind-gust--far {
  --gust-line-width: 1.6px;
  filter: blur(0.55px);
}

.weather-wind-gust--near {
  --gust-line-width: 3.2px;
  filter:
    drop-shadow(0 0 7px rgba(220, 240, 248, 0.34))
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.18));
}

.weather-wind-line {
  position: absolute;
  left: var(--wind-left);
  top: var(--wind-top);
  width: var(--wind-width);
  height: 28px;
  border-top: 2px solid rgba(210, 225, 238, 0.34);
  border-radius: 50%;
  filter: blur(0.2px);
  animation: weather-wind-sweep var(--wind-duration) linear infinite;
  animation-delay: var(--wind-delay);
}

.weather-wind-scrap {
  position: absolute;
  left: var(--scrap-left);
  top: var(--scrap-top);
  width: var(--scrap-size);
  height: calc(var(--scrap-size) * 0.62);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(233, 221, 198, 0.42), rgba(145, 176, 122, 0.28));
  transform: rotate(var(--scrap-rotate));
  filter: blur(0.3px);
  animation: weather-wind-scrap-fly var(--scrap-duration) linear infinite;
  animation-delay: var(--scrap-delay);
}

.weather-atmosphere__layer--night {
  z-index: 2;
}

.weather-night-veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(14, 22, 40, 0.24), rgba(32, 24, 44, 0.28)),
    radial-gradient(circle at 50% 42%, rgba(72, 64, 98, 0.08), transparent 42%);
}

.weather-lantern-glow {
  position: absolute;
  left: var(--lantern-left);
  top: var(--lantern-top);
  width: var(--lantern-size);
  height: var(--lantern-size);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 188, 120, 0.24), rgba(255, 188, 120, 0.08) 46%, transparent 76%);
  filter: blur(12px);
  animation: weather-lantern-breathe var(--lantern-duration) ease-in-out infinite;
  animation-delay: var(--lantern-delay);
}

.weather-firefly {
  position: absolute;
  left: var(--bug-left);
  top: var(--bug-top);
  width: var(--bug-size);
  height: var(--bug-size);
  border-radius: 50%;
  background: rgba(247, 228, 150, 0.68);
  box-shadow: 0 0 14px rgba(247, 228, 150, 0.48);
  animation: weather-firefly-float var(--bug-duration) ease-in-out infinite;
  animation-delay: var(--bug-delay);
}

@keyframes weather-cloud-drift {
  0% {
    transform: translate3d(0, 0.1vh, 0);
    opacity: calc(var(--cloud-opacity) * 0.82);
  }

  12% {
    opacity: var(--cloud-opacity);
  }

  50% {
    transform: translate3d(calc(var(--cloud-distance) * 0.52), calc(var(--cloud-drift-y) * -1), 0);
    opacity: var(--cloud-opacity);
  }

  88% {
    opacity: var(--cloud-opacity);
  }

  100% {
    transform: translate3d(var(--cloud-distance), calc(var(--cloud-drift-y) * 0.5), 0);
    opacity: calc(var(--cloud-opacity) * 0.8);
  }
}

@keyframes weather-thunder-flash {

  0%,
  5%,
  15%,
  42%,
  100% {
    opacity: 0;
  }

  7% {
    opacity: 0.2;
  }

  8% {
    opacity: 0.5;
  }

  10% {
    opacity: 0.14;
  }

  12% {
    opacity: 0.42;
  }
}

@keyframes weather-thunder-strike {

  0%,
  5%,
  15%,
  42%,
  100% {
    opacity: 0;
    transform: rotate(2deg) scale(0.96);
  }

  7% {
    opacity: 0.24;
    transform: rotate(2deg) scale(0.98);
  }

  8% {
    opacity: 1;
    transform: rotate(2deg) scale(1);
  }

  10% {
    opacity: 0.34;
  }

  12% {
    opacity: 0.88;
    transform: rotate(2deg) scale(1.01);
  }

  16% {
    opacity: 0.18;
    transform: rotate(2deg) scale(0.99);
  }
}

@keyframes weather-wind-sweep {
  0% {
    transform: translateX(-12vw) rotate(0deg);
    opacity: 0;
  }

  20%,
  80% {
    opacity: 0.34;
  }

  100% {
    transform: translateX(24vw) rotate(-8deg);
    opacity: 0;
  }
}

@keyframes weather-wind-gust-flow {
  0% {
    transform: translate3d(-18vw, 0, 0) rotate(var(--gust-bend));
    opacity: 0;
  }

  16%,
  78% {
    opacity: var(--gust-opacity);
  }

  100% {
    transform: translate3d(150vw, -1.8vh, 0) rotate(calc(var(--gust-bend) - 4deg));
    opacity: 0;
  }
}

@keyframes weather-wind-scrap-fly {
  0% {
    transform: translate3d(-14vw, 0, 0) rotate(var(--scrap-rotate));
    opacity: 0;
  }

  20%,
  82% {
    opacity: 0.8;
  }

  100% {
    transform: translate3d(22vw, -1.2vh, 0) rotate(calc(var(--scrap-rotate) + 18deg));
    opacity: 0;
  }
}

@keyframes weather-firefly-float {

  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(0.92);
    opacity: 0.28;
  }

  50% {
    transform: translate3d(1.6vw, -1vh, 0) scale(1.12);
    opacity: 0.9;
  }
}

@keyframes weather-lantern-breathe {

  0%,
  100% {
    opacity: 0.42;
    transform: scale(0.96);
  }

  50% {
    opacity: 0.74;
    transform: scale(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .weather-atmosphere__layer * {
    animation: none !important;
  }
}
</style>
