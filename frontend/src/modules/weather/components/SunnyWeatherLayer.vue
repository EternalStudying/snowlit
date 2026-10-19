<template>
  <Transition name="fade-layer">
    <div 
      v-if="active" 
      class="snowlit-sunny-layer"
      :class="[`intensity-${intensity}`]"
      ref="layerRef"
      aria-hidden="true"
    >
      <div class="sun-glow"></div>
      
      <div class="warm-mist"></div>
      
      <div class="dust-container">
        <div 
          v-for="dust in dustParticles" 
          :key="dust.id"
          class="dust-particle"
          :style="{
            left: `${dust.x}%`,
            top: `${dust.y}%`,
            width: `${dust.size}px`,
            height: `${dust.size}px`,
            filter: `blur(${dust.blur}px)`,
            opacity: dust.baseOpacity
          }"
        ></div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue';
import gsap from 'gsap';
import { useMotionSlots, useReducedMotion } from '../../../motion';

interface Props {
  active?: boolean
  intensity?: 'soft' | 'normal' | 'bright'
  static?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: true,
  intensity: 'normal',
  static: false
});

const layerRef = ref<HTMLElement | null>(null);
const prefersReducedMotion = useReducedMotion();
const isStatic = computed(
  () => props.static || prefersReducedMotion.value
);
let gsapContext: gsap.Context | undefined;
const slots = useMotionSlots<'gsapContext'>();

const dustParticles = Array.from({ length: 24 }).map((_, index) => {
  return {
    id: index,
    x: Math.random() * 100,
    y: Math.random() * 80,
    size: 2 + Math.random() * 4,
    blur: 1 + Math.random() * 2,
    baseOpacity: 0.1 + Math.random() * 0.3,
    duration: 15 + Math.random() * 20,
    delay: -(Math.random() * 20),
    driftX: -20 + Math.random() * 40,
    driftY: -30 - Math.random() * 40
  };
});

function stopAnimations() {
  slots.stop('gsapContext');
  gsapContext = undefined;
}

function initAnimations() {
  stopAnimations();
  if (!layerRef.value || !props.active) {
    return;
  }

  gsapContext = slots.hold('gsapContext', gsap.context(() => {
    if (isStatic.value) {
      return;
    }

    const particles =
      gsap.utils.toArray<HTMLElement>('.dust-particle');
    particles.forEach((element, index) => {
      const data = dustParticles[index];

      gsap.to(element, {
        x: data.driftX,
        y: data.driftY,
        duration: data.duration,
        delay: data.delay,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      });

      gsap.to(element, {
        opacity: data.baseOpacity + 0.4,
        duration: 3 + Math.random() * 4,
        delay: data.delay,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1
      });
    });

    gsap.to('.sun-glow', {
      scale: 1.05,
      opacity: 0.85,
      duration: 8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });

    gsap.to('.warm-mist', {
      x: '3%',
      opacity: 0.9,
      duration: 12,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
  }, layerRef.value));
}

async function syncAnimations() {
  await nextTick();
  if (!props.active) {
    stopAnimations();
    return;
  }

  initAnimations();
}

onMounted(() => {
  void syncAnimations();
});

onBeforeUnmount(() => {
  stopAnimations();
});

watch([() => props.active, isStatic], () => {
  void syncAnimations();
});
</script>

<style scoped>
/* 层级设置：
  需要覆盖在背景之上，但最好位于 Modal/弹窗/Navigation 之下。
  请根据项目中实际 z-index 体系调整，这里使用 50 作为一个适中的环境层。
*/
.snowlit-sunny-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none; /* 绝对不能阻挡下方点击 */
  z-index: 50;
  overflow: hidden;
  mix-blend-mode: screen; /* 滤色混合模式，让光效更自然叠加在深/浅背景上 */
}

/* 根据不同强度调整总体透明度 */
.snowlit-sunny-layer.intensity-soft { opacity: 0.6; }
.snowlit-sunny-layer.intensity-normal { opacity: 0.85; }
.snowlit-sunny-layer.intensity-bright { opacity: 1.2; }

/* 主光源：位于右上角，营造暖色光晕 */
.sun-glow {
  position: absolute;
  top: -15vh;
  right: -10vw;
  width: 70vw;
  height: 70vw;
  min-width: 600px;
  min-height: 600px;
  border-radius: 50%;
  background: radial-gradient(
    circle, 
    rgba(255, 240, 210, 0.4) 0%, 
    rgba(255, 230, 180, 0.15) 30%, 
    rgba(255, 210, 170, 0.05) 55%, 
    transparent 75%
  );
  filter: blur(40px);
  opacity: 0.7;
  transform-origin: center center;
}

/* 环境薄雾：覆盖顶部，制造丁达尔效应的底色 */
.warm-mist {
  position: absolute;
  top: 0;
  left: -5%;
  width: 110%;
  height: 60vh;
  background: linear-gradient(
    to bottom,
    rgba(255, 245, 225, 0.25) 0%,
    rgba(255, 235, 205, 0.1) 40%,
    transparent 100%
  );
  opacity: 0.7;
}

/* 光尘容器 */
.dust-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.dust-particle {
  position: absolute;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 4px 1px rgba(255, 245, 220, 0.8);
  will-change: transform, opacity; /* 优化硬件加速 */
}

/* 渐隐过渡 */
.fade-layer-enter-active,
.fade-layer-leave-active {
  transition: opacity 1.5s ease-in-out;
}

.fade-layer-enter-from,
.fade-layer-leave-to {
  opacity: 0;
}
</style>
