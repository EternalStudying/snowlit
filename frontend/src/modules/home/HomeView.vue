<script setup lang="ts">
import './home.css';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import partnerAAvatar from '../../assets/couple-avatars/partner-a.webp';
import partnerBAvatar from '../../assets/couple-avatars/partner-b.webp';
import { burstPetals } from '../../shell/world/ambientDrift';
import HomeLetter from './components/HomeLetter.vue';
import HomeWindow from './components/HomeWindow.vue';
import { useHomeLifecycle } from './internal/useHomeLifecycle';
import { useHomeEvening } from './internal/useHomeEvening';

/*
 * Home is one evening at the snow cottage, read top to bottom:
 * a string of lanterns lights up as the days together count up; two lit windows, one for each of you,
 * joined by a red thread; today's letter; the latest diary, message and photos laid on the table; and the
 * next wish hanging as an ema plaque.
 */

const { overview: home } = useHomeLifecycle().state;
const root = ref<HTMLElement | null>(null);
const evening = useHomeEvening(root, home);
const router = useRouter();

const LANTERN_COUNT = 11;

// Lanterns hang along the cord "M0 18 Q300 96 600 40 T1200 24" (a 1200×120 drawing stretched to the width).
// Points come from the curve itself, so they sit on the cord without measuring the page.
function cordPoint(fraction: number) {
  const second = fraction >= 0.5;
  const t = second ? fraction * 2 - 1 : fraction * 2;
  const [x0, y0, cx, cy, x1, y1] = second ? [600, 40, 900, -16, 1200, 24] : [0, 18, 300, 96, 600, 40];
  const u = 1 - t;
  return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
}
const lanternStyles = Array.from({ length: LANTERN_COUNT }, (_, index) => {
  const point = cordPoint((index + 0.5) / LANTERN_COUNT);
  return { left: `${(point.x / 1200) * 100}%`, top: `${point.y + 14}px` };
});

const togetherDays = computed(() => home.value?.couple.togetherDays ?? 0);
const startedOn = computed(() => formatDate(home.value?.couple.startedOn));
const anniversary = computed(() => ({
  name: home.value?.couple.nextAnniversary.name || '下一纪念日',
  days: home.value?.couple.nextAnniversary.daysUntil ?? 0,
  date: formatDate(home.value?.couple.nextAnniversary.date)
}));
const dailyNote = computed(() => ({
  date: home.value?.dailyNote.date || '',
  sentence: home.value?.dailyNote.sentence || '今天也适合认真喜欢你。',
  weatherHint: home.value?.dailyNote.weatherHint || '天气待更新',
  activityHint: home.value?.dailyNote.activityHint || '一起留住今天'
}));
const messageCount = computed(() => home.value?.stats.messageCount ?? 0);
const photoCount = computed(() => home.value?.stats.photoCount ?? 0);
const distanceLabel = computed(() => home.value?.distance.label || '距离正在更新');

const latestDiary = computed(() => home.value?.latest.diary ?? null);
const latestMessage = computed(() => home.value?.latest.message ?? null);
const latestPhoto = computed(() => home.value?.latest.photo ?? null);
const nextWish = computed(() => home.value?.latest.wish ?? null);
const nextWishNote = computed(() => nextWish.value?.note || nextWish.value?.place || '');
const latestMessageAvatar = computed(() =>
  latestMessage.value && latestMessage.value.authorName === home.value?.couple.boyfriendName ? partnerAAvatar : partnerBAvatar
);

