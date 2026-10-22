<script setup lang="ts">
import { computed, ref } from 'vue';
import partnerAAvatar from '../assets/couple-avatars/partner-a.webp';
import partnerBAvatar from '../assets/couple-avatars/partner-b.webp';
import SiteRecordLink from '../components/SiteRecordLink.vue';
import TopbarTooltip from '../components/TopbarTooltip.vue';
import { useHomeLifecycle } from '../modules/home';
import './journal-shell.css';
import { useJournalHero } from './useJournalHero';
import { useJournalNavFusion } from './useJournalNavFusion';
import { useMotionReveal } from './useMotionReveal';
import { useHeroParallax } from './useHeroParallax';

interface CozyNavItem {
  to: string;
  icon: string;
  label: string;
}

const { overview: home } = useHomeLifecycle().state;
// The warm-journal reveal: the shell and every module marked data-motion-enabled play it (see journal-shell.css).
const motionRootAttrs = {
  'data-home-motion': 'warm-journal',
  'data-motion-image-drift': 'true',
  'data-motion-paper-float': 'true',
  'data-motion-count-up': 'true',
  'data-motion-sticker-pop': 'true',
  'data-motion-paper-lift': 'true'
};
const motionRootStyle = {
  '--motion-duration-scale': '1.087',
  '--motion-stagger': '105ms',
  '--motion-softness': '0.82',
  '--motion-float-intensity': '0.32',
  '--motion-scale-intensity': '0.28'
};
const {
  slides: heroSlides,
  activeSlide,
  activeSlideIndex,
  paused: heroPaused,
  isExpanded: isHeroExpanded,
  isImmersive: isHeroImmersive,
  immersiveAttr: heroImmersiveAttr,
  expandedAttr: heroExpandedAttr,
  style: heroExpansionStyle,
  activeStickerSide: activeHeroStickerSide,
  isHeartBeating: isHeroHeartBeating,
  isSyncing: isHeroSyncing,
  burstParticles: heroBurstParticles,
  shouldRenderSlideImage: shouldRenderHeroSlideImage,
  showSlide: showHeroSlide,
  showNextSlide: showNextHeroSlide,
  showPreviousSlide: showPreviousHeroSlide,
  setStickerTarget: setHeroStickerTarget,
  clearStickerTarget: clearHeroStickerTarget,
  triggerStickerInteraction: triggerHeroStickerInteraction
} = useJournalHero();
const shellRef = ref<HTMLElement | null>(null);
const { requestRevealCheck: requestMotionRevealCheck } =
  useMotionReveal(shellRef);
useHeroParallax(shellRef);
const {
  navAnchorRef,
  navRef,
  navContentRef,
  navFusionState,
  navLabelState,
  navDensityState,
  navFusionCompactAttr,
  navSwitchingAttr,
  navActiveTrackSettlingAttr,
  navRestoringAttr,
  style: navFusionStyle,
  handleCozyNavRootClick
} = useJournalNavFusion({
  isHeroImmersive,
  requestMotionRevealCheck
});

const shellStyle = computed(() => ({
  ...motionRootStyle,
  ...heroExpansionStyle.value,
  ...navFusionStyle.value
}));

const navIcons = {
  messages:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path fill="currentColor" d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092a10 10 0 1 0-4.777-4.719"/><path fill="currentColor" d="M7.828 13.07A3 3 0 0 1 12 8.764a3 3 0 0 1 5.004 2.224a3 3 0 0 1-.832 2.083l-3.447 3.62a1 1 0 0 1-1.45-.001z"/></g></svg>',
  diary:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 7v14m4-9h2m-2-4h2M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4a4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3a3 3 0 0 0-3-3zm3-6h2M6 8h2"/></svg>',
  home:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path fill="currentColor" d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path fill="currentColor" d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></g></svg>',
  album:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path fill="currentColor" d="m22 11l-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"/><path fill="currentColor" d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"/><circle cx="13" cy="7" r="1" fill="currentColor"/><rect fill="currentColor" width="14" height="14" x="8" y="2" rx="2"/></g></svg>',
  list:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5h8m-8 7h8m-8 7h8M3 17l2 2l4-4M3 7l2 2l4-4"/></svg>'
};

