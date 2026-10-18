<script setup lang="ts">
import { useReducedMotion } from '../../motion';
import './about.css';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

type AboutStation = {
  id: 'album' | 'diary' | 'wishes' | 'messages' | 'anniversary';
  label: string;
  title: string;
  poeticLine: string;
  description: string;
  to?: string;
  enabled: boolean;
  pendingMessage?: string;
  x: number;
  y: number;
};

const stations: AboutStation[] = [
  {
    id: 'album',
    label: '相册',
    title: '相册星',
    poeticLine: '把某个普通下午，装进不会褪色的相纸里。',
    description: '相册用来保存你们一起拍下的照片、当时的小备注和后来还想回看的画面。',
    to: '/album',
    enabled: true,
    x: 13,
    y: 68
  },
  {
    id: 'diary',
    label: '日记',
    title: '日记星',
    poeticLine: '记录那些没有被拍下来的心情。',
    description: '日记给两个人留下每天的小事、想法、天气和只有彼此懂的片段。',
    to: '/diary',
    enabled: true,
    x: 34,
    y: 44
  },
  {
    id: 'wishes',
    label: '清单',
    title: '清单星',
    poeticLine: '把想去的地方和想做的事排成星路。',
    description: '清单放着想去、想做和已经完成的约定，让下一次出发有迹可循。',
    to: '/wishes',
    enabled: true,
    x: 52,
    y: 35
  },
  {
    id: 'messages',
    label: '留言',
    title: '留言星',
    poeticLine: '轻声说出的话，也应该有地方停靠。',
    description: '留言保存那些临时想留下的话，不需要很正式，却能在之后被重新看见。',
    to: '/messages',
    enabled: true,
    x: 72,
    y: 56
  },
  {
    id: 'anniversary',
    label: '纪念日',
    title: '纪念日星',
    poeticLine: '有些重要日子，还在等一颗星被正式命名。',
    description: '纪念日会用来整理属于你们的日期、倒计时和每一年重新点亮的时刻。',
    enabled: false,
    pendingMessage: '纪念日页面还在准备中',
    x: 87,
    y: 23
  }
];

const pageRef = ref<HTMLElement | null>(null);
const activeIndex = ref(0);
const scrollProgress = ref(0);
const toastMessage = ref('');
const reducedMotion = useReducedMotion();
let toastTimer: number | undefined;

const activeStation = computed(() => stations[activeIndex.value] || stations[0]);
const routeProgress = computed(() => {
  if (reducedMotion.value) {
    return 1;
  }

  return Math.min(1, Math.max(0, scrollProgress.value));
});
const routeDashOffset = computed(() => `${Math.max(0, 1 - routeProgress.value) * 1000}`);

function setActiveStation(index: number) {
  activeIndex.value = Math.min(stations.length - 1, Math.max(0, index));
}

function updateFromScroll() {
  const element = pageRef.value;
  if (!element) {
    return;
  }

  const maxScroll = Math.max(1, element.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));

  scrollProgress.value = progress;
  setActiveStation(Math.round(progress * (stations.length - 1)));
}

function showPendingMessage(message: string) {
  toastMessage.value = message;

  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toastMessage.value = '';
    toastTimer = undefined;
  }, 2200);
}

function handlePendingStation(station: AboutStation) {
  if (station.pendingMessage) {
    showPendingMessage(station.pendingMessage);
  }
}

onMounted(() => {
  updateFromScroll();
  window.addEventListener('scroll', updateFromScroll, { passive: true });
  window.addEventListener('resize', updateFromScroll);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateFromScroll);
  window.removeEventListener('resize', updateFromScroll);

  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
  }
});
</script>

<template>
  <main
    ref="pageRef"
    class="about-starmap-page"
    :data-active-station="activeStation.id"
    :data-reduced-motion="String(reducedMotion)"
    aria-labelledby="about-starmap-title"
  >
    <RouterLink class="about-starmap__return" to="/">← 返回首页</RouterLink>

    <section class="about-starmap__viewport">
      <div class="about-starmap__sky" aria-hidden="true">
        <span v-for="index in 34" :key="index" class="about-starmap__star"></span>
      </div>

      <div class="about-starmap__intro">
        <p>Snowlit 星图导览</p>
        <h1 id="about-starmap-title">这是一片只属于你们的记忆星空</h1>
        <span>
          往下滚动，沿着被点亮的星轨，经过 Snowlit 保存照片、日记、清单、留言和纪念日的地方。
        </span>
      </div>

      <svg class="about-starmap__route" viewBox="0 0 100 80" aria-hidden="true">
        <path
          class="about-starmap__route-base"
          d="M13 68 C 25 22, 40 63, 52 35 S 64 31, 72 56 S 82 62, 87 23"
        />
        <path
          class="about-starmap__route-progress"
          d="M13 68 C 25 22, 40 63, 52 35 S 64 31, 72 56 S 82 62, 87 23"
          :style="{ strokeDashoffset: routeDashOffset }"
        />
      </svg>

      <div class="about-starmap__stations" aria-label="Snowlit 空间站点">
        <template v-for="(station, index) in stations" :key="station.id">
          <RouterLink
            v-if="station.enabled && station.to"
            class="about-starmap__station"
            :class="{ 'is-active': station.id === activeStation.id }"
            :to="station.to"
            :data-station="station.id"
            :style="{ '--station-x': `${station.x}%`, '--station-y': `${station.y}%` }"
            :aria-current="station.id === activeStation.id ? 'step' : undefined"
            @focus="setActiveStation(index)"
            @mouseenter="setActiveStation(index)"
          >
            <span class="about-starmap__station-core"></span>
            <span class="about-starmap__station-label">{{ station.label }}</span>
            <span hidden>{{ station.poeticLine }}</span>
            <span hidden>{{ station.description }}</span>
          </RouterLink>

          <button
            v-else
            class="about-starmap__station about-starmap__station--pending"
            :class="{ 'is-active': station.id === activeStation.id }"
            type="button"
            :data-station="station.id"
            :style="{ '--station-x': `${station.x}%`, '--station-y': `${station.y}%` }"
            :aria-current="station.id === activeStation.id ? 'step' : undefined"
            :aria-label="station.pendingMessage ? `${station.label}，${station.pendingMessage}` : station.label"
            @focus="setActiveStation(index)"
            @mouseenter="setActiveStation(index)"
            @click="handlePendingStation(station)"
          >
            <span class="about-starmap__station-core"></span>
            <span class="about-starmap__station-label">{{ station.label }}</span>
            <span hidden>{{ station.poeticLine }}</span>
            <span hidden>{{ station.description }}</span>
          </button>
        </template>
      </div>

      <article class="about-starmap__card" :data-active-station="activeStation.id">
        <p>当前站点</p>
        <h2>{{ activeStation.title }}</h2>
        <strong>{{ activeStation.poeticLine }}</strong>
        <span>{{ activeStation.description }}</span>
      </article>

      <p v-if="toastMessage" class="about-starmap__toast" role="status">{{ toastMessage }}</p>
    </section>
  </main>
</template>