const windows = computed(() => {
  const statuses = home.value?.personStatuses.length
    ? home.value.personStatuses
    : [
        { role: 'boyfriend', name: home.value?.couple.boyfriendName ?? '', city: '', weather: '', temperature: null, mood: '', note: '' },
        { role: 'girlfriend', name: home.value?.couple.girlfriendName ?? '', city: '', weather: '', temperature: null, mood: '', note: '' }
      ];
  return statuses.map((person) => {
    const isB = person.role === 'girlfriend';
    const places = [person.city, 'district' in person ? person.district : '', 'province' in person ? person.province : '', 'country' in person ? person.country : ''];
    return {
      key: person.role,
      name: person.name || (isB ? '伴侣 B' : '伴侣 A'),
      avatar: isB ? partnerBAvatar : partnerAAvatar,
      city: places.find((value) => value && !/^(unknown|未知)$/i.test(value)) || '位置待更新',
      weather: formatWeather(person.weather, person.temperature),
      mood: person.mood || '状态待更新',
      note: person.note || '等一下就同步近况',
      tone: (isB ? 'sakura' : 'pine') as 'pine' | 'sakura'
    };
  });
});

function formatWeather(weather: string, temperature: number | null) {
  const degrees = temperature === null ? '' : `${Math.round(temperature)}°C`;
  return [weather, degrees].filter(Boolean).join(' ') || '天气待更新';
}

function formatDate(value?: string | null) {
  if (!value) {
    return '今天';
  }
  return value.split('T')[0].replaceAll('-', '.');
}

function formatTime(value?: string) {
  if (!value) {
    return '刚刚';
  }
  return value.split('T')[1]?.slice(0, 5) || formatDate(value);
}

/** Diary content is Markdown; the table only shows its words. */
function plainExcerpt(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The plaque swings and scatters petals first; the wish list opens once it has had its moment.
async function openWishes(event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (event.button ?? 0) !== 0) {
    return;
  }
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  burstPetals(rect.left + rect.width / 2, rect.top + rect.height * 0.6);
  await evening.swingEma();
  await router.push('/wishes');
}
</script>

