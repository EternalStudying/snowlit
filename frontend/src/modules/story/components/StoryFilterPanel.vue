<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDays, SlidersHorizontal, X } from 'lucide-vue-next';
import { STORY_CATEGORY_OPTIONS, type StoryCategoryFilter } from '../model';
import storyFilterPanelArt from '../assets/story-filter-panel-transparent-v1.webp';

const props = defineProps<{
  selectedCategory: StoryCategoryFilter;
  selectedYear: number | null;
  years: number[];
  total: number;
}>();

const emit = defineEmits<{
  (event: 'update:category', value: StoryCategoryFilter): void;
  (event: 'update:year', value: number | null): void;
  (event: 'clear'): void;
}>();

const isSheetOpen = ref(false);

const filterSummary = computed(() => {
  const category = STORY_CATEGORY_OPTIONS.find((option) => option.key === props.selectedCategory)?.label ?? '全部';
  const year = props.selectedYear ? `${props.selectedYear}` : '全部年份';
  return `${category} · ${year}`;
});

function selectCategory(category: StoryCategoryFilter) {
  emit('update:category', category);
}

function selectYear(year: number | null) {
  emit('update:year', year);
}
</script>

<template>
  <button class="story-filter-trigger" type="button" @click="isSheetOpen = true" aria-label="打开点滴筛选">
    <SlidersHorizontal :size="18" />
    <span>{{ filterSummary }}</span>
  </button>

  <aside class="story-filter-panel story-filter-panel--scrapbook" :class="{ 'is-open': isSheetOpen }" aria-label="点滴筛选">
    <img class="story-filter-panel__art" :src="storyFilterPanelArt" alt="" aria-hidden="true" draggable="false" decoding="async" />
    <div class="story-filter-panel__overlay">
      <div class="story-filter-panel__sheet-head">
        <button class="story-icon-button story-filter-panel__close" type="button" aria-label="关闭筛选" @click="isSheetOpen = false">
          <X :size="18" />
        </button>
      </div>

      <div class="story-filter-panel__section story-filter-panel__categories">
        <p class="story-filter-panel__label">类型</p>
        <div class="story-filter-panel__options">
          <button
            v-for="option in STORY_CATEGORY_OPTIONS"
            :key="option.key"
            class="story-filter-option"
            :class="[`story-filter-option--${option.key}`, { 'is-active': selectedCategory === option.key }]"
            type="button"
            :aria-pressed="selectedCategory === option.key"
            :data-story-category="option.key"
            @click="selectCategory(option.key)"
          >
            <span class="story-filter-option__text">{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div class="story-filter-panel__divider" aria-hidden="true" />

      <div class="story-filter-panel__section story-filter-panel__years">
        <p class="story-filter-panel__label">年份</p>
        <div class="story-year-filter" aria-label="年份筛选">
          <button
            class="story-year-filter__chip"
            :class="{ 'is-active': selectedYear === null }"
            type="button"
            data-story-year="all"
            @click="selectYear(null)"
          >
            <CalendarDays :size="15" />
            全部年份
          </button>
          <button
            v-for="year in years"
            :key="year"
            class="story-year-filter__chip"
            :class="{ 'is-active': selectedYear === year }"
            type="button"
            :data-story-year="year"
            @click="selectYear(year)"
          >
            {{ year }}
          </button>
        </div>
      </div>

      <div class="story-filter-panel__footer">
        <span>当前显示 {{ total }} 个点滴</span>
        <button type="button" @click="$emit('clear')">清除筛选</button>
      </div>
    </div>
  </aside>

  <button v-if="isSheetOpen" class="story-filter-panel__scrim" type="button" aria-label="关闭筛选" @click="isSheetOpen = false" />
</template>
