<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { NAlert, NButton, NInput } from 'naive-ui';
import SiteRecordLink from '../../components/SiteRecordLink.vue';
import type { LoginSession } from './model';
import { useLoginLifecycle } from './internal/useLoginLifecycle';

gsap.registerPlugin(Draggable, MorphSVGPlugin);

const props = defineProps<{
  onAuthenticated: (
    session: LoginSession
  ) => Promise<void> | void;
}>();

const ROPE_IDLE = 'M256 192 C256 210 256 230 256 250';
const ROPE_RECOIL = 'M256 192 C241 211 273 232 256 250';

const login = useLoginLifecycle({
  onAuthenticated: props.onAuthenticated
});
const {
  credentials,
  submitting,
  error
} = login.state;
const lampOn = ref(false);
const isLampVisualPriming = ref(false);
const shadeHue = ref(randomHue());
const ropePath = ref<SVGPathElement | null>(null);
const pullKnob = ref<SVGCircleElement | null>(null);
let dragHandles: ReturnType<typeof Draggable.create> = [];
let suppressPullClick = false;
let clickAudioContext: AudioContext | undefined;
let cancelClickAudioContextWarmup: (() => void) | undefined;
let hasPrimedClickSoundGraph = false;
let cancelLampVisualWarmup: (() => void) | undefined;
let lampVisualWarmupTimer: number | undefined;

const pageStyle = computed<Record<string, string>>(() => ({
  '--on': lampOn.value || isLampVisualPriming.value ? '1' : '0',
  '--shade-hue': String(shadeHue.value)
}));

const todayLabel = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).format(new Date());
const todayIso = new Date().toISOString();

function randomHue() {
  return Math.floor(Math.random() * 360);
}

function getClickAudioContext() {
  const audioWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
  const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextClass) {
    return undefined;
  }

  if (!clickAudioContext || clickAudioContext.state === 'closed') {
    clickAudioContext = new AudioContextClass();
  }

  return clickAudioContext;
}

function warmClickAudioContext() {
  const audioContext = getClickAudioContext();
  if (audioContext?.state === 'suspended') {
    void audioContext.resume().catch(() => undefined);
  }
}

function primeClickSoundGraph() {
  const audioContext = getClickAudioContext();
  if (!audioContext || hasPrimedClickSoundGraph) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.001);
  hasPrimedClickSoundGraph = true;
}

function scheduleClickAudioContextWarmup() {
  if (cancelClickAudioContextWarmup) {
    return;
  }

  const idleWindow = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

  if (idleWindow.requestIdleCallback) {
    const idleHandle = idleWindow.requestIdleCallback(
      () => {
        cancelClickAudioContextWarmup = undefined;
        primeClickSoundGraph();
      },
      { timeout: 900 }
    );
    cancelClickAudioContextWarmup = () => idleWindow.cancelIdleCallback?.(idleHandle);
    return;
  }

  const timeoutHandle = window.setTimeout(() => {
    cancelClickAudioContextWarmup = undefined;
    primeClickSoundGraph();
  }, 180);
  cancelClickAudioContextWarmup = () => window.clearTimeout(timeoutHandle);
}

function clearLampVisualWarmup() {
  cancelLampVisualWarmup?.();
  cancelLampVisualWarmup = undefined;
  if (lampVisualWarmupTimer !== undefined) {
    window.clearTimeout(lampVisualWarmupTimer);
    lampVisualWarmupTimer = undefined;
  }
  isLampVisualPriming.value = false;
}

function scheduleLampVisualWarmup() {
  if (cancelLampVisualWarmup || lampVisualWarmupTimer !== undefined) {
    return;
  }

  const idleWindow = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
  const startWarmup = () => {
    cancelLampVisualWarmup = undefined;
    if (lampOn.value) {
      return;
    }
    isLampVisualPriming.value = true;
    lampVisualWarmupTimer = window.setTimeout(() => {
      lampVisualWarmupTimer = undefined;
      isLampVisualPriming.value = false;
    }, 120);
  };

  if (idleWindow.requestIdleCallback) {
    const idleHandle = idleWindow.requestIdleCallback(startWarmup, { timeout: 1100 });
    cancelLampVisualWarmup = () => idleWindow.cancelIdleCallback?.(idleHandle);
    return;
  }

  const timeoutHandle = window.setTimeout(startWarmup, 260);
  cancelLampVisualWarmup = () => window.clearTimeout(timeoutHandle);
}

