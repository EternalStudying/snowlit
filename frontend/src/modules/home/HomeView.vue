<script setup lang="ts">
import './home-paper.css';
import './home.css';
import './home-responsive.css';
import { computed, ref } from 'vue';
import MotionCountUp from '../../components/motion/MotionCountUp.vue';
import PageLoader from '../../components/PageLoader.vue';
import partnerAAvatar from '../../assets/couple-avatars/partner-a.webp';
import partnerBAvatar from '../../assets/couple-avatars/partner-b.webp';
import bowRed from './assets/paper/bow-red.webp';
import flowerSprig from './assets/paper/flower-sprig.webp';
import paperCardSmall from './assets/paper/paper-card-small.webp';
import paperLedgerWide from './assets/paper/paper-ledger-wide.webp';
import paperMessageNote from './assets/paper/paper-message-note.webp';
import paperNoteWide from './assets/paper/paper-note-wide.webp';
import paperStripSage from './assets/paper/paper-strip-sage.webp';
import paperTicketStrip from './assets/paper/paper-ticket-strip.webp';
import tapeBeige from './assets/paper/tape-beige.webp';
import tapeCoral from './assets/paper/tape-coral.webp';
import tapeSage from './assets/paper/tape-sage.webp';
import flowerSprigSmall from './assets/paper/flower-sprig-small.webp';
import memoryLedgerCard from './assets/paper/memory-ledger-card.webp';
import statIconCalendar from './assets/paper/stat-icon-calendar.webp';
import statIconGift from './assets/paper/stat-icon-gift.webp';
import statIconMessage from './assets/paper/stat-icon-message.webp';
import statIconPhoto from './assets/paper/stat-icon-photo.webp';
import { useHomeLifecycle } from './internal/useHomeLifecycle';
import { useHomeMotion } from './internal/useHomeMotion';
import { useHomePaperIntro } from './internal/useHomePaperIntro';

const { overview: home } = useHomeLifecycle().state;
const {
  moduleEnabledAttr: motionModuleEnabledAttr,
  isCountUpEnabled
} = useHomeMotion();
const { paperIntroRef } = useHomePaperIntro(home);

const paperAssets = {
  bowRed,
  flowerSprig,
  flowerSprigSmall,
  memoryLedgerCard,
  paperCardSmall,
  paperLedgerWide,
  paperMessageNote,
  paperNoteWide,
  paperStripSage,
  paperTicketStrip,
  tapeBeige,
  tapeCoral,
  tapeSage
} as const;

