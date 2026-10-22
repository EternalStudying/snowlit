<script setup lang="ts">
import './home.css';
import { computed, ref } from 'vue';
import { Images, MessageCircleHeart, NotebookPen } from 'lucide-vue-next';
import PageLoader from '../../components/PageLoader.vue';
import PostmarkStamp from '../../components/paper/PostmarkStamp.vue';
import partnerAAvatar from '../../assets/couple-avatars/partner-a.webp';
import partnerBAvatar from '../../assets/couple-avatars/partner-b.webp';
import { vTilt } from '../../directives/pointer';
import HomeOdometer from './components/HomeOdometer.vue';
import { useHomeLifecycle } from './internal/useHomeLifecycle';
import { useHomeStory } from './internal/useHomeStory';

const { overview: home } = useHomeLifecycle().state;
const root = ref<HTMLElement | null>(null);
useHomeStory(root, home);

const togetherDays = computed(() => home.value?.couple.togetherDays ?? 0);
const anniversary = computed(() => ({
  name: home.value?.couple.nextAnniversary.name || '下一纪念日',
  days: home.value?.couple.nextAnniversary.daysUntil ?? 0,
  date: home.value?.couple.nextAnniversary.date ?? ''
}));
const dailyNote = computed(() => ({
  sentence: home.value?.dailyNote.sentence || '今天也适合认真喜欢你。',
  weatherHint: home.value?.dailyNote.weatherHint || '天气待更新',
  activityHint: home.value?.dailyNote.activityHint || '一起留住今天'
}));
const latestDiary = computed(() => home.value?.latest.diary ?? null);
const latestMessage = computed(() => home.value?.latest.message ?? null);
const latestPhoto = computed(() => home.value?.latest.photo ?? null);
const latestAlbumPreviewPhotos = computed(() => (latestPhoto.value ? [latestPhoto.value] : []));
const nextWish = computed(() => home.value?.latest.wish ?? null);
const messageCount = computed(() => home.value?.stats.messageCount ?? 0);
const photoCount = computed(() => home.value?.stats.photoCount ?? 0);
const distanceLabel = computed(() => home.value?.distance.label || '距离正在更新');
const nextWishNote = computed(() => nextWish.value?.note || nextWish.value?.place || '');
const latestMessageAvatar = computed(() =>
  latestMessage.value && latestMessage.value.authorName === home.value?.couple.boyfriendName
    ? partnerAAvatar
    : partnerBAvatar
);

const coupleStatusCards = computed(() => {
  const statuses =
    home.value?.personStatuses.length
      ? home.value.personStatuses
      : [
          {
            role: 'boyfriend',
            name: home.value?.couple.boyfriendName ?? '伴侣 A',
            city: '', district: '', province: '', country: '',
            weather: '',
            temperature: null,
            mood: '',
            note: '',
            lastOnlineAt: null
          },
          {
            role: 'girlfriend',
            name: home.value?.couple.girlfriendName ?? '伴侣 B',
            city: '', district: '', province: '', country: '',
            weather: '',
            temperature: null,
            mood: '',
            note: '',
            lastOnlineAt: null
          }
        ];

  return statuses.map((person) => ({
    name: person.name || (person.role === 'girlfriend' ? '伴侣 B' : '伴侣 A'),
    avatar: person.role === 'girlfriend' ? partnerBAvatar : partnerAAvatar,
    city: [person.city, person.district, person.province, person.country]
      .find((value) => value && !/^(unknown|未知)$/i.test(value)) || '位置待更新',
    weather: formatStatusWeather(person.weather, person.temperature),
    mood: person.mood || '状态待更新',
    note: person.note || '等一下就同步近况',
    gender: person.role === 'girlfriend' ? '♀' : '♂'
  }));
});

// The stops the thread passes on its way from the first meeting to the next anniversary.
const threadStops = computed(() => [
  { key: 'met', value: formatDate(home.value?.couple.startedOn), label: '第一次相遇' },
  { key: 'messages', value: `${messageCount.value} 条`, label: '留下的留言' },
  { key: 'photos', value: `${photoCount.value} 张`, label: '共同的照片' },
  { key: 'next', value: `${anniversary.value.days} 天后`, label: anniversary.value.name }
]);

