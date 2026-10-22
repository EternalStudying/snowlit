<script setup lang="ts">
import { hasStoryCoordinates } from './internal/storyMapModel';
import './story.css';
import './story-night.css';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Clock3, MapPin, Maximize2, Plus, RotateCcw } from 'lucide-vue-next';
import { NButton } from 'naive-ui';
import MomentDetailPopover from './components/MomentDetailPopover.vue';
import MomentEditorDialog from './components/MomentEditorDialog.vue';
import StoryFilterPanel from './components/StoryFilterPanel.vue';
import StoryMapLoadingOverlay from './components/StoryMapLoadingOverlay.vue';
import StoryMapCanvas from './components/StoryMapCanvas.vue';
import StoryTimeline from './components/StoryTimeline.vue';
import { useHomeLifecycle } from '../home';
import { playStoryExitTransition } from './internal/storyRouteTransition';
import { useStoryLifecycle } from './internal/useStoryLifecycle';
import { useStoryMotion } from './internal/useStoryMotion';
import StickerButton from '../../components/paper/StickerButton.vue';
import type {
  StoryCategoryFilter,
  StoryDraftLocation,
  StoryMapLoadingState,
  StoryMoment,
  StoryMomentInput
} from './model';

const { overview: home } = useHomeLifecycle().state;
const router = useRouter();
const storyLifecycle = useStoryLifecycle();
const {
  moments,
  years,
  canManage,
  loading: isLoading,
  saving: isSaving,
  loadError: errorMessage,
  actionError,
  saveError: editorError,
  selectedCategory,
  selectedYear,
  selectedId,
  selectedMoment,
  sortedMoments,
  memoryEntry
} = storyLifecycle.state;
const loadMoments = storyLifecycle.loadMoments;
const storyRoot = ref<HTMLElement | null>(null);
const mapCanvasRef = ref<InstanceType<typeof StoryMapCanvas> | null>(null);
const mapLoadingState = ref<StoryMapLoadingState>({
  sdkSettled: false,
  instanceReady: false,
  markersReady: false,
  labelsReady: false
});

const isEditorOpen = ref(false);
const editorMode = ref<'create' | 'edit'>('create');
const editingMoment = ref<StoryMoment | null>(null);
const draftLocation = ref<StoryDraftLocation | null>(null);

const deleteTarget = ref<StoryMoment | null>(null);
const isExitingStory = ref(false);
const removingMotionId = ref<number | null>(null);
const mapResetSignal = ref(0);

const togetherDays = computed(() => home.value?.couple.togetherDays ?? 0);
const distanceText = computed(() => {
  const kilometers = home.value?.distance.kilometers;

  if (kilometers !== undefined && kilometers !== null) {
    return `距离 ${formatKilometers(kilometers)} km`;
  }

  return home.value?.distance.label || '距离待更新';
});

const storyBootReady = computed(
  () =>
    !isLoading.value &&
    !errorMessage.value &&
    mapLoadingState.value.sdkSettled &&
    mapLoadingState.value.instanceReady &&
    mapLoadingState.value.markersReady &&
    mapLoadingState.value.labelsReady
);

const loadingProgress = computed(() => {
  const steps = [
    !isLoading.value,
    mapLoadingState.value.sdkSettled,
    mapLoadingState.value.instanceReady,
    mapLoadingState.value.markersReady,
    mapLoadingState.value.labelsReady
  ];
  return Math.round((steps.filter(Boolean).length / steps.length) * 100);
});

const loadingStageLabel = computed(() => {
  if (isLoading.value) {
    return '读取点滴列表';
  }
  if (!mapLoadingState.value.sdkSettled) {
    return '唤醒高德地图';
  }
  if (!mapLoadingState.value.instanceReady) {
    return '铺开地图底图';
  }
  if (!mapLoadingState.value.markersReady) {
    return '点亮点滴坐标';
  }
  if (!mapLoadingState.value.labelsReady) {
    return '预热地图地名';
  }
  return '准备揭开地图';
});

const storyMotion = useStoryMotion({
  root: storyRoot,
  map: mapCanvasRef,
  canManage,
  bootReady: storyBootReady,
  loading: isLoading,
  loadError: errorMessage,
  editorOpen: isEditorOpen
});
const {
  reducedMotion: isReducedMotion,
  motionReady: isMotionReady,
  entered: hasEnteredMotion,
  mapEntering: isMapEntering,
  entryLocked: isStoryEntryLocked,
  preloaderRevealed: hasPreloaderRevealed,
  preloaderLeaving: isPreloaderLeaving,
  feedbackId: motionFeedbackId,
  completePreloaderReveal
} = storyMotion;
const showLoadingOverlay = computed(() => !hasPreloaderRevealed.value);

