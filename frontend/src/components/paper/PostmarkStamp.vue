<script setup lang="ts">
// A circular postmark with a heart and wavy cancellation lines, drawn in SVG.
withDefaults(defineProps<{ label?: string }>(), { label: '' });
</script>

<template>
  <svg class="postmark-stamp" viewBox="0 0 96 60" fill="none" aria-hidden="true">
    <circle cx="30" cy="30" r="25" stroke="currentColor" stroke-width="1.6" />
    <circle cx="30" cy="30" r="19" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2.5" />
    <path d="M21 27.5c0-5 7.5-6.5 9-.5 1.5-6 9-4.5 9 .5 0 5.5-9 11-9 11s-9-5.5-9-11z" fill="currentColor" />
    <text v-if="label" x="30" y="52" text-anchor="middle" font-size="6.5" fill="currentColor" font-family="var(--font-ui)">{{ label }}</text>
    <path
      d="M58 17c6 4 12-4 18 0s12-4 18 0M58 30c6 4 12-4 18 0s12-4 18 0M58 43c6 4 12-4 18 0s12-4 18 0"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
.postmark-stamp {
  display: block;
  width: 96px;
  height: auto;
  color: var(--camellia);
  opacity: 0.62;
}
</style>
