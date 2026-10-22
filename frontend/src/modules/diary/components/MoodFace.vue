<script setup lang="ts">
import { computed } from 'vue';
import type { DiaryMoodKey } from '../model';

// One round face, ten expressions. Drawn in SVG so it scales and follows the palette.
const props = defineProps<{ mood: DiaryMoodKey; label?: string }>();

const FACE: Record<DiaryMoodKey, string> = {
  happy: '#f2c94c',
  miss: '#b4c8ea',
  calm: '#a9cfba',
  wronged: '#a3cbdc',
  expecting: '#f6bf73',
  tired: '#c5ced2',
  sweet: '#f3a9b5',
  secret: '#cbbbe8',
  angry: '#ec8a73',
  touched: '#f6c7a5'
};

const fill = computed(() => FACE[props.mood]);
</script>

<template>
  <svg
    class="mood-face"
    viewBox="0 0 48 48"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    fill="none"
    stroke="var(--ink)"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="24" cy="26" r="19" :fill="fill" stroke="none" />
    <path d="M10 20c3-9 10-12 17-12" stroke="#fff" stroke-opacity=".45" stroke-width="3" />

    <template v-if="mood === 'happy'">
      <circle cx="17.5" cy="23" r="2" fill="var(--ink)" stroke="none" />
      <circle cx="30.5" cy="23" r="2" fill="var(--ink)" stroke="none" />
      <path d="M16 30q8 8 16 0" />
      <circle cx="12.5" cy="30" r="3" fill="var(--camellia)" opacity=".28" stroke="none" />
      <circle cx="35.5" cy="30" r="3" fill="var(--camellia)" opacity=".28" stroke="none" />
    </template>

    <template v-else-if="mood === 'miss'">
      <path d="M14.5 24q3 3 6 0M27.5 24q3 3 6 0" />
      <path d="M21 33q3-2 6 0" />
      <path d="M37 9.5c0-2.3 3.4-2.3 3.4 0 0-2.3 3.4-2.3 3.4 0 0 2.4-3.4 4.6-3.4 4.6S37 11.9 37 9.5z" fill="var(--camellia)" stroke="none" />
    </template>

    <template v-else-if="mood === 'calm'">
      <path d="M14.5 23.5q3 2.5 6 0M27.5 23.5q3 2.5 6 0" />
      <path d="M19 31.5q5 2.5 10 0" />
    </template>

    <template v-else-if="mood === 'wronged'">
      <path d="M14.5 19l5 2M33.5 19l-5 2" />
      <circle cx="17.5" cy="25" r="1.9" fill="var(--ink)" stroke="none" />
      <circle cx="30.5" cy="25" r="1.9" fill="var(--ink)" stroke="none" />
      <path d="M18 34q2-2 4 0t4 0 4 0" />
      <path d="M31.5 28.5q-1.6 3 0 4.2 1.6-1.2 0-4.2z" fill="#5aa7d6" stroke="none" />
    </template>

    <template v-else-if="mood === 'expecting'">
      <circle cx="17.5" cy="23.5" r="3" fill="var(--ink)" stroke="none" />
      <circle cx="30.5" cy="23.5" r="3" fill="var(--ink)" stroke="none" />
      <circle cx="18.5" cy="22.4" r="1" fill="#fff" stroke="none" />
      <circle cx="31.5" cy="22.4" r="1" fill="#fff" stroke="none" />
      <ellipse cx="24" cy="33" rx="3" ry="3.4" fill="var(--ink)" stroke="none" />
      <path d="M39 7l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="var(--lamp)" stroke="none" />
    </template>

    <template v-else-if="mood === 'tired'">
      <path d="M14.5 24h6M27.5 24h6" />
      <path d="M14.5 21.5q3 1 6 0M27.5 21.5q3 1 6 0" stroke-width="1.4" />
      <path d="M20 33h8" />
      <path d="M35 6h5l-5 5h5" stroke-width="1.6" />
    </template>

    <template v-else-if="mood === 'sweet'">
      <path d="M14.5 24l3-3 3 3M27.5 24l3-3 3 3" />
      <path d="M17 30q7 6 14 0" />
      <circle cx="12.5" cy="29.5" r="3" fill="var(--camellia)" opacity=".32" stroke="none" />
      <circle cx="35.5" cy="29.5" r="3" fill="var(--camellia)" opacity=".32" stroke="none" />
      <path d="M36 9.5c0-2.6 3.8-2.6 3.8 0 0-2.6 3.8-2.6 3.8 0 0 2.7-3.8 5.1-3.8 5.1S36 12.2 36 9.5z" fill="var(--camellia)" stroke="none" />
    </template>

    <template v-else-if="mood === 'secret'">
      <circle cx="17.5" cy="23.5" r="2" fill="var(--ink)" stroke="none" />
      <path d="M27.5 24q3-2.5 6 0" />
      <path d="M19 32h10" />
      <path d="M21.5 30v4M24 30v4M26.5 30v4" stroke-width="1.3" />
    </template>

    <template v-else-if="mood === 'angry'">
      <path d="M14 19.5l6 2.5M34 19.5l-6 2.5" />
      <circle cx="17.5" cy="25.5" r="1.9" fill="var(--ink)" stroke="none" />
      <circle cx="30.5" cy="25.5" r="1.9" fill="var(--ink)" stroke="none" />
      <path d="M18 34q6-5 12 0" />
      <path d="M36 8l2 2m0-2l-2 2M40 6.5l2.4 2.4m0-2.4L40 8.9" stroke="var(--camellia-deep)" stroke-width="1.6" />
    </template>

    <template v-else>
      <path d="M14.5 24q3-3 6 0M27.5 24q3-3 6 0" />
      <path d="M18 31q6 5 12 0" />
      <path d="M16 26.5q-1.4 2.8 0 3.8 1.4-1 0-3.8zM32 26.5q-1.4 2.8 0 3.8 1.4-1 0-3.8z" fill="#5aa7d6" stroke="none" />
      <circle cx="12.5" cy="31" r="2.6" fill="var(--camellia)" opacity=".25" stroke="none" />
      <circle cx="35.5" cy="31" r="2.6" fill="var(--camellia)" opacity=".25" stroke="none" />
    </template>
  </svg>
</template>

<style scoped>
.mood-face {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