const cozyNavItems: CozyNavItem[] = [
  { to: '/messages', icon: navIcons.messages, label: '留言' },
  { to: '/diary', icon: navIcons.diary, label: '日记' },
  { to: '/', icon: navIcons.home, label: '首页' },
  { to: '/album', icon: navIcons.album, label: '相册' },
  { to: '/wishes', icon: navIcons.list, label: '清单' }
];

const coupleStatusCards = computed(() => [
  {
    name: home.value?.couple.boyfriendName ?? '伴侣 A',
    avatar: partnerAAvatar
  },
  {
    name: home.value?.couple.girlfriendName ?? '伴侣 B',
    avatar: partnerBAvatar
  }
]);
</script>

<template>
  <div
    ref="shellRef"
    class="journal-shell"
    v-bind="motionRootAttrs"
    :style="shellStyle"
    :data-hero-immersive="heroImmersiveAttr"
    :data-hero-expanded="heroExpandedAttr"
  >
    <section class="journal-stage" aria-label="我们的日常封面">
      <section
        class="journal-hero-carousel"
        :class="`journal-hero-carousel--${activeSlide.tone}`"
        :data-hero-immersive="heroImmersiveAttr"
        aria-label="情侣纪念册插画封面"
        data-motion-module="hero"
        data-motion-enabled="true"
        @mouseenter="heroPaused = true"
        @mouseleave="heroPaused = false"
      >
        <div class="journal-hero-slides" aria-hidden="true">
          <figure
            v-for="(slide, index) in heroSlides"
            :key="slide.image"
            class="journal-hero-slide"
            :class="[`journal-hero-slide--${slide.tone}`, { 'is-active': index === activeSlideIndex }]"
          >
            <img
              v-if="shouldRenderHeroSlideImage(index)"
              :src="slide.image"
              alt=""
              :loading="index === activeSlideIndex ? 'eager' : 'lazy'"
              :fetchpriority="index === activeSlideIndex ? 'high' : 'low'"
              decoding="async"
            />
          </figure>
        </div>

        <div class="journal-hero-content">
          <div
            class="hero-sticker-cluster"
            :data-heart-target="activeHeroStickerSide ?? 'none'"
            :data-hero-heart-beating="isHeroHeartBeating ? 'true' : undefined"
            :data-hero-sync-pulse="isHeroSyncing ? 'true' : undefined"
          >
            <button
              type="button"
              class="hero-person-sticker hero-person-sticker--left"
              :aria-label="`轻触${coupleStatusCards[0].name}的头像`"
              :aria-disabled="isHeroExpanded ? 'false' : 'true'"
              :tabindex="isHeroExpanded ? 0 : -1"
              @mouseenter="setHeroStickerTarget('left')"
              @mouseleave="clearHeroStickerTarget('left')"
              @focus="setHeroStickerTarget('left')"
              @blur="clearHeroStickerTarget('left')"
              @click="triggerHeroStickerInteraction('left')"
              @keydown.enter.prevent="triggerHeroStickerInteraction('left')"
              @keydown.space.prevent="triggerHeroStickerInteraction('left')"
            >
              <div class="hero-avatar-sticker hero-avatar-sticker--left">
                <img
                  class="hero-avatar-image"
                  :src="coupleStatusCards[0].avatar"
                  :alt="`${coupleStatusCards[0].name} 的头像`"
                  draggable="false"
                  decoding="async"
                />
              </div>
              <span class="hero-avatar-name">{{ coupleStatusCards[0].name }}</span>
            </button>

            <div class="hero-centerpiece" aria-hidden="true">
              <div class="hero-center-heart">
                <svg class="hero-center-heart__image" viewBox="0 0 100 92">
                  <path
                    d="M50 86C34 74 8 56 8 31 8 16 19 6 32 6c8 0 14 4 18 11 4-7 10-11 18-11 13 0 24 10 24 25 0 25-26 43-42 55z"
                    fill="var(--camellia)"
                    stroke="var(--sheet)"
                    stroke-width="6"
                    stroke-linejoin="round"
                  />
                  <path d="M24 26c2-7 8-11 15-10" fill="none" stroke="var(--sheet)" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" />
                </svg>
              </div>
            </div>

            <button
              type="button"
              class="hero-person-sticker hero-person-sticker--right"
              :aria-label="`轻触${coupleStatusCards[1].name}的头像`"
              :aria-disabled="isHeroExpanded ? 'false' : 'true'"
              :tabindex="isHeroExpanded ? 0 : -1"
              @mouseenter="setHeroStickerTarget('right')"
              @mouseleave="clearHeroStickerTarget('right')"
              @focus="setHeroStickerTarget('right')"
              @blur="clearHeroStickerTarget('right')"
              @click="triggerHeroStickerInteraction('right')"
              @keydown.enter.prevent="triggerHeroStickerInteraction('right')"
              @keydown.space.prevent="triggerHeroStickerInteraction('right')"
            >
              <div class="hero-avatar-sticker hero-avatar-sticker--right">
                <img
                  class="hero-avatar-image"
                  :src="coupleStatusCards[1].avatar"
                  :alt="`${coupleStatusCards[1].name} 的头像`"
                  draggable="false"
                  decoding="async"
                />
              </div>
              <span class="hero-avatar-name">{{ coupleStatusCards[1].name }}</span>
            </button>

            <span
              v-for="particle in heroBurstParticles"
              :key="particle.id"
              class="hero-heart-burst-particle"
              :class="`hero-heart-burst-particle--${particle.side}`"
              :style="particle.style"
              aria-hidden="true"
            >
              {{ particle.symbol }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="journal-hero-arrow journal-hero-arrow--prev"
          aria-label="上一张首屏图片"
          :disabled="!isHeroExpanded"
          @click="showPreviousHeroSlide"
        >
          <span class="journal-hero-arrow__glyph" aria-hidden="true"></span>
        </button>
        <button
          type="button"
          class="journal-hero-arrow journal-hero-arrow--next"
          aria-label="下一张首屏图片"
          :disabled="!isHeroExpanded"
          @click="showNextHeroSlide"
        >
          <span class="journal-hero-arrow__glyph" aria-hidden="true"></span>
        </button>

        <div class="journal-hero-dots" aria-label="首页封面轮播">
          <button
            v-for="(slide, index) in heroSlides"
            :key="slide.title"
            type="button"
            class="journal-hero-dot"
            :aria-label="`切换到${slide.title}`"
            :aria-current="index === activeSlideIndex ? 'true' : undefined"
            @click="showHeroSlide(index)"
          >
            <span></span>
          </button>
        </div>
      </section>

      <div ref="navAnchorRef" class="journal-nav-anchor">
        <nav
          ref="navRef"
          class="journal-nav paper-nav-shell"
          :data-nav-fusion="navFusionState"
          :data-nav-labels="navLabelState"
          :data-nav-density="navDensityState"
          :data-nav-compact="navFusionCompactAttr"
          :data-nav-switching="navSwitchingAttr"
          :data-nav-active-settling="navActiveTrackSettlingAttr"
          :data-nav-restoring="navRestoringAttr"
          :class="{ 'is-hero-hidden': isHeroImmersive }"
          :aria-hidden="isHeroImmersive ? 'true' : undefined"
          aria-label="首页章节导航"
          @click.capture="handleCozyNavRootClick"
        >
          <span class="paper-nav-shell__texture" aria-hidden="true"></span>
          <div ref="navContentRef" class="paper-nav-shell__content">
            <span class="journal-nav__active-track" aria-hidden="true"></span>
            <template v-for="item in cozyNavItems" :key="item.label">
              <TopbarTooltip
                :label="item.label"
                :enabled="navFusionState === 'docked'"
              >
                <RouterLink
                  class="journal-nav__link"
                  exact-active-class="journal-nav__link--home"
                  :to="item.to"
                  :data-label="item.label"
                >
                  <span class="journal-nav__icon" aria-hidden="true" v-html="item.icon"></span>
                  <span class="journal-nav__label">{{ item.label }}</span>
                </RouterLink>
              </TopbarTooltip>
            </template>
          </div>
        </nav>
      </div>

      <div class="journal-route-content">
        <slot />
      </div>

      <footer class="site-record-footer" aria-label="网站备案信息">
        <SiteRecordLink />
      </footer>
    </section>
  </div>
</template>
