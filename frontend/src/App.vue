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
  clearAuthToken,
  getAuthToken,
  onSessionInvalidated,
  setAuthToken
} from './auth';
import AppTopBar from './components/AppTopBar.vue';
import { JournalRouteShell } from './modules/home';
import PointerEffects from './components/PointerEffects.vue';
import { useSmoothScroll } from './composables/useSmoothScroll';
import LoginView, {
  type LoginSession
} from './modules/login';
import WeatherAtmosphere from './modules/weather';
import { snowlitNaiveTheme } from './styles/naive-theme';

const router = useRouter();
const route = useRoute();
const isImmersiveRoute = computed(() => route.meta.immersive === true);
const isPublicRoute = computed(() => route.meta.public === true);
const canRenderRoute = computed(() => isLoggedIn.value || isPublicRoute.value);
const canShowWeatherAtmosphere = computed(() => route.matched.length > 0 && !isImmersiveRoute.value);
const isLoggedIn = ref(Boolean(getAuthToken()));
let stopSessionInvalidation: (() => void) | undefined;

useSmoothScroll(() => route.fullPath);

async function handleAuthenticated(session: LoginSession) {
  setAuthToken(session.token);
  await router.replace('/');
  isLoggedIn.value = true;
}

function handleSessionInvalidated() {
  clearAuthToken();
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
                <RouterView />
              </JournalRouteShell>
            </template>
          </template>
          <LoginView v-else :on-authenticated="handleAuthenticated" />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