const progressStatIcons = {
  calendar: statIconCalendar,
  gift: statIconGift,
  message: statIconMessage,
  photo: statIconPhoto
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
const progressLedgerBackgroundReady = ref(false);
const progressLedgerRevealFinished = ref(false);
const progressLedgerCountUpStarted = computed(
  () => progressLedgerBackgroundReady.value && progressLedgerRevealFinished.value
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
  { value: togetherDays.value, unit: '天', label: '我们在一起的日子', icon: 'calendar', iconSrc: progressStatIcons.calendar },
  { value: anniversary.value.days, unit: '天后', label: '下一个纪念日', icon: 'gift', iconSrc: progressStatIcons.gift },
  { value: messageCount.value, unit: '条', label: '留下的留言', icon: 'message', iconSrc: progressStatIcons.message },
  { value: photoCount.value, unit: '张', label: '共同的照片', icon: 'photo', iconSrc: progressStatIcons.photo }
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

function markProgressLedgerBackgroundReady() {
  progressLedgerBackgroundReady.value = true;
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
            class="home-memory-card paper-image-shell memory-ledger-shell"
            aria-label="纪念日信息"
            data-motion-module="memoryCard"
            :data-motion-enabled="motionModuleEnabledAttr('memoryCard')"
          >
            <img
              class="paper-image-shell__texture"
              :src="paperAssets.memoryLedgerCard"
              alt=""
              aria-hidden="true"
              draggable="false"
              loading="lazy"
              decoding="async"
            />
            <img
              class="memory-ledger-shell__flower memory-ledger-shell__flower--left"
              :src="paperAssets.flowerSprigSmall"
              alt=""
              aria-hidden="true"
              draggable="false"
              loading="lazy"
              decoding="async"
            />
            <img
              class="memory-ledger-shell__flower memory-ledger-shell__flower--right"
              :src="paperAssets.flowerSprigSmall"
              alt=""
              aria-hidden="true"
              draggable="false"
              loading="lazy"
              decoding="async"
            />
            <div class="paper-image-shell__content home-memory-card__content">
              <div class="home-memory-card__copy">
                <p class="home-memory-card__line">
                  朝暮与年岁并往，<br />
                  与你行至天光。
                </p>
                <p class="home-memory-card__anniversary">
                  <span class="home-memory-card__anniversary-label">下一纪念日</span>
                  <span class="home-memory-card__anniversary-detail">
                    <strong>{{ anniversary.days }} 天后</strong> · {{ anniversary.name }} · {{ formatDate(anniversary.date) }}
                  </span>
                </p>
              </div>

              <div class="home-memory-card__stats">
                <strong class="home-memory-card__days">
                  <MotionCountUp
                    :value="togetherDays"
                    :enabled="isCountUpEnabled"
                  />
                </strong>
                <span>DAYS</span>
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
            :data-motion-enabled="motionModuleEnabledAttr('dailyNote')"
          >
            <div class="dashboard-section-heading">
              <h2 id="daily-note-title">今日小纸条</h2>
              <span aria-hidden="true">♡</span>
            </div>
            <article class="daily-note-card paper-asset paper-asset--note">
              <img class="paper-asset__texture" :src="paperAssets.paperNoteWide" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
              <img class="paper-tape paper-tape--coral daily-note-card__tape" :src="paperAssets.tapeCoral" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
              <img class="paper-flower daily-note-card__flower" :src="paperAssets.flowerSprig" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
              <div class="paper-asset__content">
              <p class="daily-note-card__sentence">{{ dailyNote.sentence }}</p>
              <p class="daily-note-card__meta">
                <span>{{ dailyNote.weatherHint }}</span>
                <span>{{ dailyNote.activityHint }}</span>
              </p>
            </div>
            </article>
          </section>

          <section
            :ref="paperIntroRef('statusCards')"
            class="couple-status-panel"
            aria-labelledby="couple-status-title"
            data-motion-module="statusCards"
            :data-motion-enabled="motionModuleEnabledAttr('statusCards')"
          >
            <div class="dashboard-section-heading">
              <h2 id="couple-status-title">我们的今日状态</h2>
              <span aria-hidden="true">♧</span>
            </div>

            <div class="status-card-grid">
              <article
                v-for="person in coupleStatusCards"
                :key="person.name"
                class="status-person-card paper-piece paper-piece--card"
              >
                <img class="status-person-card__avatar" :src="person.avatar" :alt="`${person.name} 的头像`" loading="lazy" decoding="async" />
                <div class="status-person-card__body">
                  <h3>
                    {{ person.name }}
                    <span>{{ person.gender }}</span>
                  </h3>
                  <p class="status-person-card__chips">
                    <span>{{ person.city }}</span>
                    <span>☁ {{ person.weather }}</span>
                  </p>
                  <p class="status-person-card__mood">☺ {{ person.mood }}</p>
                  <p class="status-person-card__note">{{ person.note }}</p>
                </div>
              </article>
            </div>

            <p class="distance-ribbon paper-asset paper-asset--ticket">
              <img class="paper-asset__texture" :src="paperAssets.paperTicketStrip" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
              <img class="paper-bow distance-ribbon__bow" :src="paperAssets.bowRed" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
              <span class="paper-asset__content">
                {{ distanceLabel }} · 一起看着同一片云 ☁
              </span>
            </p>
          </section>
        </div>

        <section
          :ref="paperIntroRef('progressLedger')"
          class="progress-ledger-section"
          aria-labelledby="progress-ledger-title"
          data-motion-module="progressLedger"
          :data-motion-enabled="motionModuleEnabledAttr('progressLedger')"
          @animationend="handleProgressLedgerRevealEnd"
        >
          <div class="dashboard-section-heading">
            <h2 id="progress-ledger-title">恋爱进度仪表</h2>
            <span aria-hidden="true">♡</span>
          </div>
          <div class="progress-ledger paper-asset paper-asset--ledger">
            <span class="visually-hidden">恋爱进度仪表</span>
            <img
              class="paper-asset__texture"
              :src="paperAssets.paperLedgerWide"
              alt=""
              aria-hidden="true"
              draggable="false"
              loading="lazy"
              decoding="async"
              @load="markProgressLedgerBackgroundReady"
              @error="markProgressLedgerBackgroundReady"
            />
            <div class="paper-asset__content">
            <div class="progress-stat-grid">
              <article v-for="stat in progressStats" :key="stat.label" class="progress-stat-card">
                <span
                  class="progress-stat-card__icon"
                  :class="`progress-stat-card__icon--${stat.icon}`"
                  aria-hidden="true"
                >
                  <img :src="stat.iconSrc" alt="" draggable="false" loading="lazy" decoding="async" />
                </span>
                <p>
                  <strong>
                    <MotionCountUp
                      :value="stat.value"
                      :enabled="isCountUpEnabled"
                      :start="progressLedgerCountUpStarted || !isCountUpEnabled"
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
            <div class="progress-ledger__labels">
              <span>第一次相遇<br />{{ formatDate(home.couple.startedOn) }}</span>
              <span>未来的每一天</span>
            </div>
            </div>
          </div>
        </section>

        <section
          :ref="paperIntroRef('recentCards')"
          class="recent-moments"
          aria-labelledby="recent-moments-title"
          data-motion-module="recentCards"
          :data-motion-enabled="motionModuleEnabledAttr('recentCards')"
        >
          <div class="dashboard-section-heading dashboard-section-heading--wide">
            <h2 id="recent-moments-title">最近发生的小事</h2>
            <span aria-hidden="true">☆</span>
          </div>

          <div class="recent-grid">
            <article class="recent-paper-item recent-paper-item--memory">
              <span class="recent-paper-card__label">最新点滴</span>
              <RouterLink
                class="recent-paper-card recent-paper-card--memory paper-asset paper-asset--card"
                to="/story"
              >
                <img class="paper-asset__texture" :src="paperAssets.paperCardSmall" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
                <img class="paper-tape paper-tape--beige recent-paper-card__tape recent-paper-card__tape--left" :src="paperAssets.tapeBeige" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
                <div class="paper-asset__content">
                <figure v-if="latestPhoto" class="recent-paper-card__photo">
                  <img :src="latestPhoto.previewUrl" :alt="latestPhoto.caption" loading="lazy" decoding="async" />
                </figure>
                <div class="recent-paper-card__copy">
                  <h3>{{ latestDiary?.title ?? '一件很小但发光的事' }}</h3>
                  <p>{{ latestDiary?.content ?? '把最近的小事慢慢收好。' }}</p>
                  <small>{{ formatDate(latestDiary?.entryDate) }} · {{ latestDiary?.tag ?? '日常' }}</small>
                </div>
              </div>
              </RouterLink>
            </article>

            <article class="recent-paper-item recent-paper-item--message">
              <span class="recent-paper-card__label">最新留言</span>
              <RouterLink
                class="recent-paper-card recent-paper-card--message paper-asset paper-asset--message"
                to="/messages"
              >
                <img class="paper-asset__texture" :src="paperAssets.paperMessageNote" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
                <div class="paper-asset__content">
                <div class="recent-message-author">
                  <img
                    class="recent-message-author__avatar"
                    :src="partnerBAvatar"
                    :alt="`${latestMessage?.authorName ?? home.couple.girlfriendName} 的头像`"
                    loading="lazy"
                    decoding="async"
                  />
                  <div>
                    <h3>{{ latestMessage?.authorName ?? home.couple.girlfriendName }}</h3>
                    <small>{{ formatDate(latestMessage?.createdAt) }} {{ formatMessageTime(latestMessage?.createdAt) }}</small>
                  </div>
                </div>
                <p>{{ latestMessage?.content ?? '还没有留言，去写下第一张小纸条吧。' }}</p>
              </div>
              </RouterLink>
            </article>

            <article class="recent-paper-item recent-paper-item--album">
              <span class="recent-paper-card__label">最新相册</span>
              <RouterLink
                class="recent-paper-card recent-paper-card--album paper-asset paper-asset--card"
                to="/album"
              >
                <img class="paper-asset__texture" :src="paperAssets.paperCardSmall" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
                <img class="paper-tape paper-tape--coral recent-paper-card__tape recent-paper-card__tape--right" :src="paperAssets.tapeCoral" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
                <div class="paper-asset__content">
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
                  <small>共 {{ photoCount }} 张照片 ›</small>
                </div>
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
          :data-motion-enabled="motionModuleEnabledAttr('nextPlan')"
        >
          <div class="dashboard-section-heading dashboard-section-heading--wide">
            <h2 id="next-plan-title">下一件想一起完成的事</h2>
            <span aria-hidden="true">♡</span>
          </div>
          <div class="next-plan-strip paper-asset paper-asset--strip">
            <span class="visually-hidden">下一件想一起完成的事</span>
            <img class="paper-asset__texture" :src="paperAssets.paperStripSage" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
            <img class="paper-tape next-plan-strip__tape" :src="paperAssets.tapeSage" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
            <div class="paper-asset__content next-plan-strip__content">
            <span class="next-plan-strip__check" aria-hidden="true">✓</span>
            <div>
              <h2>{{ nextWish?.title ?? '一起去看海' }}</h2>
              <span>吹海风、踩沙滩、看日落 🌊</span>
            </div>
            <p class="next-plan-strip__date">
              目标时间
              <strong>{{ formatDate(anniversary.date) }}</strong>
            </p>
            <img class="paper-flower next-plan-strip__flower" :src="paperAssets.flowerSprig" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async" />
            <RouterLink class="next-plan-strip__link" to="/wishes">
              去清单看看
              <span aria-hidden="true">→</span>
            </RouterLink>
            </div>
          </div>
        </section>
      </section>

    </template>

    <PageLoader :loading="!home" />
  </main>
</template>