<template>
  <main ref="root" class="home">
    <template v-if="home">
      <!-- Days: the lanterns light up one by one as the count climbs to today. -->
      <section class="home-days" aria-labelledby="home-days-title">
        <svg class="home-days__string" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
          <path class="home-days__cord" d="M0 18 Q300 96 600 40 T1200 24" />
        </svg>
        <ol class="home-days__lanterns" aria-hidden="true">
          <li
            v-for="index in LANTERN_COUNT"
            :key="index"
            class="home-lantern"
            :class="{ 'home-lantern--sakura': index % 3 === 2 }"
            :data-lantern="index - 1"
            :style="lanternStyles[index - 1]"
          >
            <span class="home-lantern__glow"></span>
            <span class="home-lantern__body"></span>
            <span class="home-lantern__tassel"></span>
          </li>
        </ol>
        <p class="home-days__lead">今天是我们在一起的</p>
        <h1 id="home-days-title" class="home-days__count">
          <span class="home-days__number" :data-target="togetherDays">{{ togetherDays }}</span>
          <span class="home-days__unit">天</span>
        </h1>
        <p class="home-days__quote">
          <span>朝暮与年岁并往，</span><span>与你行至天光。</span>
        </p>
        <p class="home-days__since">从 {{ startedOn }} 开始，已经留下 {{ messageCount }} 条留言、{{ photoCount }} 张照片。</p>
        <div class="home-days__tag">
          <span class="home-days__tag-hole" aria-hidden="true"></span>
          <strong>{{ anniversary.days }} 天后</strong>
          <span>{{ anniversary.name }} · {{ anniversary.date }}</span>
        </div>
      </section>

      <!-- Today: two lit windows, one for each of you, joined by a red thread. -->
      <section class="home-today" aria-labelledby="home-today-title">
        <h2 id="home-today-title" class="home-title">今天，我们在各自的窗边</h2>
        <div class="home-today__windows">
          <HomeWindow v-bind="windows[0]" />
          <div class="home-thread" :aria-label="distanceLabel">
            <svg viewBox="0 0 220 150" aria-hidden="true">
              <path class="home-thread__line" d="M2 56 C 40 20, 80 96, 110 64 S 178 22, 218 56" />
              <g class="home-thread__knot" transform="translate(110 64)">
                <path d="M0 0c-10-12-22-6-16 2 4 5 12 2 16-2zM0 0c10-12 22-6 16 2-4 5-12 2-16-2z" />
                <circle r="3.6" />
                <path class="home-thread__tails" d="M-1 2c-4 10-10 16-14 22M1 2c4 10 8 18 14 22" />
              </g>
            </svg>
            <p class="home-thread__tag">{{ distanceLabel }}</p>
          </div>
          <HomeWindow v-if="windows[1]" v-bind="windows[1]" />
        </div>

        <HomeLetter v-bind="dailyNote" />
      </section>

      <!-- Recent: the last diary page, the last message and the newest photos, laid on the table. -->
      <section class="home-recent" aria-labelledby="home-recent-title">
        <h2 id="home-recent-title" class="home-title">最近发生的小事</h2>
        <div class="home-recent__table">
          <RouterLink class="home-notebook" to="/diary">
            <span class="home-notebook__ribbon" aria-hidden="true"></span>
            <template v-if="latestDiary">
              <span class="home-notebook__kind">最新日记 · {{ formatDate(latestDiary.entryDate) }}</span>
              <strong class="home-notebook__title">{{ latestDiary.title }}</strong>
              <span class="home-notebook__body">{{ plainExcerpt(latestDiary.content) }}</span>
              <span v-if="latestDiary.tag" class="home-notebook__mood">{{ latestDiary.tag }}</span>
            </template>
            <template v-else>
              <span class="home-notebook__kind">日记</span>
              <strong class="home-notebook__title">还没有日记</strong>
              <span class="home-notebook__body">写下今天的第一页吧。</span>
            </template>
          </RouterLink>

          <RouterLink class="home-omikuji" to="/messages">
            <span class="home-omikuji__kind">最新留言</span>
            <template v-if="latestMessage">
              <span class="home-omikuji__body">{{ latestMessage.content }}</span>
              <span class="home-omikuji__who">
                <img :src="latestMessageAvatar" alt="" />
                {{ latestMessage.authorName }} · {{ formatTime(latestMessage.createdAt) }}
              </span>
            </template>
            <span v-else class="home-omikuji__body">还没有留言，先写一句吧。</span>
          </RouterLink>

          <RouterLink class="home-photos" to="/album" :aria-label="latestPhoto ? `最新相册：${latestPhoto.caption}，共 ${photoCount} 张照片` : '去相册上传第一张照片'">
            <span class="home-photos__stack" aria-hidden="true">
              <span class="home-photo home-photo--back"></span>
              <span class="home-photo home-photo--back"></span>
              <span class="home-photo home-photo--front">
                <img v-if="latestPhoto" :src="latestPhoto.previewUrl" :alt="latestPhoto.caption" loading="lazy" />
                <span v-else class="home-photo__empty">还没有照片</span>
              </span>
            </span>
            <span class="home-photos__caption">
              <strong>{{ latestPhoto?.caption || '相册' }}</strong>
              <small>共 {{ photoCount }} 张照片</small>
            </span>
          </RouterLink>
        </div>
      </section>

      <!-- Next: the wish hangs as an ema plaque; touching it gives it a push before it opens the list. -->
      <section class="home-next" aria-labelledby="home-next-title">
        <h2 id="home-next-title" class="home-title">下一件想一起完成的事</h2>
        <a class="home-ema" href="/wishes" @click="openWishes">
          <span class="home-ema__cord" aria-hidden="true"></span>
          <span class="home-ema__board">
            <strong>{{ nextWish?.title || '写下第一件想一起做的事' }}</strong>
            <span v-if="nextWishNote">{{ nextWishNote }}</span>
            <em>去清单看看</em>
          </span>
        </a>
        <p class="home-next__close">把每一个普通的晚上，都点成一盏灯。</p>
      </section>
    </template>
  </main>
</template>