function formatStatusWeather(weather: string, temperature: number | null) {
  const temperatureText = temperature === null ? '' : `${Math.round(temperature)}°C`;
  return [weather, temperatureText].filter(Boolean).join(' ') || '天气待更新';
}

function formatDate(value?: string) {
  if (!value) {
    return '今天';
  }
  return value.split('T')[0].replaceAll('-', '.');
}

function formatMessageTime(value?: string) {
  if (!value) {
    return '刚刚';
  }
  const time = value.split('T')[1]?.slice(0, 5);
  return time || formatDate(value);
}
</script>

<template>
  <main ref="root" class="home">
    <template v-if="home">
      <section class="home-days" aria-label="我们在一起的日子">
        <div class="home-days__stage">
          <PostmarkStamp class="home-days__postmark" />
          <p class="home-days__lead">在一起的第</p>
          <h1 class="home-days__numeral">
            <HomeOdometer :value="togetherDays" :delay="0.3" />
            <span class="home-days__unit">天</span>
          </h1>
          <p class="home-days__quote">
            <span class="home-days__quote-line">朝暮与年岁并往，</span>
            <span class="home-days__quote-line">与你行至天光。</span>
          </p>
          <p class="home-days__anniversary ui-text">
            <span>下一纪念日</span>
            <strong>{{ anniversary.name }}</strong>
            <span>{{ formatDate(anniversary.date) }}</span>
          </p>

          <div class="home-thread">
            <svg class="home-thread__svg" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
              <path class="home-thread__ghost" d="M10 70 C 160 20, 260 110, 380 64 S 620 18, 740 66 S 920 104, 990 52" />
              <path class="home-thread__path" d="M10 70 C 160 20, 260 110, 380 64 S 620 18, 740 66 S 920 104, 990 52" />
            </svg>
            <ol class="home-thread__stops" aria-label="一路走来">
              <li v-for="stop in threadStops" :key="stop.key" class="home-stop" :data-stop="stop.key">
                <span class="home-stop__dot" aria-hidden="true"></span>
                <strong class="home-stop__value ui-text">{{ stop.value }}</strong>
                <span class="home-stop__label">{{ stop.label }}</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section class="home-today" aria-labelledby="home-today-title">
        <h2 id="home-today-title" class="home-section-title">今天</h2>
        <div class="home-today__grid">
          <article class="daily-note-card paper-sheet paper-sheet--ruled">
            <span class="washi washi--camellia daily-note-card__tape" aria-hidden="true"></span>
            <p class="daily-note-card__label">今日小纸条</p>
            <p class="daily-note-card__sentence">{{ dailyNote.sentence }}</p>
            <p class="daily-note-card__meta">
              <span class="paper-chip">{{ dailyNote.weatherHint }}</span>
              <span class="paper-chip">{{ dailyNote.activityHint }}</span>
            </p>
          </article>

          <div class="home-today__people">
            <article v-for="person in coupleStatusCards" :key="person.name" class="status-person-card paper-sheet">
              <img class="status-person-card__avatar" :src="person.avatar" :alt="`${person.name} 的头像`" loading="lazy" decoding="async" />
              <div class="status-person-card__body">
                <h3>
                  {{ person.name }}
                  <span aria-hidden="true">{{ person.gender }}</span>
                </h3>
                <p class="status-person-card__chips">
                  <span class="paper-chip">{{ person.city }}</span>
                  <span class="paper-chip">{{ person.weather }}</span>
                  <span class="paper-chip status-person-card__mood">{{ person.mood }}</span>
                </p>
                <p class="status-person-card__note">{{ person.note }}</p>
              </div>
            </article>
            <p class="distance-ribbon">
              <span class="distance-ribbon__text">{{ distanceLabel }}</span>
              <span class="distance-ribbon__tail">一起看着同一片云</span>
            </p>
          </div>
        </div>
      </section>

      <section class="home-recent" aria-labelledby="home-recent-title">
        <h2 id="home-recent-title" class="home-section-title">最近发生的小事</h2>
        <div class="recent-fan">
          <article class="recent-paper-item recent-paper-item--memory" data-fan="0">
            <RouterLink v-tilt class="recent-paper-card lamp-glow paper-sheet paper-sheet--ruled" to="/diary">
              <span class="lamp-glow__light" aria-hidden="true"></span>
              <span class="recent-paper-card__label"><NotebookPen :size="15" aria-hidden="true" />最新日记</span>
              <div class="recent-paper-card__copy">
                <h3>{{ latestDiary?.title ?? '一件很小但发光的事' }}</h3>
                <p>{{ latestDiary?.content ?? '把最近的小事慢慢收好。' }}</p>
                <p class="recent-paper-card__meta ui-text">
                  <span>{{ formatDate(latestDiary?.entryDate) }}</span>
                  <span v-if="latestDiary?.tag" class="paper-chip">{{ latestDiary.tag }}</span>
                </p>
              </div>
            </RouterLink>
          </article>

          <article class="recent-paper-item recent-paper-item--message" data-fan="1">
            <RouterLink v-tilt class="recent-paper-card recent-paper-card--message lamp-glow paper-sheet" to="/messages">
              <span class="lamp-glow__light" aria-hidden="true"></span>
              <span class="recent-paper-card__label"><MessageCircleHeart :size="15" aria-hidden="true" />最新留言</span>
              <div class="recent-message-author">
                <img
                  class="recent-message-author__avatar"
                  :src="latestMessageAvatar"
                  :alt="`${latestMessage?.authorName ?? home.couple.girlfriendName} 的头像`"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h3>{{ latestMessage?.authorName ?? home.couple.girlfriendName }}</h3>
                  <small class="ui-text">{{ formatDate(latestMessage?.createdAt) }} {{ formatMessageTime(latestMessage?.createdAt) }}</small>
                </div>
              </div>
              <p>{{ latestMessage?.content ?? '还没有留言，去写下第一张小纸条吧。' }}</p>
            </RouterLink>
          </article>

          <article class="recent-paper-item recent-paper-item--album" data-fan="2">
            <RouterLink v-tilt class="recent-paper-card recent-paper-card--album lamp-glow paper-sheet" to="/album">
              <span class="lamp-glow__light" aria-hidden="true"></span>
              <span class="recent-paper-card__label"><Images :size="15" aria-hidden="true" />最新相册</span>
              <div class="album-preview-strip">
                <img
                  v-for="photo in latestAlbumPreviewPhotos"
                  :key="photo.id"
                  :src="photo.previewUrl"
                  :alt="photo.caption"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div class="album-preview-footer">
                <h3>{{ latestPhoto?.caption ?? '最近一张照片' }}</h3>
                <small class="ui-text">共 {{ photoCount }} 张照片</small>
              </div>
            </RouterLink>
          </article>
        </div>
      </section>

      <section class="home-next" aria-labelledby="home-next-title">
        <h2 id="home-next-title" class="home-section-title">下一件想一起完成的事</h2>
        <RouterLink v-tilt="3" class="next-plan-strip lamp-glow" to="/wishes">
          <span class="lamp-glow__light" aria-hidden="true"></span>
          <svg class="next-plan-strip__check" viewBox="0 0 48 48" aria-hidden="true">
            <rect class="next-plan-strip__box" x="4" y="4" width="40" height="40" rx="7" />
            <path class="next-plan-strip__tick" d="M13 25 L21 33 L36 15" />
          </svg>
          <span class="next-plan-strip__copy">
            <strong>{{ nextWish?.title ?? '一起去看海' }}</strong>
            <span v-if="nextWishNote">{{ nextWishNote }}</span>
          </span>
          <span class="next-plan-strip__go ui-text">去清单看看</span>
        </RouterLink>
      </section>
    </template>

    <PageLoader :loading="!home" />
  </main>
</template>
