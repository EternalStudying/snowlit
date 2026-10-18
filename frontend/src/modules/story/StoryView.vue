<script setup lang="ts">
import { hasStoryCoordinates } from './internal/storyMapModel';
import './story.css';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Clock3, MapPin, Maximize2, RotateCcw } from 'lucide-vue-next';
import { NButton } from 'naive-ui';
import { gsap } from 'gsap';
import MomentDetailPopover from './components/MomentDetailPopover.vue';
import MomentEditorDialog from './components/MomentEditorDialog.vue';
import StoryFilterPanel from './components/StoryFilterPanel.vue';
import StoryMapLoadingOverlay from './components/StoryMapLoadingOverlay.vue';
import StoryMapCanvas from './components/StoryMapCanvas.vue';
import StoryTimeline from './components/StoryTimeline.vue';
import { useHomeLifecycle } from '../home';
import { isInstantMotion, useReducedMotion } from '../../motion';
import { playStoryExitTransition } from './internal/storyRouteTransition';
import { useStoryLifecycle } from './internal/useStoryLifecycle';
import addMomentButtonArt from './assets/add-moment-button.webp';
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
const isMotionReady = ref(false);
const hasEnteredMotion = ref(false);
const isMapEntering = ref(false);
const isExitingStory = ref(false);
const isReducedMotion = useReducedMotion();
const hasPreloaderRevealed = ref(false);
const isPreloaderLeaving = ref(false);
const motionFeedbackId = ref<number | null>(null);
const removingMotionId = ref<number | null>(null);
const mapResetSignal = ref(0);

let motionFeedbackTimer: ReturnType<typeof window.setTimeout> | null = null;
let motionContext: gsap.Context | undefined;
let selectionMotionContext: gsap.Context | undefined;
let deleteMotionContext: gsap.Context | undefined;
let deleteConfirmMotionContext: gsap.Context | undefined;
let storyMatchMedia: gsap.MatchMedia | undefined;
let pageEnterTl: gsap.core.Timeline | undefined;
let selectTl: gsap.core.Timeline | undefined;
let saveSuccessTl: gsap.core.Timeline | undefined;
let deleteTl: gsap.core.Timeline | undefined;
let deleteConfirmTl: gsap.core.Tween | undefined;
let hasPreparedMapEntry = false;
let hasPlayedPageEnter = false;

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

const showLoadingOverlay = computed(() => !hasPreloaderRevealed.value);
const isStoryEntryLocked = computed(
  () => isMapEntering.value || (!hasEnteredMotion.value && !isReducedMotion.value && !isInstantMotion())
);

onMounted(() => {
  isMotionReady.value = true;
  loadMoments();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  storyMatchMedia?.revert();
  clearMotionFeedback();
  pageEnterTl?.kill();
  selectTl?.kill();
  saveSuccessTl?.kill();
  deleteTl?.kill();
  deleteConfirmTl?.kill();
  motionContext?.revert();
  selectionMotionContext?.revert();
  deleteMotionContext?.revert();
  deleteConfirmMotionContext?.revert();
});

watch(
  () => [isLoading.value, errorMessage.value, isEditorOpen.value, sortedMoments.value.length, canManage.value] as const,
  () => {
    nextTick(playPageEnterMotion);
  },
  { flush: 'post' }
);

watch(
  () => [storyBootReady.value, errorMessage.value] as const,
  () => {
    if (storyBootReady.value || errorMessage.value) {
      startPreloaderExit();
    }
  },
  { flush: 'post' }
);

watch(
  () => deleteTarget.value?.id ?? null,
  () => {
    nextTick(playDeleteConfirmOpen);
  },
  { flush: 'post' }
);

