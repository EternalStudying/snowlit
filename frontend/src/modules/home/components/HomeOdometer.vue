<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { shouldSkipMotion, useMotionSlots } from '../../../motion';
import { EASE_SETTLE, gsap } from '../../../motionKit';

// A number set in rolling digit columns: each column spins up from zero to its digit, left to right.
const props = withDefaults(defineProps<{ value: number; delay?: number }>(), { delay: 0 });

const root = ref<HTMLElement | null>(null);
const slots = useMotionSlots<'roll'>();
const digits = computed(() => String(Math.max(0, Math.round(props.value))).split('').map(Number));
const ROLL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Percent of the reel's own height that puts `digit` (in the second run of 0–9) in the window.
function columnOffset(digit: number) {
  return -(10 + digit) * (100 / ROLL.length);
}

function roll() {
  const columns = root.value?.querySelectorAll<HTMLElement>('.odometer__reel');
  if (!columns?.length) {
    return;
  }
  if (shouldSkipMotion()) {
    // The template already places each reel on its digit.
    return;
  }
  slots.hold(
    'roll',
    gsap.fromTo(
      columns,
      { yPercent: 0, y: 0 },
      {
        yPercent: (index: number) => columnOffset(digits.value[index]),
        duration: (index: number) => 1.6 + index * 0.25,
        delay: props.delay,
        ease: EASE_SETTLE,
        stagger: 0.08
      }
    )
  );
}

onMounted(roll);
watch(digits, () => requestAnimationFrame(roll));
</script>

<template>
  <span ref="root" class="odometer" :aria-label="String(value)" role="img">
    <span class="visually-hidden">{{ value }}</span>
    <span v-for="(digit, index) in digits" :key="`${digits.length}-${index}`" class="odometer__window" aria-hidden="true">
      <span class="odometer__reel" :style="{ transform: `translateY(${columnOffset(digit)}%)` }">
        <span v-for="(n, row) in ROLL" :key="row" class="odometer__digit">{{ n }}</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.odometer {
  display: inline-flex;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.odometer__window {
  display: inline-block;
  height: 1em;
  overflow: hidden;
}

.odometer__reel {
  display: flex;
  flex-direction: column;
  will-change: transform;
}

.odometer__digit {
  display: block;
  height: 1em;
  text-align: center;
}
</style>
