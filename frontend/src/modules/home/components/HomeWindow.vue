<script setup lang="ts">
import { computed } from 'vue';

/*
 * One partner's lit window on a snowy night. Their city's weather is drawn outside the glass (snow, rain,
 * cloud or a clear moonlit sky); inside, a lamp, curtains in their colour, a mug and a plant. Their name,
 * place and mood hang below on a wooden tag.
 */
const props = defineProps<{
  name: string;
  avatar: string;
  city: string;
  weather: string;
  mood: string;
  note: string;
  tone: 'pine' | 'sakura';
}>();

type WeatherKind = 'snow' | 'rain' | 'cloud' | 'clear';

const weatherKind = computed<WeatherKind>(() => {
  const text = props.weather;
  if (/雪|snow/i.test(text)) return 'snow';
  if (/雨|rain|drizzle|shower/i.test(text)) return 'rain';
  if (/云|阴|雾|霾|cloud|overcast|fog/i.test(text)) return 'cloud';
  return 'clear';
});

// Fixed positions so the weather looks hand-placed, not random, and never shifts between renders.
const flakes = [8, 19, 27, 38, 46, 55, 63, 71, 80, 88, 94, 14, 50, 76];
const drops = [6, 15, 24, 33, 42, 51, 60, 69, 78, 87, 96];
const stars = [
  [12, 18], [26, 8], [44, 22], [62, 10], [78, 26], [90, 12], [34, 34], [70, 40]
];
</script>

<template>
  <article class="home-window" :class="`home-window--${tone}`" :data-weather="weatherKind" :aria-label="`${name}：${city}，${weather}，${mood}`">
    <div class="home-window__outside" aria-hidden="true">
      <template v-if="weatherKind === 'snow'">
        <i v-for="(left, index) in flakes" :key="index" class="home-window__flake" :style="{ left: `${left}%`, animationDelay: `${-index * 0.7}s` }"></i>
      </template>
      <template v-else-if="weatherKind === 'rain'">
        <i v-for="(left, index) in drops" :key="index" class="home-window__drop" :style="{ left: `${left}%`, animationDelay: `${-index * 0.23}s` }"></i>
      </template>
      <template v-else-if="weatherKind === 'cloud'">
        <i class="home-window__cloud home-window__cloud--a"></i>
        <i class="home-window__cloud home-window__cloud--b"></i>
      </template>
      <template v-else>
        <i class="home-window__moon"></i>
        <i v-for="([left, top], index) in stars" :key="index" class="home-window__star" :style="{ left: `${left}%`, top: `${top}%`, animationDelay: `${-index * 0.6}s` }"></i>
      </template>
    </div>

    <div class="home-window__eave" aria-hidden="true">
      <span v-if="weatherKind === 'snow'" class="home-window__snowcap"></span>
      <span class="home-window__icicle" style="left: 14%; --h: 16px"></span>
      <span class="home-window__icicle" style="left: 31%; --h: 24px"></span>
      <span class="home-window__icicle" style="left: 63%; --h: 12px"></span>
      <span class="home-window__icicle" style="left: 82%; --h: 20px"></span>
    </div>

    <div class="home-window__frame">
      <div class="home-window__room">
        <span class="home-window__wallpaper" aria-hidden="true"></span>
        <span class="home-window__lamp" aria-hidden="true">
          <i class="home-window__lamp-cord"></i>
          <i class="home-window__lamp-glow"></i>
          <i class="home-window__lamp-shade"></i>
        </span>
        <span class="home-window__curtain home-window__curtain--l" aria-hidden="true"></span>
        <span class="home-window__curtain home-window__curtain--r" aria-hidden="true"></span>
        <img class="home-window__avatar" :src="avatar" alt="" draggable="false" />
        <svg class="home-window__mug" viewBox="0 0 40 44" aria-hidden="true">
          <path class="home-window__steam" d="M14 14c-4-4 4-6 0-11M22 14c-4-4 4-6 0-11" />
          <path d="M6 18h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" fill="#fff4e4" />
          <path d="M28 21h3a5 5 0 0 1 0 10h-3" fill="none" stroke="#fff4e4" stroke-width="3" />
          <path d="M11 27c2 2 6 2 8 0" fill="none" stroke="#c23b4f" stroke-width="2" stroke-linecap="round" />
        </svg>
        <svg class="home-window__plant" viewBox="0 0 40 50" aria-hidden="true">
          <path d="M20 30C10 26 8 14 12 6c6 6 9 14 8 24zM20 30c8-6 16-6 20-2-6 6-14 6-20 2zM20 30C14 22 4 22 0 26c6 5 14 6 20 4z" fill="#5d8c6b" />
          <path d="M10 30h20l-3 18H13z" fill="#c98a5b" />
        </svg>
      </div>
      <span class="home-window__glass" aria-hidden="true"></span>
      <span class="home-window__lattice" aria-hidden="true"></span>
      <span class="home-window__shoji home-window__shoji--l" aria-hidden="true"></span>
      <span class="home-window__shoji home-window__shoji--r" aria-hidden="true"></span>
    </div>

    <div class="home-window__sill" aria-hidden="true"></div>
    <span class="home-window__spill" aria-hidden="true"></span>

    <div class="home-window__tag">
      <span class="home-window__tag-cords" aria-hidden="true"></span>
      <strong class="home-window__name">{{ name }}</strong>
      <span class="home-window__place">{{ city }} · {{ weather }}</span>
      <span class="home-window__mood">{{ mood }}</span>
      <span class="home-window__note">{{ note }}</span>
    </div>
  </article>
</template>