async function selectMoment(id: number) {
  if (isMapEntering.value) {
    return;
  }
  const selection = storyLifecycle.selectMoment(id);
  await nextTick();
  playSelectionFeedback(id);
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
  clearMotionFeedback();
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

  motionFeedbackId.value = saved.id;
  closeEditor();
  await loadMoments();
  await selectMoment(saved.id);
  playMomentFeedback(saved.id);
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
  await playDeleteFeedback(target.id);
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

function completePageEnterMotion(cleanupTargets?: {
  filter?: Element[];
  transform?: Element[];
  visibility?: Element[];
}) {
  hasEnteredMotion.value = true;
  isMapEntering.value = false;
  if (!cleanupTargets) {
    return;
  }

  nextTick(() => {
    window.requestAnimationFrame(() => {
      if (!storyRoot.value) {
        return;
      }
      if (cleanupTargets.filter?.length) {
        gsap.set(cleanupTargets.filter, { clearProps: 'filter' });
      }
      if (cleanupTargets.transform?.length) {
        gsap.set(cleanupTargets.transform, { clearProps: 'transform' });
      }
      if (cleanupTargets.visibility?.length) {
        gsap.set(cleanupTargets.visibility, { clearProps: 'visibility' });
      }
    });
  });
}

function prepareMapEntryCamera() {
  if (hasPreparedMapEntry || !storyBootReady.value || isReducedMotion.value || isInstantMotion()) {
    return;
  }

  hasPreparedMapEntry = true;
  const isMobile = Boolean(window.matchMedia?.('(max-width: 767px)').matches);
  mapCanvasRef.value?.prepareEntryCamera({ isMobile });
}

function playPageEnterMotion() {
  if (hasPlayedPageEnter || !hasPreloaderRevealed.value || isLoading.value || errorMessage.value || isEditorOpen.value || !storyRoot.value) {
    return;
  }

  hasPlayedPageEnter = true;
  isMapEntering.value = true;
  prepareMapEntryCamera();
  if (isInstantMotion()) {
    completePageEnterMotion();
    return;
  }

  pageEnterTl?.kill();
  storyMatchMedia?.revert();

  const root = storyRoot.value;
  const q = gsap.utils.selector(root);

  if (isReducedMotion.value) {
    gsap.set(
      [
        ...q('.story-map-canvas__surface'),
        ...q('.story-map-page__tone'),
        ...q('.story-status-badge'),
        ...q('.story-memory-entry'),
        ...q('.story-home-link'),
        ...q('.story-filter-panel'),
        ...q('.story-add-button'),
        ...q('.story-timeline'),
        ...q('.story-timeline__line'),
        ...q('.story-timeline__node'),
        ...q('.story-marker__visual')
      ],
      { autoAlpha: 1, x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0, clearProps: 'transform,visibility,filter' }
    );
    gsap.set(q('.story-map-entry-veil'), { autoAlpha: 0 });
    completePageEnterMotion();
    return;
  }

  storyMatchMedia = gsap.matchMedia();
  storyMatchMedia.add(
    '(min-width: 0px)',
    () => {
      const reduceMotion = isReducedMotion.value;
      if (reduceMotion) {
        gsap.set(
          [
            root,
            ...q('.story-map-canvas__surface'),
            ...q('.story-map-page__tone'),
            ...q('.story-status-badge'),
            ...q('.story-memory-entry'),
            ...q('.story-home-link'),
            ...q('.story-filter-panel'),
            ...q('.story-filter-trigger'),
            ...q('.story-add-button'),
            ...q('.story-timeline'),
            ...q('.story-timeline__line'),
            ...q('.story-timeline__node'),
            ...q('.story-marker__visual')
          ],
          { autoAlpha: 1, x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0, clearProps: 'transform,visibility,filter' }
        );
        gsap.set(q('.story-map-entry-veil'), { autoAlpha: 0 });
        completePageEnterMotion();
        return;
      }

      const isMobile = Boolean(window.matchMedia?.('(max-width: 767px)').matches);
      const mapSurface = q('.story-map-canvas__surface');
      const entryVeil = q('.story-map-entry-veil');
      const toneLayer = q('.story-map-page__tone');
      const statusBadge = q('.story-status-badge');
      const memoryEntryButton = q('.story-memory-entry');
      const homeLink = q('.story-home-link');
      const addButton = canManage.value ? q('.story-add-button') : [];
      const filterChrome = isMobile ? q('.story-filter-trigger') : q('.story-filter-panel');
      const timeline = q('.story-timeline');
      const timelineLine = q('.story-timeline__line');
      const timelineNodes = q('.story-timeline__node');
      const visibilityCleanupTargets = [
        ...mapSurface,
        ...entryVeil,
        ...toneLayer,
        ...statusBadge,
        ...memoryEntryButton,
        ...homeLink,
        ...filterChrome,
        ...addButton,
        ...timeline,
        ...timelineNodes
      ];
      const transformCleanupTargets = [
        ...statusBadge,
        ...memoryEntryButton,
        ...homeLink,
        ...filterChrome,
        ...addButton,
        ...timeline,
        ...timelineLine,
        ...timelineNodes
      ];

      pageEnterTl = gsap.timeline({
        defaults: { ease: 'power3.out', overwrite: 'auto' },
        onComplete: () => {
          completePageEnterMotion({
            filter: mapSurface,
            transform: transformCleanupTargets,
            visibility: visibilityCleanupTargets
          });
        }
      });
      const mapRevealDuration = isMobile ? 0.28 : 0.42;
      const cameraInAt = isMobile ? 0.16 : 0.2;
      const chromeInAt = isMobile ? 1.88 : 2.65;
      const timelineInAt = isMobile ? 2.05 : 2.95;
      const veilFadeAt = isMobile ? 2.02 : 2.82;
      const veilFadeDuration = isMobile ? 0.42 : 0.68;
      const markerRevealGap = isMobile ? 0.06 : 0.12;
      const entryCompleteHold = isMobile ? 0.12 : 0.16;

      pageEnterTl
        .addLabel('loaderOut', 0)
        .addLabel('mapFarReveal', isMobile ? 0.06 : 0.12)
        .fromTo(mapSurface, { autoAlpha: 0.18, filter: 'brightness(.72)' }, { autoAlpha: 1, filter: 'brightness(1)', duration: mapRevealDuration }, 'mapFarReveal')
        .fromTo(entryVeil, { autoAlpha: isMobile ? 0.42 : 0.54 }, { autoAlpha: isMobile ? 0.38 : 0.5, duration: mapRevealDuration, ease: 'power2.out' }, 'mapFarReveal')
        .fromTo(toneLayer, { autoAlpha: 0 }, { autoAlpha: 1, duration: isMobile ? 0.24 : 0.36, ease: 'power2.out' }, 'mapFarReveal+=0.06')
        .addLabel('cameraIn', cameraInAt)
        .call(() => {
          void mapCanvasRef.value?.playEntryCamera({ isMobile });
        }, [], 'cameraIn')
        .addLabel('mapVeilOut', veilFadeAt)
        .to(entryVeil, { autoAlpha: 0, duration: veilFadeDuration, ease: 'power2.out' }, 'mapVeilOut')
        .addLabel('chromeIn', chromeInAt)
        .fromTo(statusBadge, { autoAlpha: 0, y: isMobile ? -4 : -10, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: isMobile ? 0.22 : 0.28 }, 'chromeIn')
        .fromTo(memoryEntryButton, { autoAlpha: 0, y: isMobile ? -2 : -6, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: isMobile ? 0.18 : 0.24 }, 'chromeIn+=0.04')
        .fromTo(homeLink, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: isMobile ? 0.18 : 0.22, ease: 'power2.out' }, 'chromeIn+=0.06')
        .fromTo(
          filterChrome,
          { autoAlpha: 0, x: isMobile ? 0 : -16, y: isMobile ? 10 : 0, rotation: isMobile ? 0 : -1 },
          { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: isMobile ? 0.22 : 0.34 },
          'chromeIn+=0.08'
        );

      if (addButton.length) {
        pageEnterTl.fromTo(
          addButton,
          { autoAlpha: 0, scale: 0.86, rotation: isMobile ? 0 : 2.2 },
          { autoAlpha: 1, scale: 1, rotation: 0, duration: isMobile ? 0.22 : 0.28, ease: 'back.out(1.25)' },
          isMobile ? 'chromeIn+=0.12' : 'chromeIn+=0.2'
        );
      }

      pageEnterTl
        .addLabel('timelineDraw', timelineInAt)
        .fromTo(timeline, { autoAlpha: 0, y: isMobile ? 12 : 18 }, { autoAlpha: 1, y: 0, duration: isMobile ? 0.24 : 0.32 }, 'timelineDraw')
        .fromTo(
          timelineLine,
          { scaleX: 0, transformOrigin: 'left center' },
          { scaleX: 1, duration: isMobile ? 0.38 : 0.52, ease: 'power2.inOut' },
          'timelineDraw+=0.12'
        )
        .fromTo(
          timelineNodes,
          { autoAlpha: 0, scale: 0.72, y: 6 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.18, stagger: { each: isMobile ? 0.012 : 0.035, from: 'start' } },
          'timelineDraw+=0.18'
        )
        .addLabel('markerReveal', `+=${markerRevealGap}`)
        .call(() => {
          void mapCanvasRef.value?.playMarkerReveal({ replayVisible: true, isMobile });
        }, [], 'markerReveal');

      pageEnterTl.addLabel('entryComplete', `markerReveal+=${entryCompleteHold}`).to({}, { duration: 0.01 }, 'entryComplete');

      if (!pageEnterTl.getChildren(false, true, true).length) {
        completePageEnterMotion();
      }
    },
    root
  );
}