onMounted(() => {
  loadMoments();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

watch(
  () => [isLoading.value, errorMessage.value, isEditorOpen.value, sortedMoments.value.length, canManage.value] as const,
  () => {
    nextTick(storyMotion.playPageEnter);
  },
  { flush: 'post' }
);

watch(
  () => [storyBootReady.value, errorMessage.value] as const,
  () => {
    if (storyBootReady.value || errorMessage.value) {
      storyMotion.startPreloaderExit();
    }
  },
  { flush: 'post' }
);

watch(
  () => deleteTarget.value?.id ?? null,
  () => {
    nextTick(storyMotion.playDeleteConfirmOpen);
  },
  { flush: 'post' }
);

async function selectMoment(id: number) {
  if (isMapEntering.value) {
    return;
  }
  const selection = storyLifecycle.selectMoment(id);
  await nextTick();
  storyMotion.playSelection(id);
  await selection;
}

function updateCategory(category: StoryCategoryFilter) {
  if (isMapEntering.value) {
    return;
  }
  void storyLifecycle.selectCategory(category);
}

function updateYear(year: number | null) {
  if (isMapEntering.value) {
    return;
  }
  void storyLifecycle.selectYear(year);
}

function clearFilters() {
  if (isMapEntering.value) {
    return;
  }
  void storyLifecycle.clearFilters();
}

async function openMemoryEntry() {
  if (isMapEntering.value || !memoryEntry.value) {
    return;
  }

  const targetId = memoryEntry.value.moment.id;
  storyLifecycle.clearActionError();
  deleteTarget.value = null;
  closeEditor();

  if (!storyLifecycle.isAllFilterSelected()) {
    await storyLifecycle.clearFilters();
    await nextTick();
  }

  await selectMoment(targetId);
}

function updateMapLoadingState(state: StoryMapLoadingState) {
  mapLoadingState.value = state;
}

function resetStoryState() {
  if (isMapEntering.value) {
    return;
  }
  deleteTarget.value = null;
  draftLocation.value = null;
  storyLifecycle.clearActionError();
  closeEditor();
  storyMotion.clearFeedback();
  mapResetSignal.value += 1;
  void storyLifecycle.resetBrowsing();
}

function startCreate() {
  if (!canManage.value || isMapEntering.value) {
    return;
  }
  editorMode.value = 'create';
  editingMoment.value = null;
  draftLocation.value = null;
  storyLifecycle.clearSaveError();
  isEditorOpen.value = true;
}

function editMoment(moment: StoryMoment) {
  if (!canManage.value) {
    return;
  }
  editorMode.value = 'edit';
  editingMoment.value = moment;
  draftLocation.value = hasStoryCoordinates(moment) ? {
    longitude: moment.longitude,
    latitude: moment.latitude,
    locationName: moment.locationName,
    address: moment.address
  } : null;
  storyLifecycle.clearSaveError();
  isEditorOpen.value = true;
}

function handleMapCreateAt(location: StoryDraftLocation) {
  if (!canManage.value || isMapEntering.value) {
    return;
  }
  editorMode.value = 'create';
  editingMoment.value = null;
  storyLifecycle.clearSelection();
  draftLocation.value = location;
  storyLifecycle.clearSaveError();
  isEditorOpen.value = true;
}

function handleEditorLocationChange(location: StoryDraftLocation) {
  draftLocation.value = location;
}

async function saveMoment(input: StoryMomentInput) {
  const editingId =
    editorMode.value === 'edit'
      ? editingMoment.value?.id ?? selectedId.value
      : null;
  const saved = await storyLifecycle.saveMoment(
    input,
    editingId
  );
  if (!saved) {
    return;
  }

  storyMotion.markSaved(saved.id);
  closeEditor();
  await loadMoments();
  await selectMoment(saved.id);
  storyMotion.playSaved(saved.id);
}

function closeEditor() {
  isEditorOpen.value = false;
  storyLifecycle.clearSaveError();
  editingMoment.value = null;
}

function requestDelete(moment: StoryMoment) {
  if (canManage.value) {
    deleteTarget.value = moment;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) {
    return;
  }
  const target = deleteTarget.value;
  const deleted = await storyLifecycle.deleteMoment(target.id);
  if (!deleted) {
    return;
  }

  removingMotionId.value = target.id;
  await nextTick();
  await storyMotion.playDelete(target.id);
  deleteTarget.value = null;
  if (selectedId.value === target.id) {
    storyLifecycle.clearSelection();
  }
  await loadMoments();
  removingMotionId.value = null;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }
  if (deleteTarget.value) {
    deleteTarget.value = null;
  } else if (isEditorOpen.value) {
    closeEditor();
  } else if (selectedMoment.value) {
    storyLifecycle.clearSelection();
  }
}

function exitStory(event?: Event) {
  event?.preventDefault();
  if (isExitingStory.value) {
    return;
  }

  isExitingStory.value = true;
  void playStoryExitTransition({
    router,
    root: storyRoot.value,
    reducedMotion: isReducedMotion.value
  }).finally(() => {
    isExitingStory.value = false;
  });
}

function formatKilometers(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

</script>

<template>
  <main
    ref="storyRoot"
    class="story-map-page"
    :class="{
      'is-loading': isLoading,
      'is-map-entering': isMapEntering,
      'is-motion-ready': isMotionReady,
      'has-entered-motion': hasEnteredMotion,
      'is-reduced-motion': isReducedMotion
    }"
    :aria-busy="isMapEntering ? 'true' : undefined"
  >
    <StoryMapCanvas
      ref="mapCanvasRef"
      :moments="sortedMoments"
      :selected-id="selectedId"
      :can-create="canManage"
      :entry-locked="isStoryEntryLocked"
      :list-ready="!isLoading"
      :preloader-active="showLoadingOverlay"
      :draft-location="draftLocation"
      :motion-feedback-id="motionFeedbackId"
      :removing-motion-id="removingMotionId"
      :reduced-motion="isReducedMotion"
      :reset-signal="mapResetSignal"
      @select="selectMoment"
      @create-at="handleMapCreateAt"
      @reset="resetStoryState"
      @loading-state="updateMapLoadingState"
    />
    <div class="story-map-entry-veil" aria-hidden="true" />
    <div class="story-map-page__tone" aria-hidden="true" />

    <StoryMapLoadingOverlay
      v-if="showLoadingOverlay"
      :progress="loadingProgress"
      :stage-label="loadingStageLabel"
      :leaving="isPreloaderLeaving"
      :reduced-motion="isReducedMotion"
      @after-leave="completePreloaderReveal"
    />

    <button class="story-home-link" type="button" aria-label="返回首页" @click="exitStory">
      <Maximize2 :size="18" />
    </button>

    <section class="story-status-badge" aria-label="点滴地图状态">
      <div class="story-status-badge__avatar story-status-badge__avatar--girl" aria-hidden="true" />
      <div class="story-status-badge__content">
        <p><span aria-hidden="true">❤</span> 我们在一起 <span aria-hidden="true">❤</span></p>
        <strong>{{ togetherDays }} <small>天</small></strong>
        <span class="story-status-badge__distance"><MapPin :size="13" />{{ distanceText }}</span>
      </div>
      <div class="story-status-badge__avatar story-status-badge__avatar--boy" aria-hidden="true" />
    </section>

    <button v-if="memoryEntry && !isEditorOpen" class="story-memory-entry" type="button" @click="openMemoryEntry">
      <Clock3 :size="15" />
      {{ memoryEntry.label }}
    </button>

    <StoryFilterPanel
      :selected-category="selectedCategory"
      :selected-year="selectedYear"
      :years="years"
      :total="moments.length"
      @update:category="updateCategory"
      @update:year="updateYear"
      @clear="clearFilters"
    />

    <StickerButton
      v-if="canManage && !isEditorOpen"
      class="story-add-button"
      tone="camellia"
      aria-label="添加点滴"
      @click="startCreate"
    >
      <template #icon><Plus :stroke-width="2" /></template>
      添加点滴
    </StickerButton>

    <section v-if="isLoading && hasPreloaderRevealed" class="story-state story-state--loading" aria-live="polite">
      <div class="story-filter-loader" aria-hidden="true">
        <span class="story-filter-loader__route story-filter-loader__route--short">
          <span class="story-filter-loader__dot" />
        </span>
        <span class="story-filter-loader__route story-filter-loader__route--long">
          <span class="story-filter-loader__dot" />
        </span>
        <span class="story-filter-loader__route story-filter-loader__route--mid">
          <span class="story-filter-loader__dot" />
        </span>
      </div>
      <p>筛选点滴中...</p>
    </section>

    <section v-else-if="errorMessage" class="story-state story-state--error" role="alert">
      <h1>地图暂时铺不开</h1>
      <p>{{ errorMessage }}</p>
      <NButton attr-type="button" @click="loadMoments">
        <RotateCcw :size="16" />
        重新加载
      </NButton>
    </section>

    <p v-if="actionError && !errorMessage" class="story-map-message" role="status">{{ actionError }}</p>

    <MomentDetailPopover
      :moment="isEditorOpen ? null : selectedMoment"
      :can-manage="canManage"
      @close="storyLifecycle.clearSelection"
      @edit="editMoment"
      @delete="requestDelete"
    />

    <StoryTimeline
      v-if="!isLoading && !errorMessage && !isEditorOpen"
      :moments="sortedMoments"
      :selected-id="selectedId"
      :motion-feedback-id="motionFeedbackId"
      :removing-motion-id="removingMotionId"
      :reduced-motion="isReducedMotion"
      @select="selectMoment"
    />

    <MomentEditorDialog
      :open="isEditorOpen"
      :mode="editorMode"
      :moment="editingMoment"
      :draft-location="draftLocation"
      :saving="isSaving"
      :error="editorError"
      :upload-image="storyLifecycle.uploadImage"
      @close="closeEditor"
      @save="saveMoment"
      @location-change="handleEditorLocationChange"
    />

    <div v-if="deleteTarget" class="story-delete-confirm" role="alertdialog" aria-modal="true" aria-label="确认删除点滴">
      <div>
        <p>确认删除</p>
        <h2>{{ deleteTarget.title }}</h2>
        <span>删除后会从公开地图和时间线中移除。</span>
      </div>
      <footer>
        <NButton attr-type="button" @click="deleteTarget = null">取消</NButton>
        <NButton attr-type="button" class="story-delete-confirm__danger" type="primary" @click="confirmDelete">删除</NButton>
      </footer>
    </div>
  </main>
</template>
