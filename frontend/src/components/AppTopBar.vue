<script setup lang="ts">
import { prefersReducedMotion } from '../motion';
import { computed, ref } from 'vue';
import { NModal } from 'naive-ui';
import { syncHomeLocationFromWeather } from '../modules/home';
import { useRoute, useRouter } from 'vue-router';
import { formatTopbarWeatherSummary, useAutomaticWeather } from '../modules/weather';
import SupportCenter from '../modules/support';
import { playStoryEnterTransition } from '../modules/story';
import TopbarTooltip from './TopbarTooltip.vue';

defineProps<{
  showFeedback?: boolean;
}>();

const autoWeather = useAutomaticWeather(syncHomeLocationFromWeather);
const { weather, loading, error } = autoWeather;
const automaticWeather = autoWeather.enabled;
const locationConsentVisible = autoWeather.consentPromptVisible;
const route = useRoute();
const router = useRouter();
const weatherSummary = computed(() => formatTopbarWeatherSummary(weather.value));
const reducedMotion = prefersReducedMotion();
const topbarIcons = {
  moments:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path fill="currentColor" d="M7 16.3c2.2 0 4-1.83 4-4.05c0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05"/><path fill="currentColor" d="M12.56 6.6A11 11 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></g></svg>',
  about:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle fill="currentColor" cx="12" cy="12" r="10"/><path fill="currentColor" d="M12 16v-4m0-4h.01"/></g></svg>'
};

const weatherSettingsVisible = ref(false);

// Asking for consent replaces the settings dialog.
function toggleAutomaticWeather() {
  if (!automaticWeather.value) weatherSettingsVisible.value = false;
  autoWeather.toggle();
}
function refreshWeather() {
  if (!automaticWeather.value) weatherSettingsVisible.value = false;
  void autoWeather.refreshNow();
}

function enterStory(event: MouseEvent | KeyboardEvent) {
  const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : document.body;
  void playStoryEnterTransition({
    trigger,
    router,
    route,
    reducedMotion
  });
}
</script>

<template>
  <header class="app-topbar" aria-label="登录后导航">
    <div class="app-topbar__inner">
      <nav class="app-topbar__story-actions app-topbar__story-actions--left app-topbar__dock-motion" aria-label="点滴、关于与反馈入口">
        <TopbarTooltip label="点滴">
          <button
            type="button"
            class="app-topbar__story-entry"
            aria-label="进入点滴地图"
            @click="enterStory"
            @keydown.enter.prevent="enterStory"
            @keydown.space.prevent="enterStory"
          >
            <span class="app-topbar__entry-icon" aria-hidden="true" v-html="topbarIcons.moments"></span>
          </button>
        </TopbarTooltip>
        <TopbarTooltip label="关于暂未开放">
          <button
            type="button"
            class="app-topbar__about-entry"
            disabled
            aria-label="关于暂未开放"
            aria-disabled="true"
          >
            <span class="app-topbar__entry-icon" aria-hidden="true" v-html="topbarIcons.about"></span>
          </button>
        </TopbarTooltip>
        <SupportCenter v-if="showFeedback" />

      </nav>
      <RouterLink class="app-topbar__brand" to="/" aria-label="Snowlit，回到首页">
        <span class="app-topbar__brand-text">Snowlit</span>
      </RouterLink>
      <button v-if="showFeedback" type="button" class="app-topbar__weather-entry app-topbar__dock-motion"
        aria-label="天气与定位设置" @click="weatherSettingsVisible = true">天气</button>
      <NModal v-model:show="weatherSettingsVisible" preset="card" title="位置与天气" class="weather-settings-modal"
        style="width: min(360px, calc(100vw - 32px)); max-height: 90vh; overflow: auto;">
          <div class="weather-settings">
            <strong>{{ weatherSummary?.primary || '位置与天气待更新' }}</strong>
            <p v-if="weatherSummary?.secondary">{{ weatherSummary.secondary }}</p>
            <p>{{ automaticWeather ? '前台每 20 分钟自动更新，后台暂停。' : '自动定位已暂停。' }}</p>
            <p v-if="error" role="status">{{ error.message }}</p>
            <button type="button" :disabled="loading" @click="refreshWeather">{{ loading ? '更新中…' : '立即更新' }}</button>
            <button type="button" @click="toggleAutomaticWeather">{{ automaticWeather ? '暂停自动更新' : '开启自动更新' }}</button>
          </div>
      </NModal>
      <div
        v-if="weatherSummary"
        class="app-topbar__weather-summary app-topbar__dock-motion"
        :aria-label="weatherSummary.label"
      >
        <span class="app-topbar__weather-primary">{{ weatherSummary.primary }}</span>
        <span v-if="weatherSummary.secondary" class="app-topbar__weather-secondary">
          {{ weatherSummary.secondary }}
        </span>
      </div>
    </div>
    <NModal v-model:show="locationConsentVisible" preset="dialog" title="自动更新位置与天气"
      positive-text="同意并开启" negative-text="暂不开启" :mask-closable="false"
      @positive-click="autoWeather.acceptConsent" @negative-click="autoWeather.declineConsent" @close="autoWeather.declineConsent">
      <p>开启后，页面打开时自动定位，前台每 20 分钟更新，后台暂停。可随时在“天气”中暂停。</p>
      <p>后端会将原始经纬度发给 Geoapify（城市及行政区解析）和 Open-Meteo（模型天气），不附带账号和内容；服务商可能保留请求日志。位置信息用于首页城市和伴侣距离显示。</p>
    </NModal>
  </header>
</template>

<style scoped>
.app-topbar__weather-summary { right: 52px; }
.app-topbar__weather-entry { position: absolute; right: 0; top: 50%; border: 0; border-radius: 8px; background: transparent; padding: 8px; color: #554437; font: inherit; font-size: 12px; }
.weather-settings { overflow-wrap: anywhere; font-size: 13px; }
.weather-settings p { margin: 8px 0; }
.weather-settings button { margin: 3px 12px 3px 0; padding: 5px 8px; }
</style>