function startPreloaderExit() {
  if (hasPreloaderRevealed.value || isPreloaderLeaving.value) {
    return;
  }

  if (storyBootReady.value) {
    isMapEntering.value = !isReducedMotion.value && !isInstantMotion();
    prepareMapEntryCamera();
  }

  if (isInstantMotion()) {
    completePreloaderReveal();
    return;
  }

  isPreloaderLeaving.value = true;
}

function completePreloaderReveal() {
  hasPreloaderRevealed.value = true;
  isPreloaderLeaving.value = false;
  if (errorMessage.value) {
    isMapEntering.value = false;
    return;
  }
  nextTick(playPageEnterMotion);
}

function markerDescendantSelector(id: number, descendant: string) {
  return `[data-story-motion-id="${id}"] ${descendant}, [data-story-group-ids~="${id}"] ${descendant}`;
}

function playSelectionFeedback(id: number) {
  selectTl?.kill();
  selectionMotionContext?.revert();
  if (isReducedMotion.value || isInstantMotion() || !storyRoot.value) {
    return;
  }

  const root = storyRoot.value;
  selectionMotionContext = gsap.context(() => {
    const pulse = root.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__pulse'));
    const markerVisual = root.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__visual'));
    const node = root.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${id}"]`);
    const dot = node?.querySelector<HTMLElement>('.story-timeline__dot');

    selectTl = gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } });
    if (markerVisual) {
      selectTl.fromTo(markerVisual, { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
    }
    if (node) {
      selectTl.fromTo(node, { scale: 1 }, { scale: 1.05, duration: 0.12, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
    }
    if (dot) {
      selectTl.fromTo(dot, { scale: 0.9 }, { scale: 1.14, duration: 0.18, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
    }
    if (pulse) {
      selectTl.fromTo(pulse, { autoAlpha: 0.38, scale: 0.8 }, { autoAlpha: 0, scale: 2.25, duration: 0.55, clearProps: 'transform,visibility' }, 0.04);
    }
  }, root);
}

function playDeleteConfirmOpen() {
  deleteConfirmTl?.kill();
  deleteConfirmMotionContext?.revert();
  if (!deleteTarget.value || isReducedMotion.value || isInstantMotion() || !storyRoot.value) {
    return;
  }
  const root = storyRoot.value;
  deleteConfirmMotionContext = gsap.context(() => {
    deleteConfirmTl = gsap.fromTo('.story-delete-confirm', { autoAlpha: 0, scale: 0.96, y: 6 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.18, ease: 'power2.out', clearProps: 'transform,visibility' });
  }, root);
}

function playDeleteFeedback(id: number) {
  deleteTl?.kill();
  selectTl?.kill();
  deleteMotionContext?.revert();

  if (isReducedMotion.value || isInstantMotion() || !storyRoot.value) {
    return Promise.resolve();
  }

  const root = storyRoot.value;
  return new Promise<void>((resolve) => {
    deleteMotionContext = gsap.context(() => {
      const confirm = root.querySelector<HTMLElement>('.story-delete-confirm');
      const markerVisual = root.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__visual'));
      const node = root.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${id}"]`);
      const detail = root.querySelector<HTMLElement>('.moment-detail');

      if (!confirm && !markerVisual && !node && !detail) {
        resolve();
        return;
      }

      deleteTl = gsap.timeline({ defaults: { ease: 'power2.inOut', overwrite: 'auto' }, onComplete: resolve });
      if (confirm) {
        deleteTl.to(confirm, { autoAlpha: 0, scale: 0.985, duration: 0.1, ease: 'power1.out' }, 0);
      }
      if (markerVisual) {
        deleteTl.to(markerVisual, { autoAlpha: 0, scale: 0.62, rotation: -3, duration: 0.22, clearProps: 'transform,visibility' }, 0.04);
      }
      if (node) {
        deleteTl.to(node, { autoAlpha: 0, scale: 0.72, y: 4, duration: 0.2, clearProps: 'transform,visibility' }, 0.08);
      }
      if (detail) {
        deleteTl.to(detail, { autoAlpha: 0, scale: 0.985, y: 4, duration: 0.12, ease: 'power1.out', clearProps: 'transform,visibility' }, 0.04);
      }
    }, root);
  });
}

function playMomentFeedback(id: number) {
  clearMotionFeedback();
  motionFeedbackId.value = id;

  if (!isReducedMotion.value && !isInstantMotion()) {
    nextTick(() => {
      if (!storyRoot.value) {
        return;
      }
      saveSuccessTl?.kill();
      motionContext?.revert();
      motionContext = gsap.context(() => {
        const markerPulse = storyRoot.value?.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__pulse'));
        const timelineNode = storyRoot.value?.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${id}"]`);
        const timelineDot = timelineNode?.querySelector<HTMLElement>('.story-timeline__dot');

        saveSuccessTl = gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }).addLabel('markerIn', 0);
        void mapCanvasRef.value?.playMarkerReveal({
          ids: [id],
          replayVisible: true,
          isMobile: Boolean(window.matchMedia?.('(max-width: 767px)').matches)
        });
        if (markerPulse) {
          saveSuccessTl.fromTo(markerPulse, { autoAlpha: 0.34, scale: 0.85 }, { autoAlpha: 0, scale: 2.2, duration: 0.46, clearProps: 'transform,visibility' }, 'markerIn+=0.36');
        }
        if (timelineNode) {
          saveSuccessTl.fromTo(timelineNode, { autoAlpha: 0.72, scale: 0.86, y: 4 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.26, clearProps: 'transform,visibility' }, 'markerIn+=0.14');
        }
        if (timelineDot) {
          saveSuccessTl.fromTo(timelineDot, { scale: 0.8 }, { scale: 1.18, duration: 0.2, yoyo: true, repeat: 1, clearProps: 'transform' }, 'markerIn+=0.18');
        }
      }, storyRoot.value);
    });
  }

  motionFeedbackTimer = window.setTimeout(() => {
    motionFeedbackId.value = null;
    motionFeedbackTimer = null;
    saveSuccessTl?.kill();
    motionContext?.revert();
    motionContext = undefined;
  }, isReducedMotion.value ? 120 : 860);
}

function clearMotionFeedback() {
  if (motionFeedbackTimer) {
    window.clearTimeout(motionFeedbackTimer);
    motionFeedbackTimer = null;
  }
  motionFeedbackId.value = null;
  saveSuccessTl?.kill();
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

    <button
      v-if="canManage && !isEditorOpen"
      class="story-add-button"
      type="button"
      aria-label="添加点滴"
      @click="startCreate"
    >
      <img :src="addMomentButtonArt" alt="" draggable="false" decoding="async" />
    </button>

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