function playClickSound() {
  const audioContext = getClickAudioContext();
  if (!audioContext) {
    return;
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined);
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(580, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(180, audioContext.currentTime + 0.05);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.14, audioContext.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.07);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.08);
}

function morphRope(distance: number) {
  if (!ropePath.value) {
    return;
  }

  const pull = Math.max(0, Math.min(distance, 76));
  const d = `M256 192 C${251 - pull * 0.12} ${210 + pull * 0.2} ${268 + pull * 0.13} ${
    230 + pull * 0.38
  } 256 ${250 + pull}`;

  gsap.to(ropePath.value, {
    duration: 0.08,
    morphSVG: d,
    ease: 'power2.out',
    overwrite: true
  });
}

function resetRope() {
  if (pullKnob.value) {
    gsap.to(pullKnob.value, {
      y: 0,
      duration: 0.42,
      ease: 'elastic.out(1, 0.42)',
      overwrite: true
    });
  }

  if (ropePath.value) {
    gsap
      .timeline({ defaults: { overwrite: true } })
      .to(ropePath.value, { duration: 0.12, morphSVG: ROPE_RECOIL, ease: 'power2.out' })
      .to(ropePath.value, { duration: 0.42, morphSVG: ROPE_IDLE, ease: 'elastic.out(1, 0.42)' });
  }
}

function toggleLamp() {
  clearLampVisualWarmup();
  const nextLampOn = !lampOn.value;
  lampOn.value = nextLampOn;
  if (!nextLampOn) {
    shadeHue.value = randomHue();
  }
  playClickSound();
}

function pullByClick() {
  if (suppressPullClick) {
    suppressPullClick = false;
    return;
  }

  toggleLamp();
  resetRope();
}

function setupDraggable() {
  if (!pullKnob.value) {
    return;
  }

  const svg = pullKnob.value.ownerSVGElement;
  if (!svg || typeof svg.getCTM !== 'function') {
    return;
  }

  dragHandles = Draggable.create(pullKnob.value, {
    type: 'y',
    bounds: { minY: 0, maxY: 76 },
    onDrag() {
      const drag = pullKnob.value ? Draggable.get(pullKnob.value) : undefined;
      morphRope(drag?.y ?? 0);
    },
    onRelease() {
      const drag = pullKnob.value ? Draggable.get(pullKnob.value) : undefined;
      const pullDistance = drag?.y ?? 0;

      if (pullDistance > 4) {
        suppressPullClick = true;
        window.setTimeout(() => {
          suppressPullClick = false;
        }, 120);
      }

      if (pullDistance > 50) {
        toggleLamp();
      }
      resetRope();
    }
  });
}

onMounted(() => {
  setupDraggable();
  scheduleClickAudioContextWarmup();
  scheduleLampVisualWarmup();
});

onUnmounted(() => {
  cancelClickAudioContextWarmup?.();
  cancelClickAudioContextWarmup = undefined;
  clearLampVisualWarmup();
  dragHandles.forEach((handle) => handle.kill());
  if (clickAudioContext && clickAudioContext.state !== 'closed') {
    void clickAudioContext.close().catch(() => undefined);
  }
  clickAudioContext = undefined;
  hasPrimedClickSoundGraph = false;
});
</script>

