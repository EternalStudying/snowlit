<script setup lang="ts">
import { computed } from 'vue';
import stampPainting from '../../../shell/assets/hero/hero-storybook-onsen.webp';

/*
 * Today's note as a real letter: torn washi edges held up by a strip of sakura tape, a stamp cut from the
 * cover painting with a postmark over it, a pressed sprig, a red seal, and a postscript in a smaller hand.
 */
const props = defineProps<{
  sentence: string;
  date: string;
  weatherHint: string;
  activityHint: string;
}>();

const postmarkDate = computed(() => {
  const [, month, day] = props.date.split('T')[0].split('-');
  return month && day ? `${month}.${day}` : '今日';
});

const signedDate = computed(() => {
  const [, month, day] = props.date.split('T')[0].split('-');
  return month && day ? `${Number(month)} 月 ${Number(day)} 日` : '今天';
});

// The torn edge: a fixed, irregular outline so the paper looks hand-torn but never changes between renders.
const TORN = [
  [0, 1.2], [6, 0], [13, 0.9], [21, 0.2], [29, 1.1], [37, 0], [46, 0.8], [55, 0.1], [63, 1], [72, 0.2], [80, 0.9], [89, 0], [96, 0.7], [100, 0.2],
  [99.3, 12], [100, 26], [99.4, 41], [100, 57], [99.2, 72], [100, 88],
  [100, 99.2], [93, 100], [85, 99.1], [76, 100], [67, 99.3], [58, 100], [49, 99], [40, 100], [31, 99.2], [22, 100], [13, 99.1], [5, 100], [0, 99.3],
  [0.7, 86], [0, 70], [0.8, 55], [0, 39], [0.6, 24], [0, 10]
];
const tornEdge = `polygon(${TORN.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
</script>

<template>
  <figure class="home-letter">
    <span class="home-letter__tape" aria-hidden="true"></span>
    <div class="home-letter__paper" :style="{ clipPath: tornEdge }">
      <figcaption class="home-letter__title">今日小纸条</figcaption>
      <blockquote class="home-letter__sentence">{{ sentence }}</blockquote>
      <p class="home-letter__ps">
        <span>附：{{ weatherHint }}</span>
        <span>今天适合：{{ activityHint }}</span>
      </p>
      <p class="home-letter__sign">写给我们 · {{ signedDate }}</p>
      <svg class="home-letter__sprig" viewBox="0 0 160 90" aria-hidden="true">
        <path class="home-letter__branch" d="M4 84C40 70 70 52 100 26M60 58c8-10 20-14 30-12M86 34c-2-10 2-20 10-26" />
        <g class="home-letter__blossom" transform="translate(100 24)">
          <path d="M0-4c-4-8 4-12 6-6 4-6 12 0 6 5 8 2 6 11-1 9 2 7-6 11-9 5-4 6-12 2-9-5-7 0-8-9 0-9-5-6 3-12 7-5z" />
          <circle r="3" />
        </g>
        <g class="home-letter__blossom" transform="translate(90 47) scale(.8)">
          <path d="M0-4c-4-8 4-12 6-6 4-6 12 0 6 5 8 2 6 11-1 9 2 7-6 11-9 5-4 6-12 2-9-5-7 0-8-9 0-9-5-6 3-12 7-5z" />
          <circle r="3" />
        </g>
        <g class="home-letter__blossom home-letter__blossom--bud" transform="translate(97 8) scale(.55)">
          <path d="M0-4c-4-8 4-12 6-6 4-6 12 0 6 5 8 2 6 11-1 9 2 7-6 11-9 5-4 6-12 2-9-5-7 0-8-9 0-9-5-6 3-12 7-5z" />
        </g>
      </svg>
    </div>
    <span class="home-letter__stamp" aria-hidden="true">
      <img :src="stampPainting" alt="" />
      <b>雪光</b>
    </span>
    <svg class="home-letter__postmark" viewBox="0 0 132 70" aria-hidden="true">
      <circle cx="35" cy="35" r="28" />
      <circle cx="35" cy="35" r="21" />
      <text x="35" y="31" text-anchor="middle">Snowlit</text>
      <text x="35" y="46" text-anchor="middle" class="home-letter__postmark-date">{{ postmarkDate }}</text>
      <path d="M70 22c8-5 16 5 24 0s16 5 24 0 8 3 12 1M70 35c8-5 16 5 24 0s16 5 24 0 8 3 12 1M70 48c8-5 16 5 24 0s16 5 24 0 8 3 12 1" />
    </svg>
    <span class="home-letter__seal" aria-hidden="true">念</span>
  </figure>
</template>
