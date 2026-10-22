<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import partnerAAvatar from '../assets/couple-avatars/partner-a.webp';
import partnerBAvatar from '../assets/couple-avatars/partner-b.webp';
import SiteRecordLink from '../components/SiteRecordLink.vue';
import { scrollToWithSmoothScroll } from '../composables/useSmoothScroll';
import { shouldSkipMotion } from '../motion';
import { useHomeLifecycle } from '../modules/home';
import { preserveNextRouteScrollPosition } from '../navigation/routeScrollPolicy';
import { journalHeroSlides } from './journalHeroSlides';
import './snow-shell.css';
import { burstPetals, startAmbientDrift, type AmbientDrift } from './world/ambientDrift';
import { useEveningWorld } from './world/useEveningWorld';

/*
 * The frame every page sits in: the painted cover, a wooden plaque of links hanging from it, the evening
 * sky behind the page and petals drifting over it. The plaque docks at the top by itself (position: sticky).
 */

const { overview: home } = useHomeLifecycle().state;
const route = useRoute();

const shellRef = ref<HTMLElement | null>(null);
const coverRef = ref<HTMLElement | null>(null);
const plaqueRef = ref<HTMLElement | null>(null);
const boardRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const heartRef = ref<HTMLElement | null>(null);

const navItems = [
  { to: '/messages', label: '留言', icon: 'M4 5h16v11H9l-5 4z' },
  { to: '/diary', label: '日记', icon: 'M12 6v14M4 5h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5v13h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4z' },
  { to: '/', label: '首页', icon: 'M3 11 12 4l9 7v9h-6v-6H9v6H3z' },
  { to: '/album', label: '相册', icon: 'M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5' },
  { to: '/wishes', label: '清单', icon: 'M5 4h14v16l-7-4-7 4z' }
];

const couple = computed(() => [
  { name: home.value?.couple.boyfriendName || '伴侣 A', avatar: partnerAAvatar },
  { name: home.value?.couple.girlfriendName || '伴侣 B', avatar: partnerBAvatar }
]);

// Home is the first page rebuilt for the evening; the others keep their light ground until their turn.
const isHome = computed(() => route.path === '/');
const isEvening = isHome;

const world = useEveningWorld({ shell: shellRef, cover: coverRef, board: boardRef, isEvening });

let drift: AmbientDrift | null = null;
onMounted(() => {
  if (!shouldSkipMotion() && canvasRef.value) {
    drift = startAmbientDrift(canvasRef.value);
  }
});
onBeforeUnmount(() => drift?.stop());

function isPlainClick(event: MouseEvent) {
  return (event.button ?? 0) === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

/** Where the page starts once the plaque has docked: just past the cover. */
function dockScrollTarget() {
  const cover = coverRef.value;
  return cover ? Math.max(0, cover.offsetTop + cover.offsetHeight - 76) : 0;
}

function scrollToDock() {
  scrollToWithSmoothScroll(dockScrollTarget(), 0, {
    immediate: shouldSkipMotion(),
    behavior: shouldSkipMotion() ? 'auto' : 'smooth',
    duration: 0.9
  });
}

let scrollAfterRoute = false;
function handleNavClick(to: string, event: MouseEvent) {
  if (!isPlainClick(event)) {
    return;
  }
  if (to === route.path) {
    event.preventDefault();
    scrollToDock();
    return;
  }
  // Keep the reader where they are while the page changes underneath, then settle just below the plaque.
  preserveNextRouteScrollPosition();
  scrollAfterRoute = true;
}

watch(
  () => route.path,
  async () => {
    await nextTick();
    world.moveLantern();
    if (scrollAfterRoute) {
      scrollAfterRoute = false;
      scrollToDock();
    }
  }
);

function scatterFromHeart() {
  const rect = heartRef.value?.getBoundingClientRect();
  if (rect) {
    burstPetals(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  world.beatHeart(heartRef.value);
}
</script>

<template>
  <div ref="shellRef" class="snow-shell" :data-world="isEvening ? 'evening' : 'paper'">
    <div v-if="isEvening" class="snow-sky" aria-hidden="true">
      <div class="snow-sky__wash snow-sky__wash--dusk"></div>
      <div class="snow-sky__wash snow-sky__wash--late"></div>
      <div class="snow-sky__wash snow-sky__wash--night"></div>
    </div>
    <canvas ref="canvasRef" class="snow-drift" aria-hidden="true"></canvas>

    <section ref="coverRef" class="snow-cover" :class="{ 'snow-cover--short': !isHome }" aria-label="我们的封面">
      <div class="snow-cover__frame">
        <img
          v-for="(slide, index) in journalHeroSlides"
          :key="slide.image"
          class="snow-cover__painting"
          :class="{ 'is-active': index === 0 }"
          :src="slide.image"
          alt=""
          :loading="index === 0 ? 'eager' : 'lazy'"
          :fetchpriority="index === 0 ? 'high' : 'low'"
          decoding="async"
        />
        <div class="snow-cover__couple">
          <figure class="snow-cover__person">
            <img :src="couple[0].avatar" :alt="`${couple[0].name} 的头像`" draggable="false" />
            <figcaption>{{ couple[0].name }}</figcaption>
          </figure>
          <button ref="heartRef" type="button" class="snow-cover__heart" aria-label="撒一把花瓣" @click="scatterFromHeart">
            <svg viewBox="0 0 100 92" aria-hidden="true">
              <path d="M50 86C34 74 8 56 8 31 8 16 19 6 32 6c8 0 14 4 18 11 4-7 10-11 18-11 13 0 24 10 24 25 0 25-26 43-42 55z" />
              <path class="snow-cover__heart-shine" d="M24 26c2-7 8-11 15-10" />
            </svg>
          </button>
          <figure class="snow-cover__person">
            <img :src="couple[1].avatar" :alt="`${couple[1].name} 的头像`" draggable="false" />
            <figcaption>{{ couple[1].name }}</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <nav ref="plaqueRef" class="snow-plaque" aria-label="主导航">
      <span class="snow-plaque__cord snow-plaque__cord--l" aria-hidden="true"></span>
      <span class="snow-plaque__cord snow-plaque__cord--r" aria-hidden="true"></span>
      <div ref="boardRef" class="snow-plaque__board">
        <span class="snow-plaque__lantern" aria-hidden="true"><i></i></span>
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          class="snow-plaque__link"
          :to="item.to"
          exact-active-class="is-active"
          :data-label="item.label"
          @click="handleNavClick(item.to, $event)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
          <span class="snow-plaque__label">{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <div class="snow-shell__page">
      <slot />
    </div>

    <footer class="site-record-footer" aria-label="网站备案信息">
      <SiteRecordLink />
    </footer>
  </div>
</template>
