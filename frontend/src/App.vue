<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  NNotificationProvider,
  dateZhCN,
  zhCN
} from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import {
  getAuthToken,
  onSessionInvalidated,
  setAuthToken
} from './auth';
import AppTopBar from './components/AppTopBar.vue';
import JournalRouteShell from './shell/JournalRouteShell.vue';
import PointerEffects from './components/PointerEffects.vue';
import { useSmoothScroll } from './composables/useSmoothScroll';
import LoginView, {
  type LoginSession
} from './modules/login';
import WeatherAtmosphere from './modules/weather';
import { snowlitNaiveTheme } from './styles/naive-theme';
import { shouldSkipMotion } from './motion';
import { EASE_SETTLE, gsap } from './motionKit';

const router = useRouter();
const route = useRoute();
const isImmersiveRoute = computed(() => route.meta.immersive === true);
const isPublicRoute = computed(() => route.meta.public === true);
const canRenderRoute = computed(() => isLoggedIn.value || isPublicRoute.value);
const canShowWeatherAtmosphere = computed(() => route.matched.length > 0 && !isImmersiveRoute.value);
const isLoggedIn = ref(Boolean(getAuthToken()));
let stopSessionInvalidation: (() => void) | undefined;

useSmoothScroll(() => route.fullPath);

// Page hand-off inside the shell: the old page lifts away, the next one settles in under the nav.
function leavePage(el: Element, done: () => void) {
  if (shouldSkipMotion()) {
    done();
    return;
  }
  gsap.to(el, { autoAlpha: 0, y: -18, duration: 0.22, ease: 'power2.in', onComplete: done });
}

function enterPage(el: Element, done: () => void) {
  if (shouldSkipMotion()) {
    done();
    return;
  }
  gsap.fromTo(
    el,
    { autoAlpha: 0, y: 28 },
    { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE_SETTLE, clearProps: 'opacity,visibility,transform', onComplete: done }
  );
}

async function handleAuthenticated(session: LoginSession) {
  setAuthToken(session.token);
  await router.replace('/');
  isLoggedIn.value = true;
}

function handleSessionInvalidated() {
  isLoggedIn.value = false;
}

onMounted(() => {
  stopSessionInvalidation = onSessionInvalidated(
    handleSessionInvalidated
  );
});

onUnmounted(() => {
  stopSessionInvalidation?.();
});
</script>

<template>
  <NConfigProvider :theme-overrides="snowlitNaiveTheme" :locale="zhCN" :date-locale="dateZhCN">
    <NGlobalStyle />
    <NMessageProvider placement="top">
      <NDialogProvider>
        <NNotificationProvider>
          <PointerEffects />
          <template v-if="canRenderRoute">
            <WeatherAtmosphere v-if="canShowWeatherAtmosphere" />
            <RouterView v-if="isImmersiveRoute" />
            <template v-else>
              <AppTopBar :show-feedback="isLoggedIn" />
              <JournalRouteShell>
                <RouterView v-slot="{ Component, route: viewRoute }">
                  <Transition :css="false" mode="out-in" @leave="leavePage" @enter="enterPage">
                    <component :is="Component" :key="viewRoute.path" />
                  </Transition>
                </RouterView>
              </JournalRouteShell>
            </template>
          </template>
          <LoginView v-else :on-authenticated="handleAuthenticated" />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