<template>
  <main
    class="login-page"
    :class="[lampOn ? 'is-lamp-on' : 'is-lamp-off', { 'is-lamp-priming': isLampVisualPriming }]"
    :style="pageStyle"
  >
    <section class="login-shell" aria-labelledby="login-title">
      <div class="lamp-scene" aria-label="可拉动的台灯开关">
        <svg class="desk-lamp" viewBox="0 0 420 420">
          <defs>
            <radialGradient id="lampGlow" cx="50%" cy="24%" r="66%">
              <stop offset="0%" class="lamp-glow-stop-strong" />
              <stop offset="58%" class="lamp-glow-stop-soft" />
              <stop offset="100%" class="lamp-glow-stop-clear" />
            </radialGradient>
            <linearGradient id="shadeGradient" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" class="lamp-shade-stop-a" />
              <stop offset="100%" class="lamp-shade-stop-b" />
            </linearGradient>
          </defs>

          <ellipse class="lamp-floor-glow" cx="210" cy="350" rx="118" ry="23" />
          <path class="lamp-light-cone" d="M133 191 L287 191 L333 350 C294 374 126 374 87 350 Z" />
          <circle class="lamp-glow" cx="210" cy="210" r="158" fill="url(#lampGlow)" />

          <g class="lamp-head">
            <line class="lamp-hanger" x1="210" y1="33" x2="210" y2="120" />
            <rect class="lamp-hanger-cap lamp-hanger-cap--top" x="201" y="27" width="18" height="8" rx="2" />
            <rect class="lamp-hanger-cap lamp-hanger-cap--neck" x="202" y="118" width="16" height="14" rx="2" />
            <path class="lamp-shade-body" d="M132 128 H288 L303 193 H117 Z" />
            <path class="lamp-shade-bottom" d="M116 192 H304 V201 H116 Z" />
            <path class="lamp-shade-bottom-line" d="M117 192 H303" />
            <ellipse class="lamp-bulb" cx="210" cy="197" rx="42" ry="10" />
            <g class="lamp-eyes">
              <circle class="lamp-eye-dot lamp-eye-dot--left" cx="187" cy="162" r="7" />
              <circle class="lamp-eye-dot lamp-eye-dot--right" cx="233" cy="162" r="7" />
              <circle class="lamp-eye-glint" cx="184" cy="160" r="2" />
              <circle class="lamp-eye-glint" cx="230" cy="160" r="2" />
            </g>
          </g>

          <path ref="ropePath" class="lamp-rope" :d="ROPE_IDLE" />
          <circle
            ref="pullKnob"
            class="lamp-pull-knob"
            cx="256"
            cy="264"
            r="15"
            tabindex="0"
            data-testid="lamp-pull-knob"
            role="button"
            aria-label="拉动台灯开关"
            @pointerdown="warmClickAudioContext"
            @click="pullByClick"
            @keydown.enter.prevent="pullByClick"
            @keydown.space.prevent="pullByClick"
          />
        </svg>
      </div>

      <form class="login-form" :aria-hidden="lampOn ? 'false' : 'true'" @submit.prevent="login.submit">
        <div class="login-form__header">
          <p class="eyebrow">Night Desk</p>
          <h1 id="login-title">欢迎回来</h1>
        </div>

        <label>
          账号
          <NInput
            v-model:value="credentials.username"
            class="snowlit-login-input"
            placeholder="输入账号"
            :input-props="{ name: 'username', autocomplete: 'username' }"
          />
        </label>

        <label>
          密码
          <NInput
            v-model:value="credentials.password"
            class="snowlit-login-input"
            type="password"
            placeholder="输入密码"
            show-password-on="click"
            :input-props="{ name: 'password', autocomplete: 'current-password' }"
          />
        </label>

        <NAlert v-if="error" class="form-error" type="error" :show-icon="false">
          {{ error }}
        </NAlert>

        <NButton attr-type="submit" type="primary" :loading="submitting" :disabled="submitting">
          {{ submitting ? '登录中...' : '登录' }}
        </NButton>

        <a class="forgot-link" href="#" @click.prevent>忘记密码？</a>
      </form>
    </section>

    <footer class="login-footer login-footer--pinned">
      <time :datetime="todayIso">{{ todayLabel }}</time>
      <span>Author · Snowlit</span>
      <SiteRecordLink variant="night" />
    </footer>
  </main>
</template>
