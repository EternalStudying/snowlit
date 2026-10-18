<script setup lang="ts">
import { prefersReducedMotion } from '../../motion';
import './diary.css';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref
} from 'vue';
import { NButton } from 'naive-ui';
import PageLoader from '../../components/PageLoader.vue';
import { useWeatherAtmosphereData } from '../weather';
import DiaryMarkdownEditor from './components/DiaryMarkdownEditor.vue';
import DiaryTimelineGlow from './components/DiaryTimelineGlow.vue';
import diaryCardBackground01 from './assets/cards/diary-card-imagegen-v01.webp';
import diaryCardBackground02 from './assets/cards/diary-card-imagegen-v02.webp';
import diaryCardBackground03 from './assets/cards/diary-card-imagegen-v03.webp';
import diaryCardBackground04 from './assets/cards/diary-card-imagegen-v04.webp';
import diaryCardBackground05 from './assets/cards/diary-card-imagegen-v05.webp';
import diaryCardBackground06 from './assets/cards/diary-card-imagegen-v06.webp';
import diaryCardBackground07 from './assets/cards/diary-card-imagegen-v07.webp';
import diaryCardBackground08 from './assets/cards/diary-card-imagegen-v08.webp';
import diaryCardBackground09 from './assets/cards/diary-card-imagegen-v09.webp';
import diaryCardBackground10 from './assets/cards/diary-card-imagegen-v10.webp';
import diaryComposeEntry from './assets/diary-compose-entry.webp';
import {
  diaryMarkdownExcerpt,
  renderDiaryMarkdown,
  stripLeadingDiaryTitle
} from './internal/markdown';
import { useDiaryLifecycle } from './internal/useDiaryLifecycle';
import type {
  DiaryEditorValue,
  DiaryEntry,
  DiaryVisibility
} from './model';

const diaryCardBackgrounds = [
  diaryCardBackground01,
  diaryCardBackground02,
  diaryCardBackground03,
  diaryCardBackground04,
  diaryCardBackground05,
  diaryCardBackground06,
  diaryCardBackground07,
  diaryCardBackground08,
  diaryCardBackground09,
  diaryCardBackground10
];
const diaryCardBackgroundIndexes = new Map<string, number>();
const { weather, lastCoordinates, loadWeather } =
  useWeatherAtmosphereData();
const diaryLifecycle = useDiaryLifecycle();
const yearChapters = diaryLifecycle.state.yearChapters;
const selectedMonth = diaryLifecycle.state.selectedMonth;
const currentRole = diaryLifecycle.state.currentRole;
const selectedEntry = diaryLifecycle.state.selectedEntry;
const diaryPageLoaded = diaryLifecycle.state.loaded;
const isSaving = diaryLifecycle.state.saving;
const editorError = diaryLifecycle.state.error;
const currentMonthGroup =
  diaryLifecycle.state.currentMonthGroup;
const currentMonthHasEntries =
  diaryLifecycle.state.currentMonthHasEntries;
const selectedMonthLabel =
  diaryLifecycle.state.selectedMonthLabel;
const isChapterOpen = ref(false);
const isEditorOpen = ref(false);
const editorMode = ref<'create' | 'edit'>('create');
const editingEntry = ref<DiaryEntry | null>(null);
const timelineRef = ref<HTMLElement | null>(null);
const diaryMotionReady = ref(false);
const pendingMonthScroll = ref(false);
const monthSectionRefs = new Map<string, HTMLElement>();
let diaryCardObserver: IntersectionObserver | null = null;

const editorInitialValue = computed<DiaryEditorValue>(() =>
  diaryLifecycle.createEditorValue(
    isEditorOpen.value ? editingEntry.value : null,
    currentWeatherContext()
  )
);

const editorDraftKey = computed(() =>
  editingEntry.value
    ? `snowlit:diary-draft:edit:${editingEntry.value.id}`
    : `snowlit:diary-draft:new:${currentRole.value ?? 'pending'}`
);

