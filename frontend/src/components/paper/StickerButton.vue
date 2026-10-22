<script setup lang="ts">
// The one "add something" control: a tilted paper tag with an icon and a label.
// Replaces the illustrated entry images each module used to ship.
withDefaults(defineProps<{ tone?: 'camellia' | 'pine' | 'lamp' | 'ink'; tilt?: number }>(), {
  tone: 'camellia',
  tilt: -4
});
</script>

<template>
  <button type="button" class="sticker-button" :data-tone="tone" :style="{ '--sticker-tilt': `${tilt}deg` }">
    <span class="sticker-button__icon" aria-hidden="true"><slot name="icon" /></span>
    <span class="sticker-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.sticker-button {
  --sticker-bg: var(--camellia);
  --sticker-shadow: var(--camellia-rgb);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px 20px 10px 22px;
  color: var(--sheet);
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  border: 0;
  border-radius: 2px;
  background:
    radial-gradient(circle at 12px 50%, var(--snow) 0 3px, transparent 3.5px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 60%),
    var(--sticker-bg);
  clip-path: polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 50%);
  filter: drop-shadow(0 10px 12px rgba(var(--sticker-shadow), 0.32));
  rotate: var(--sticker-tilt);
  cursor: pointer;
  transition: rotate 220ms ease, translate 220ms ease;
}

.sticker-button[data-tone='pine'] { --sticker-bg: var(--pine); --sticker-shadow: var(--pine-rgb); }
.sticker-button[data-tone='lamp'] { --sticker-bg: var(--lamp-deep); --sticker-shadow: var(--lamp-rgb); }
.sticker-button[data-tone='ink'] { --sticker-bg: var(--ink); --sticker-shadow: var(--ink-rgb); }

.sticker-button:hover {
  rotate: calc(var(--sticker-tilt) / 2);
  translate: 0 -2px;
}

.sticker-button:focus-visible {
  outline: 2px solid var(--lamp);
  outline-offset: 4px;
}

.sticker-button__icon {
  display: inline-grid;
  place-items: center;
  margin-left: 6px;
}

.sticker-button__icon :deep(svg) {
  width: 20px;
  height: 20px;
}

@media (prefers-reduced-motion: reduce) {
  .sticker-button { transition: none; }
}
</style>
