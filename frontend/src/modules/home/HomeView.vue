<script setup lang="ts">
import './home.css';
import './home-motion.css';
import { computed, ref } from 'vue';
import { CalendarHeart, Check, Gift, Images, MessageCircleHeart } from 'lucide-vue-next';
import { prefersReducedMotion } from '../../motion';
import MotionCountUp from '../../components/motion/MotionCountUp.vue';
import PageLoader from '../../components/PageLoader.vue';
import PostmarkStamp from '../../components/paper/PostmarkStamp.vue';
import partnerAAvatar from '../../assets/couple-avatars/partner-a.webp';
import partnerBAvatar from '../../assets/couple-avatars/partner-b.webp';
import { useHomeLifecycle } from './internal/useHomeLifecycle';
import { useHomePaperIntro } from './internal/useHomePaperIntro';

const { overview: home } = useHomeLifecycle().state;
const isCountUpEnabled = !prefersReducedMotion();
const { paperIntroRef } = useHomePaperIntro(home);

const progressStatIcons = {
  calendar: CalendarHeart,
  gift: Gift,
  message: MessageCircleHeart,
  photo: Images
} as const;

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
const progressLedgerRevealFinished = ref(false);
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

const progressStats = computed(() => [
  { value: togetherDays.value, unit: '天', label: '我们在一起的日子', icon: 'calendar', iconComponent: progressStatIcons.calendar },
  { value: anniversary.value.days, unit: '天后', label: '下一个纪念日', icon: 'gift', iconComponent: progressStatIcons.gift },
  { value: messageCount.value, unit: '条', label: '留下的留言', icon: 'message', iconComponent: progressStatIcons.message },
  { value: photoCount.value, unit: '张', label: '共同的照片', icon: 'photo', iconComponent: progressStatIcons.photo }
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

function handleProgressLedgerRevealEnd(event: AnimationEvent) {
  if (event.target !== event.currentTarget) {
    return;
  }

  if (event.animationName && event.animationName !== 'home-motion-module-reveal') {
    return;
  }

  progressLedgerRevealFinished.value = true;
}
</script>


<template>
  <main>
    <template v-if="home">
      <section class="home-cozy-intro" aria-label="首页纪念日信息">
        <article
          :ref="paperIntroRef('memoryCard')"
          class="home-memory-card paper-sheet paper-sheet--ruled"
          aria-label="纪念日信息"
          data-motion-module="memoryCard"
          data-motion-enabled="true"
        >
          <span class="washi washi--top home-memory-card__tape" aria-hidden="true"></span>
          <PostmarkStamp class="home-memory-card__postmark" />
          <div class="home-memory-card__content">
            <div class="home-memory-card__copy">
              <p class="home-memory-card__line">
                朝暮与年岁并往，<br />
                与你行至天光。
              </p>
              <p class="home-memory-card__anniversary">
                <span class="home-memory-card__anniversary-label">下一纪念日</span>
                <span class="home-memory-card__anniversary-detail ui-text">
                  <strong>{{ anniversary.days }} 天后</strong>
                  <span>{{ anniversary.name }}</span>
                  <span>{{ formatDate(anniversary.date) }}</span>
                </span>
              </p>
            </div>

            <div class="home-memory-card__stats">
              <span class="home-memory-card__stats-label">在一起</span>
              <strong class="home-memory-card__days">
                <MotionCountUp :value="togetherDays" :enabled="isCountUpEnabled" />
              </strong>
              <span class="home-memory-card__stats-unit">天</span>
            </div>
          </div>
        </article>
      </section>

      <section class="daily-dashboard" aria-labelledby="daily-dashboard-title">
        <div class="daily-dashboard__top">
          <section
            :ref="paperIntroRef('dailyNote')"
            class="daily-note-block"
            aria-labelledby="daily-note-title"
            data-motion-module="dailyNote"
            data-motion-enabled="true"
          >
            <div class="dashboard-section-heading">
              <h2 id="daily-note-title">今日小纸条</h2>
            </div>
            <article class="daily-note-card paper-sheet paper-sheet--ruled">
              <span class="washi washi--camellia daily-note-card__tape" aria-hidden="true"></span>
              <p class="daily-note-card__sentence">{{ dailyNote.sentence }}</p>
              <p class="daily-note-card__meta">
                <span class="paper-chip">{{ dailyNote.weatherHint }}</span>
                <span class="paper-chip">{{ dailyNote.activityHint }}</span>
              </p>
            </article>
          </section>

          <section
            :ref="paperIntroRef('statusCards')"
            class="couple-status-panel"
            aria-labelledby="couple-status-title"
            data-motion-module="statusCards"
            data-motion-enabled="true"
          >
            <div class="dashboard-section-heading">
              <h2 id="couple-status-title">我们的今日状态</h2>
            </div>

            <div class="status-card-grid">
              <article
                v-for="person in coupleStatusCards"
                :key="person.name"
                class="status-person-card paper-sheet"
              >
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
            </div>

            <p class="distance-ribbon">
              <span class="distance-ribbon__text">{{ distanceLabel }}</span>
              <span class="distance-ribbon__tail">一起看着同一片云</span>
            </p>
          </section>
        </div>

        <section
          :ref="paperIntroRef('progressLedger')"
          class="progress-ledger-section"
          aria-labelledby="progress-ledger-title"
          data-motion-module="progressLedger"
          data-motion-enabled="true"
          @animationend="handleProgressLedgerRevealEnd"
        >
          <div class="dashboard-section-heading">
            <h2 id="progress-ledger-title">恋爱进度仪表</h2>
          </div>
          <div class="progress-ledger paper-sheet">
            <div class="progress-stat-grid">
              <article v-for="stat in progressStats" :key="stat.label" class="progress-stat-card">
                <span
                  class="progress-stat-card__icon"
                  :class="`progress-stat-card__icon--${stat.icon}`"
                  aria-hidden="true"
                >
                  <component :is="stat.iconComponent" :size="22" :stroke-width="1.6" />
                </span>
                <p>
                  <strong>
                    <MotionCountUp
                      :value="stat.value"
                      :enabled="isCountUpEnabled"
                      :start="progressLedgerRevealFinished || !isCountUpEnabled"
                    />
                  </strong>
                  <span>{{ stat.unit }}</span>
                </p>
                <small>{{ stat.label }}</small>
              </article>
            </div>
            <div class="progress-thread" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="progress-ledger__labels ui-text">
              <span>第一次相遇 {{ formatDate(home.couple.startedOn) }}</span>
              <span>未来的每一天</span>
            </div>
          </div>
        </section>

        <section
          :ref="paperIntroRef('recentCards')"
          class="recent-moments"
          aria-labelledby="recent-moments-title"
          data-motion-module="recentCards"
          data-motion-enabled="true"
        >
          <div class="dashboard-section-heading dashboard-section-heading--wide">
            <h2 id="recent-moments-title">最近发生的小事</h2>
          </div>

          <div class="recent-grid">
            <article class="recent-paper-item recent-paper-item--memory">
              <span class="recent-paper-card__label">最新日记</span>
              <RouterLink class="recent-paper-card recent-paper-card--memory paper-sheet" to="/diary">
                <span class="washi recent-paper-card__tape recent-paper-card__tape--top" aria-hidden="true"></span>
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

            <article class="recent-paper-item recent-paper-item--message">
              <span class="recent-paper-card__label">最新留言</span>
              <RouterLink class="recent-paper-card recent-paper-card--message paper-sheet" to="/messages">
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

            <article class="recent-paper-item recent-paper-item--album">
              <span class="recent-paper-card__label">最新相册</span>
              <RouterLink class="recent-paper-card recent-paper-card--album paper-sheet" to="/album">
                <span class="washi washi--camellia recent-paper-card__tape recent-paper-card__tape--right" aria-hidden="true"></span>
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

        <section
          :ref="paperIntroRef('nextPlan')"
          class="next-plan-section"
          aria-labelledby="next-plan-title"
          data-motion-module="nextPlan"
          data-motion-enabled="true"
        >
          <div class="dashboard-section-heading dashboard-section-heading--wide">
            <h2 id="next-plan-title">下一件想一起完成的事</h2>
          </div>
          <div class="next-plan-strip paper-sheet">
            <span class="washi washi--pine next-plan-strip__tape" aria-hidden="true"></span>
            <div class="next-plan-strip__content">
              <span class="next-plan-strip__check" aria-hidden="true"><Check :size="20" :stroke-width="2" /></span>
              <div>
                <h3>{{ nextWish?.title ?? '一起去看海' }}</h3>
                <span v-if="nextWishNote">{{ nextWishNote }}</span>
              </div>
              <RouterLink class="next-plan-strip__link" to="/wishes">去清单看看</RouterLink>
            </div>
          </div>
        </section>
      </section>
    </template>

    <PageLoader :loading="!home" />
  </main>
</template>