function currentWeatherContext() {
  return {
    weather: weather.value,
    coordinates: lastCoordinates.value
  };
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function getDiaryCardBackgroundIndex(entry: DiaryEntry) {
  const key = String(entry.id);
  const existingIndex = diaryCardBackgroundIndexes.get(key);
  if (typeof existingIndex === 'number') {
    return existingIndex;
  }

  const index = Math.floor(
    Math.random() * diaryCardBackgrounds.length
  );
  diaryCardBackgroundIndexes.set(key, index);
  return index;
}

function getDiaryCardBackgroundStyle(entry: DiaryEntry) {
  return {
    '--diary-card-bg': `url("${diaryCardBackgrounds[getDiaryCardBackgroundIndex(entry)]}")`
  };
}

function getDiaryCardStyle(
  entry: DiaryEntry,
  motionIndex: number
) {
  return {
    ...getDiaryCardBackgroundStyle(entry),
    '--diary-card-motion-index': String(motionIndex)
  };
}

function visibilityLabel(visibility: DiaryVisibility) {
  return visibility === 'private' ? '私密' : '共同可见';
}

function toggleChapterPanel() {
  isChapterOpen.value = !isChapterOpen.value;
}

function closeChapterPanel() {
  isChapterOpen.value = false;
}

function setMonthSectionRef(
  key: string,
  element: Element | null
) {
  if (element instanceof HTMLElement) {
    monthSectionRefs.set(key, element);
    return;
  }
  monthSectionRefs.delete(key);
}


function markDiaryEntryCardVisible(card: Element) {
  if (card instanceof HTMLElement) {
    card.dataset.diaryCardVisible = 'true';
  }
}

function observeDiaryEntryCards() {
  diaryCardObserver?.disconnect();
  diaryCardObserver = null;

  const cards = Array.from(
    timelineRef.value?.querySelectorAll(
      '.diary-entry-card[data-diary-card-visible="false"]'
    ) ?? []
  );
  if (!cards.length) {
    return;
  }

  if (
    prefersReducedMotion() ||
    typeof IntersectionObserver === 'undefined'
  ) {
    cards.forEach(markDiaryEntryCardVisible);
    return;
  }

  diaryCardObserver = new IntersectionObserver(
    (items) => {
      items.forEach((item) => {
        if (
          !item.isIntersecting ||
          item.intersectionRatio < 0.34
        ) {
          return;
        }
        markDiaryEntryCardVisible(item.target);
        diaryCardObserver?.unobserve(item.target);
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: [0.34, 0.52, 0.74]
    }
  );
  cards.forEach((card) => diaryCardObserver?.observe(card));
}

async function jumpToMonth(key: string) {
  const shouldWaitForPageTurn = key !== selectedMonth.value;
  closeChapterPanel();
  if (shouldWaitForPageTurn) {
    pendingMonthScroll.value = true;
  }
  const accepted = await diaryLifecycle.loadMonth(key);
  if (!accepted) {
    if (selectedMonth.value === key) {
      pendingMonthScroll.value = false;
    }
    return;
  }
  if (shouldWaitForPageTurn) {
    return;
  }
  scrollToSelectedMonth();
}

function scrollToSelectedMonth() {
  void nextTick(() => {
    const monthSection = monthSectionRefs.get(
      selectedMonth.value
    );
    if (
      typeof monthSection?.scrollIntoView === 'function'
    ) {
      monthSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
}

function handleMonthPageAfterEnter() {
  observeDiaryEntryCards();
  if (!pendingMonthScroll.value) {
    return;
  }
  pendingMonthScroll.value = false;
  scrollToSelectedMonth();
}

async function openDetail(entry: DiaryEntry | null) {
  if (entry) {
    await diaryLifecycle.selectEntry(entry.id);
  }
}

function closeDetail() {
  diaryLifecycle.clearSelectedEntry();
}

function openCreateEditor() {
  if (!currentRole.value) {
    diaryLifecycle.clearError();
    return;
  }
  if (!weather.value) {
    void loadWeather();
  }
  editorMode.value = 'create';
  editingEntry.value = null;
  diaryLifecycle.clearError();
  isEditorOpen.value = true;
}

function openEditEditor(entry: DiaryEntry) {
  if (!diaryLifecycle.ownsEntry(entry)) {
    return;
  }

  closeDetail();
  editorMode.value = 'edit';
  editingEntry.value = entry;
  diaryLifecycle.clearError();
  isEditorOpen.value = true;
}

function closeEditor() {
  isEditorOpen.value = false;
  diaryLifecycle.clearError();
  editingEntry.value = null;
}

async function saveEditorEntry(value: DiaryEditorValue) {
  const draftKey = editorDraftKey.value;
  const expectsMonthChange =
    value.date.slice(0, 7) !== selectedMonth.value;
  if (expectsMonthChange) {
    pendingMonthScroll.value = true;
  }
  const result = await diaryLifecycle.saveEntry(
    value,
    editingEntry.value?.id ?? null,
    currentWeatherContext()
  );
  if (!result) {
    if (expectsMonthChange) {
      pendingMonthScroll.value = false;
    }
    return;
  }

  localStorage.removeItem(draftKey);
  isEditorOpen.value = false;
  editingEntry.value = null;
  pendingMonthScroll.value =
    pendingMonthScroll.value && result.monthChanged;
  if (!result.monthChanged) {
    scrollToSelectedMonth();
    void nextTick(observeDiaryEntryCards);
  }
}

async function deleteSelectedEntry() {
  await diaryLifecycle.deleteSelectedEntry();
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }
  if (isEditorOpen.value) {
    closeEditor();
    return;
  }
  if (selectedEntry.value) {
    closeDetail();
    return;
  }
  if (isChapterOpen.value) {
    closeChapterPanel();
  }
}

onMounted(async () => {
  const initialized = await diaryLifecycle.loadInitial();
  if (!initialized) {
    return;
  }

  window.addEventListener('keydown', handleEscape);
  void nextTick(() => {
    diaryMotionReady.value = true;
    observeDiaryEntryCards();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
  diaryCardObserver?.disconnect();
});
</script>

<template>
  <main class="diary-page" :data-diary-motion="diaryMotionReady ? 'ready' : 'loading'" aria-label="日记">
    <PageLoader :loading="!diaryPageLoaded" />
    <template v-if="diaryPageLoaded">
    <section class="diary-controls" aria-label="日记年份章节选择">
      <div class="diary-chapter-picker">
        <p class="diary-chapter-picker__kicker">Chapter Index</p>
        <button
          class="diary-chapter-trigger"
          :class="{ 'diary-chapter-trigger--open': isChapterOpen }"
          type="button"
          :aria-expanded="isChapterOpen"
          aria-controls="diary-chapter-panel"
          @click="toggleChapterPanel"
        >
          <span class="diary-chapter-trigger__label">{{ selectedMonthLabel }}</span>
          <span class="diary-chapter-trigger__hint">翻开年份章节</span>
        </button>
      </div>

      <Transition name="diary-chapter">
        <div v-if="isChapterOpen" id="diary-chapter-panel" class="diary-chapter-panel">
          <div v-for="chapter in yearChapters" :key="chapter.year" class="diary-year-chapter">
            <h3>{{ chapter.year }} 年</h3>
            <div class="diary-month-chapter">
              <button
                v-for="month in chapter.months"
                :key="month.key"
                class="diary-month-chapter__button"
                :class="{
                  'diary-month-chapter__button--active': month.key === selectedMonth,
                  'diary-month-chapter__button--empty': !month.hasEntries
                }"
                type="button"
                :data-year="month.year"
                :data-month="month.key"
                @click="jumpToMonth(month.key)"
              >
                <span>{{ month.label }}</span>
                <small>{{ month.hasEntries ? `${month.count}篇` : '空页' }}</small>
              </button>
            </div>
          </div>
          <button class="diary-chapter-panel__close" type="button" @click="closeChapterPanel">合上目录</button>
        </div>
      </Transition>
    </section>

    <section
      ref="timelineRef"
      class="diary-timeline diary-timeline--centered"
      :class="{ 'diary-timeline--empty': !currentMonthHasEntries }"
      aria-live="polite"
    >
      <Transition name="diary-month-page" mode="out-in" @after-enter="handleMonthPageAfterEnter">
        <article
          :key="currentMonthGroup.key"
          :ref="(element) => setMonthSectionRef(currentMonthGroup.key, element as Element | null)"
          class="diary-month-section diary-month-section--centered"
          :data-diary-month="currentMonthGroup.key"
        >
          <header class="diary-month-section__header">
            <h2 class="diary-current-month">{{ currentMonthGroup.label }}</h2>
          </header>

          <div v-if="currentMonthGroup.days.length" class="diary-month-section__days">
            <section
              v-for="(day, dayIndex) in currentMonthGroup.days"
              :key="day.key"
              class="diary-date-row"
              :data-diary-date="day.key"
            >
            <div class="diary-date-row__side diary-date-row__side--boyfriend">
              <button
                v-if="day.entriesByRole.boyfriend"
                class="diary-entry-card diary-entry-card--boyfriend"
                :data-role="day.entriesByRole.boyfriend.role"
                data-diary-card-visible="false"
                :data-has-images="day.entriesByRole.boyfriend.images.length > 0"
                :data-card-background-index="getDiaryCardBackgroundIndex(day.entriesByRole.boyfriend)"
                :style="getDiaryCardStyle(day.entriesByRole.boyfriend, dayIndex * 2)"
                type="button"
                @click="openDetail(day.entriesByRole.boyfriend)"
              >
                <span class="diary-entry-card__tape" aria-hidden="true"></span>
                <header class="diary-entry-card__header">
                  <img
                    class="diary-entry-card__avatar"
                    :src="day.entriesByRole.boyfriend.authorAvatar"
                    :alt="day.entriesByRole.boyfriend.authorName"
                  />
                  <span class="diary-entry-card__author">{{ day.entriesByRole.boyfriend.authorName }}</span>
                  <time class="diary-entry-card__date" :datetime="day.entriesByRole.boyfriend.date">
                    {{ day.entriesByRole.boyfriend.date }}
                  </time>
                </header>

                <h3 class="diary-entry-card__title">{{ day.entriesByRole.boyfriend.title }}</h3>
                <p class="diary-entry-card__excerpt">{{ diaryMarkdownExcerpt(day.entriesByRole.boyfriend.content) }}</p>

                <div v-if="day.entriesByRole.boyfriend.images.length" class="diary-entry-card__thumbs" aria-label="日记图片缩略图">
                  <img
                    v-for="image in day.entriesByRole.boyfriend.images.slice(0, 3)"
                    :key="image"
                    class="diary-entry-card__thumb"
                    :src="image"
                    alt=""
                    loading="lazy"
                  />
                </div>

                <footer class="diary-entry-card__meta">
                  <span>{{ day.entriesByRole.boyfriend.mood }}</span>
                  <span>{{ day.entriesByRole.boyfriend.location }}</span>
                  <span>{{ day.entriesByRole.boyfriend.weather }}</span>
                </footer>
              </button>
            </div>

            <div class="diary-date-row__center">
              <span class="diary-date-point" aria-hidden="true"></span>
              <time class="diary-date-point__label" :datetime="day.key">{{ day.label }}</time>
              <span class="diary-date-point__weekday">{{ day.weekday }}</span>
            </div>

            <div class="diary-date-row__side diary-date-row__side--girlfriend">
              <button
                v-if="day.entriesByRole.girlfriend"
                class="diary-entry-card diary-entry-card--girlfriend"
                :data-role="day.entriesByRole.girlfriend.role"
                data-diary-card-visible="false"
                :data-has-images="day.entriesByRole.girlfriend.images.length > 0"
                :data-card-background-index="getDiaryCardBackgroundIndex(day.entriesByRole.girlfriend)"
                :style="getDiaryCardStyle(day.entriesByRole.girlfriend, dayIndex * 2 + 1)"
                type="button"
                @click="openDetail(day.entriesByRole.girlfriend)"
              >
                <span class="diary-entry-card__tape" aria-hidden="true"></span>
                <header class="diary-entry-card__header">
                  <img
                    class="diary-entry-card__avatar"
                    :src="day.entriesByRole.girlfriend.authorAvatar"
                    :alt="day.entriesByRole.girlfriend.authorName"
                  />
                  <span class="diary-entry-card__author">{{ day.entriesByRole.girlfriend.authorName }}</span>
                  <time class="diary-entry-card__date" :datetime="day.entriesByRole.girlfriend.date">
                    {{ day.entriesByRole.girlfriend.date }}
                  </time>
                </header>

                <h3 class="diary-entry-card__title">{{ day.entriesByRole.girlfriend.title }}</h3>
                <p class="diary-entry-card__excerpt">{{ diaryMarkdownExcerpt(day.entriesByRole.girlfriend.content) }}</p>

                <div v-if="day.entriesByRole.girlfriend.images.length" class="diary-entry-card__thumbs" aria-label="日记图片缩略图">
                  <img
                    v-for="image in day.entriesByRole.girlfriend.images.slice(0, 3)"
                    :key="image"
                    class="diary-entry-card__thumb"
                    :src="image"
                    alt=""
                    loading="lazy"
                  />
                </div>

                <footer class="diary-entry-card__meta">
                  <span>{{ day.entriesByRole.girlfriend.mood }}</span>
                  <span>{{ day.entriesByRole.girlfriend.location }}</span>
                  <span>{{ day.entriesByRole.girlfriend.weather }}</span>
                </footer>
              </button>
            </div>
            </section>
          </div>

          <p v-else class="diary-empty">这个月份还没有日记。等其中一个人把第一张纸贴上来。</p>
        </article>
      </Transition>
    </section>

    <DiaryTimelineGlow
      v-if="currentMonthHasEntries"
      :timeline-element="timelineRef"
      :month-key="currentMonthGroup.key"
      :disabled="isEditorOpen || Boolean(selectedEntry)"
    />

    <button class="diary-compose-fab" type="button" aria-label="写日记" @click="openCreateEditor">
      <img class="diary-compose-fab__image" :src="diaryComposeEntry" alt="" draggable="false" />
      <span class="visually-hidden">写日记</span>
    </button>

    <Teleport to="body">
      <Transition name="diary-editor" :duration="{ enter: 840, leave: 260 }">
        <DiaryMarkdownEditor
          v-if="isEditorOpen"
          :key="editorDraftKey"
          :mode="editorMode"
          :initial-value="editorInitialValue"
          :draft-key="editorDraftKey"
          :upload-image="diaryLifecycle.uploadImage"
          :saving="isSaving"
          :error="editorError"
          @close="closeEditor"
          @save="saveEditorEntry"
        />
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="diary-detail">
        <div v-if="selectedEntry" class="diary-detail-backdrop" @click.self="closeDetail">
          <article class="diary-detail-modal" role="dialog" aria-modal="true" :data-role="selectedEntry.role">
            <button class="diary-panel-close diary-detail__close" type="button" aria-label="关闭日记详情" @click="closeDetail">
              ×
            </button>

            <header class="diary-detail__header">
              <img class="diary-detail__avatar" :src="selectedEntry.authorAvatar" :alt="selectedEntry.authorName" />
              <div>
                <p class="diary-detail__author">{{ selectedEntry.authorName }}</p>
                <h2>{{ selectedEntry.title }}</h2>
                <p class="diary-detail__summary">
                  {{ selectedEntry.mood }} · {{ selectedEntry.location }} · {{ selectedEntry.weather }} ·
                  {{ visibilityLabel(selectedEntry.visibility) }}
                </p>
              </div>
            </header>

            <div class="diary-detail__content">
              <div class="diary-detail__markdown-content" v-html="renderDiaryMarkdown(stripLeadingDiaryTitle(selectedEntry.content))"></div>

              <dl class="diary-detail__meta">
                <div>
                  <dt>日期</dt>
                  <dd>{{ selectedEntry.date }}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{{ formatDateTime(selectedEntry.createdAt) }}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>{{ formatDateTime(selectedEntry.updatedAt) }}</dd>
                </div>
                <div>
                  <dt>天气</dt>
                  <dd>
                    {{ selectedEntry.weather }}
                    <span v-if="typeof selectedEntry.temperature === 'number'"> · {{ Math.round(selectedEntry.temperature) }}°C</span>
                  </dd>
                </div>
                <div>
                  <dt>地点</dt>
                  <dd>
                    {{ selectedEntry.province || '' }}{{ selectedEntry.city || '' }}{{ selectedEntry.district || selectedEntry.location }}
                  </dd>
                </div>
              </dl>
            </div>

            <footer v-if="selectedEntry.role === currentRole" class="diary-detail__actions">
              <NButton class="diary-detail__edit" attr-type="button" @click="openEditEditor(selectedEntry)">编辑</NButton>
              <NButton class="diary-detail__delete" attr-type="button" type="primary" @click="deleteSelectedEntry">删除</NButton>
            </footer>
            <p v-else class="diary-detail__readonly">只读日记</p>
          </article>
        </div>
      </Transition>
    </Teleport>
    </template>
  </main>
</template>
