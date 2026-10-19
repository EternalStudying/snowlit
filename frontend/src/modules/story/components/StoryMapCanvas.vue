<script setup lang="ts">
import { errorMessage, formatDottedDate } from '../../../display';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { type StoryDraftLocation, type StoryEditorAnchor, type StoryMapLoadingState, type StoryMoment } from '../model';
import {
  loadAmapSdk,
  readAmapCoordinate,
  reverseGeocode,
  type AMapMapInstance,
  type AMapMarkerInstance,
  type AMapMouseEvent,
  type AMapSdk
} from '../internal/amapSdk';
import {
  DEFAULT_STORY_MAP_CENTER as DEFAULT_CENTER,
  buildStoryMarkerItems as buildMarkerItems,
  containsStoryMoment as containsMomentId,
  getLatestStoryMomentId,
  getStoryFallbackPosition,
  getStoryMapTarget,
  getStoryMarkerRevealOrder,
  hasStoryCoordinates as hasCoordinates,
  sortStoryMomentsForReveal,
  type StoryMapTarget as EntryTarget,
  type StoryMarkerItem
} from '../internal/storyMapModel';
import { useStoryMapCamera } from '../internal/useStoryMapCamera';
import { useStoryMarkerMotion, type MarkerRevealOptions } from '../internal/useStoryMarkerMotion';

type MarkerRecord = {
  key: string;
  id: number;
  ids: number[];
  element: HTMLElement;
  marker: AMapMarkerInstance;
};
type GroupPopoverPosition = {
  left: number;
  top: number;
};

const props = defineProps<{
  moments: StoryMoment[];
  selectedId: number | null;
  canCreate: boolean;
  entryLocked: boolean;
  listReady: boolean;
  preloaderActive: boolean;
  draftLocation: StoryDraftLocation | null;
  motionFeedbackId: number | null;
  removingMotionId: number | null;
  reducedMotion: boolean;
  resetSignal: number;
}>();

const emit = defineEmits<{
  (event: 'select', id: number): void;
  (event: 'create-at', location: StoryDraftLocation, anchor?: StoryEditorAnchor): void;
  (event: 'reset'): void;
  (event: 'loading-state', state: StoryMapLoadingState): void;
}>();

const mapElement = ref<HTMLElement | null>(null);
const mapStatus = ref<'loading' | 'ready' | 'fallback'>('loading');
const sdkMessage = ref('');

let map: AMapMapInstance | null = null;
let amapSdk: AMapSdk | null = null;
let markers: MarkerRecord[] = [];
let draftMarker: AMapMarkerInstance | null = null;
let labelsPreloadTimer: ReturnType<typeof window.setTimeout> | null = null;
let labelsPreloadSerial = 0;
let lastVisibleIds = new Set<number>();
let currentLoadingState: StoryMapLoadingState = {
  sdkSettled: false,
  instanceReady: false,
  markersReady: false,
  labelsReady: false
};
const camera = useStoryMapCamera({
  reducedMotion: () => props.reducedMotion,
  mapReady: () => mapStatus.value === 'ready'
});
const markerMotion = useStoryMarkerMotion({
  surface: mapElement,
  reducedMotion: () => props.reducedMotion,
  selectedId: () => props.selectedId
});
const activeGroupKey = ref<string | null>(null);
const groupPopoverPosition = ref<GroupPopoverPosition | null>(null);

type EntryCameraOptions = {
  isMobile: boolean;
};
type FitVisibleOptions = {
  immediate?: boolean;
  duration?: number;
  isMobile?: boolean;
  fallback?: EntryTarget;
};

const visibleMoments = computed(() => props.moments.filter(hasCoordinates));
const visibleMarkerItems = computed(() => buildMarkerItems(visibleMoments.value));
const fallbackMarkerItems = computed(() => visibleMarkerItems.value);
const activeGroupItem = computed(() => visibleMarkerItems.value.find((item) => item.kind === 'group' && item.key === activeGroupKey.value) ?? null);
let preparedEntryTarget: EntryTarget | null = null;

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  markerMotion.dispose();
  cancelLabelsPreload();
  clearMarkers();
  if (draftMarker) {
    draftMarker.setMap(null);
    draftMarker = null;
  }
  map?.destroy();
  map = null;
  amapSdk = null;
});

watch(
  () => [props.moments.map((moment) => `${moment.id}:${moment.longitude}:${moment.latitude}:${moment.category}`).join('|'), props.listReady] as const,
  () => {
    const nextVisibleIds = new Set(getVisibleMoments().map((moment) => moment.id));
    markerMotion.requestReplay(shouldReplayVisibleMarkers(nextVisibleIds));
    lastVisibleIds = nextVisibleIds;
    preparedEntryTarget = null;
    emitMapLoadingState({ markersReady: false, labelsReady: props.preloaderActive ? false : currentLoadingState.labelsReady });
    renderMarkers();
    nextTick(() => {
      if (mapStatus.value !== 'loading' && !map) {
        emitMapLoadingState({ markersReady: true, labelsReady: true });
      }
      void playPendingMarkerReveal();
      syncVisibleMapView();
    });
  },
  { flush: 'post' }
);

watch(
  () => props.draftLocation,
  () => {
    renderDraftMarker();
    nextTick(markerMotion.popDraft);
  },
  { deep: true }
);

watch(
  () => [props.selectedId, props.motionFeedbackId, props.removingMotionId, props.reducedMotion] as const,
  () => {
    applyMarkerState();
    nextTick(markerMotion.pulseSelected);
  },
  { flush: 'post' }
);

watch(
  () => [props.entryLocked, props.preloaderActive, props.listReady] as const,
  () => {
    nextTick(() => {
      void playPendingMarkerReveal();
    });
  },
  { flush: 'post' }
);

watch(
  () => props.selectedId,
  (id) => {
    closeGroupPopover();
    const moment = props.moments.find((item) => item.id === id);
    if (moment && map && hasCoordinates(moment)) {
      map.setZoomAndCenter(Math.max(map.getZoom(), 12), [moment.longitude, moment.latitude], false, 500);
    }
  }
);

watch(
  () => props.moments,
  () => {
    syncVisibleMapView();
  },
  { deep: true }
);

watch(
  () => props.resetSignal,
  () => {
    renderDraftMarker();
    nextTick(fitVisible);
  }
);

async function initMap() {
  emitMapLoadingState({ sdkSettled: false, instanceReady: false, markersReady: false, labelsReady: false });
  try {
    amapSdk = await loadAmapSdk();
    emitMapLoadingState({ sdkSettled: true });
    if (!mapElement.value) {
      return;
    }
    map = new amapSdk.Map(mapElement.value, {
      center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
      zoom: 3,
      resizeEnable: true,
      viewMode: '3D',
      pitch: 0,
      rotation: 0,
      animateEnable: true,
      jogEnable: true,
      scrollWheel: false,
      mapStyle: 'amap://styles/darkblue'
    });
    map.on('click', handleAmapClick);
    map.on('rightclick', handleAmapRightClick);
    camera.attach(map, mapElement.value);
    mapStatus.value = 'ready';
    emitMapLoadingState({ instanceReady: true });
    sdkMessage.value = '';
    renderMarkers();
    renderDraftMarker();
    syncVisibleMapView();
  } catch (error) {
    const message = errorMessage(error, '地图加载失败，请稍后再试');
    mapStatus.value = 'fallback';
    sdkMessage.value = message;
    emitMapLoadingState({ sdkSettled: true, instanceReady: true, markersReady: true, labelsReady: true });
  }
}

function getVisibleMoments() {
  return visibleMoments.value;
}

function getVisibleMarkerItems() {
  return visibleMarkerItems.value;
}

function shouldReplayVisibleMarkers(nextVisibleIds: Set<number>) {
  if (
    !nextVisibleIds.size ||
    !lastVisibleIds.size ||
    !markerMotion.hasRevealedAny() ||
    props.preloaderActive ||
    props.entryLocked ||
    props.motionFeedbackId ||
    props.removingMotionId
  ) {
    return false;
  }

  if (setsEqual(nextVisibleIds, lastVisibleIds)) {
    return false;
  }

  return nextVisibleIds.size <= lastVisibleIds.size;
}

function setsEqual(left: Set<number>, right: Set<number>) {
  if (left.size !== right.size) {
    return false;
  }
  return [...left].every((id) => right.has(id));
}

function clearMarkers() {
  markerMotion.stopMarkers();
  markers.forEach(({ marker }) => marker.setMap(null));
  markers = [];
}

function renderMarkers() {
  const Marker = amapSdk?.Marker;
  const Pixel = amapSdk?.Pixel;
  if (!map || !Marker || !Pixel) {
    return;
  }
  clearMarkers();
  const visible = getVisibleMoments();
  const markerItems = getVisibleMarkerItems();
  const pendingIds = new Set(visible.filter((moment) => markerMotion.isPending([moment.id])).map((moment) => moment.id));
  markerMotion.consumeReplay();
  markerItems.forEach((item, index) => {
    const element = createMarkerElement(item, index, markerItems, item.moments.some((moment) => pendingIds.has(moment.id)));
    const marker = new Marker({
      position: [item.longitude, item.latitude],
      offset: new Pixel(-15, -15),
      content: element
    });
    marker.setMap(map);
    markers.push({ key: item.key, id: item.id, ids: item.moments.map((moment) => moment.id), element, marker });
  });
  applyMarkerState();
  closeStaleGroupPopover();
  emitMapLoadingState({ markersReady: true });
}

function emitMapLoadingState(partial: Partial<StoryMapLoadingState>) {
  currentLoadingState = {
    ...currentLoadingState,
    ...partial
  };
  emit('loading-state', {
    ...currentLoadingState
  });
}

function createMarkerElement(item: StoryMarkerItem, index: number, visible: StoryMarkerItem[], revealPending = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = markerClassName(item, index, visible.length);
  button.classList.toggle('is-reveal-pending', revealPending && !props.reducedMotion);
  button.dataset.storyMotionId = String(item.id);
  button.dataset.storyMarkerKey = item.key;
  button.dataset.storyGroupIds = item.moments.map((moment) => moment.id).join(' ');
  button.dataset.storyRevealOrder = String(getMarkerRevealOrderForItem(item, visible));
  button.style.setProperty('--story-marker-index', String(index));
  button.style.setProperty('--story-marker-reveal-order', String(getMarkerRevealOrderForItem(item, visible)));
  button.setAttribute('aria-label', item.kind === 'group' ? `查看${item.locationName}的 ${item.count} 条点滴` : `查看点滴：${item.representative.title}，${formatDottedDate(item.representative.eventTime)}`);
  button.innerHTML = createMarkerHtml(item);
  const label = button.querySelector('.story-marker__label');
  if (label) {
    label.textContent = formatMarkerLabel(item);
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (props.entryLocked) {
      return;
    }
    if (item.kind === 'group') {
      openGroupPopover(item, button);
      return;
    }
    emit('select', item.id);
  });
  button.addEventListener('keydown', (event) => {
    if (props.entryLocked) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (item.kind === 'group') {
        openGroupPopover(item, button);
        return;
      }
      emit('select', item.id);
    }
  });
  return button;
}

function createMarkerHtml(item: StoryMarkerItem) {
  const count = item.kind === 'group' ? `<span class="story-marker__count">${item.count}</span>` : '';
  return `<span class="story-marker__glint" aria-hidden="true"></span><span class="story-marker__pulse" aria-hidden="true"></span><span class="story-marker__visual"><span class="story-marker__pin">${count}</span></span><span class="story-marker__label"></span>`;
}

function formatMarkerLabel(item: StoryMarkerItem) {
  if (item.kind === 'group') {
    return `${item.locationName} · ${item.count}`;
  }
  return `${formatDottedDate(item.representative.eventTime)} ${item.representative.title}`;
}

function renderDraftMarker() {
  const Marker = amapSdk?.Marker;
  const Pixel = amapSdk?.Pixel;
  if (!map || !Marker || !Pixel) {
    return;
  }
  if (draftMarker) {
    draftMarker.setMap(null);
    draftMarker = null;
  }
  if (!props.draftLocation) {
    return;
  }
  const content = document.createElement('span');
  content.className = 'story-marker story-marker--draft is-active';
  content.innerHTML =
    '<span class="story-marker__glint" aria-hidden="true"></span><span class="story-marker__pulse" aria-hidden="true"></span><span class="story-marker__visual"><span class="story-marker__pin"><span class="story-marker__glyph">+</span></span></span>';
  draftMarker = new Marker({
    position: [props.draftLocation.longitude, props.draftLocation.latitude],
    offset: new Pixel(-15, -15),
    content
  });
  draftMarker.setMap(map);
  map.setZoomAndCenter(13, [props.draftLocation.longitude, props.draftLocation.latitude], false, 500);
}

function fitVisible(options: FitVisibleOptions = {}) {
  if (!map) {
    return null;
  }
  const isMobile = options.isMobile ?? Boolean(window.matchMedia?.('(max-width: 767px)').matches);
  const fallback = options.fallback ?? getEstimatedEntryTarget(isMobile);
  const immediate = Boolean(options.immediate);
  const duration = options.duration ?? 500;
  const visibleMarkers = props.moments.filter(hasCoordinates);
  if (!visibleMarkers.length) {
    const target = { center: DEFAULT_CENTER, zoom: 3 };
    camera.setCenterZoom(target.zoom, target.center, immediate, immediate ? undefined : duration);
    return target;
  }
  if (visibleMarkers.length === 1) {
    const moment = visibleMarkers[0];
    const target = { center: { longitude: moment.longitude, latitude: moment.latitude }, zoom: 12 };
    camera.setCenterZoom(target.zoom, target.center, immediate, immediate ? undefined : duration);
    return target;
  }
  if (markers.length) {
    map.setFitView(
      markers.map((record) => record.marker),
      immediate,
      [160, 180, 190, 280],
      14
    );
    return camera.readTarget(fallback);
  }
  return fallback;
}

function syncVisibleMapView() {
  if (!map) {
    return;
  }
  if (props.preloaderActive && !props.listReady) {
    return;
  }
  if (!currentLoadingState.labelsReady) {
    preloadEntryLabels();
    return;
  }
  fitVisible();
}

function preloadEntryLabels() {
  if (!map || currentLoadingState.labelsReady) {
    return;
  }

  const serial = ++labelsPreloadSerial;
  if (labelsPreloadTimer) {
    window.clearTimeout(labelsPreloadTimer);
    labelsPreloadTimer = null;
  }

  const isMobile = Boolean(window.matchMedia?.('(max-width: 767px)').matches);
  preparedEntryTarget = fitVisible({ immediate: true, isMobile }) ?? getEstimatedEntryTarget(isMobile);
  camera.showEnd(entryTarget(isMobile), isMobile);

  labelsPreloadTimer = window.setTimeout(() => {
    if (serial !== labelsPreloadSerial || !map) {
      return;
    }
    labelsPreloadTimer = null;
    emitMapLoadingState({ labelsReady: true });
  }, isMobile ? 620 : 760);
}

function prepareEntryCamera(options: EntryCameraOptions) {
  return camera.prepareEntry(entryTarget(options.isMobile), options.isMobile);
}

function playEntryCamera(options: EntryCameraOptions) {
  return camera.flyIn(entryTarget(options.isMobile), options.isMobile, () => {
    fitVisible({ immediate: true, isMobile: options.isMobile });
  });
}

function entryTarget(isMobile: boolean): EntryTarget {
  return preparedEntryTarget ?? getEstimatedEntryTarget(isMobile);
}

function getEstimatedEntryTarget(isMobile: boolean): EntryTarget {
  return getStoryMapTarget(props.moments, isMobile);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function handleAmapClick(event: AMapMouseEvent) {
  closeGroupPopover();
  const coordinate = readAmapCoordinate(event.lnglat);
  if (props.entryLocked || !props.canCreate || !coordinate) {
    return;
  }
  const anchor = getAmapClickAnchor(event);
  markerMotion.showRipple(anchor);
  emit(
    'create-at',
    await resolveLocation(coordinate.longitude, coordinate.latitude),
    anchor
  );
}

function handleAmapRightClick(event: AMapMouseEvent) {
  event.originEvent?.preventDefault();
  if (props.entryLocked) {
    return;
  }
  closeGroupPopover();
  emit('reset');
}

function getAmapClickAnchor(event: AMapMouseEvent): StoryEditorAnchor | undefined {
  const originEvent = event.originEvent;
  if (typeof originEvent?.clientX === 'number' && typeof originEvent?.clientY === 'number') {
    return { x: originEvent.clientX, y: originEvent.clientY };
  }

  const pixel = event?.pixel;
  const rect = mapElement.value?.getBoundingClientRect();
  if (!pixel || !rect) {
    return undefined;
  }

  const pixelX = typeof pixel.getX === 'function' ? pixel.getX() : pixel.x;
  const pixelY = typeof pixel.getY === 'function' ? pixel.getY() : pixel.y;
  if (typeof pixelX !== 'number' || typeof pixelY !== 'number') {
    return undefined;
  }

  return { x: rect.left + pixelX, y: rect.top + pixelY };
}

async function resolveLocation(longitude: number, latitude: number): Promise<StoryDraftLocation> {
  const location = await reverseGeocode(longitude, latitude);
  return {
    longitude,
    latitude,
    locationName: location?.locationName ?? '地图落点',
    address:
      location?.address ?? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  };
}

async function handleFallbackClick(event: MouseEvent) {
  if (mapStatus.value === 'ready' || props.entryLocked) {
    return;
  }

  if ((event.target as HTMLElement | null)?.closest('.story-marker, .story-map-group-popover')) {
    return;
  }

  closeGroupPopover();
  if (!props.canCreate) {
    return;
  }

  sdkMessage.value = '地图暂不可用，请稍后重新加载后选择地点';
}

function handleFallbackContextMenu(event: MouseEvent) {
  event.preventDefault();
  if (props.entryLocked) {
    return;
  }
  closeGroupPopover();
  emit('reset');
}

function selectFallbackMarker(item: StoryMarkerItem, event: MouseEvent) {
  if (props.entryLocked) {
    return;
  }
  if (item.kind === 'group') {
    openGroupPopover(item, event.currentTarget as HTMLElement);
    return;
  }
  emit('select', item.id);
}

function openGroupPopover(item: StoryMarkerItem, anchor?: HTMLElement) {
  if (item.kind !== 'group' || props.entryLocked) {
    return;
  }
  activeGroupKey.value = item.key;
  groupPopoverPosition.value = getGroupPopoverPosition(anchor);
}

function closeGroupPopover() {
  activeGroupKey.value = null;
  groupPopoverPosition.value = null;
}

function closeStaleGroupPopover() {
  if (activeGroupKey.value && !visibleMarkerItems.value.some((item) => item.kind === 'group' && item.key === activeGroupKey.value)) {
    closeGroupPopover();
  }
}

function selectGroupMoment(id: number) {
  closeGroupPopover();
  emit('select', id);
}

function getGroupPopoverPosition(anchor?: HTMLElement): GroupPopoverPosition {
  const surface = mapElement.value?.getBoundingClientRect();
  const anchorRect = anchor?.getBoundingClientRect();
  if (!surface || !anchorRect) {
    return { left: 24, top: 24 };
  }

  return {
    left: clamp(anchorRect.left + anchorRect.width / 2 - surface.left + 18, 12, Math.max(12, surface.width - 248)),
    top: clamp(anchorRect.top - surface.top - 16, 12, Math.max(12, surface.height - 210))
  };
}

function groupPopoverStyle(position: GroupPopoverPosition | null) {
  const value = position ?? { left: 24, top: 24 };
  return {
    left: `${value.left}px`,
    top: `${value.top}px`
  };
}

function isMarkerItemSelected(item: StoryMarkerItem) {
  return containsMomentId(item, props.selectedId);
}

function markerClassName(item: StoryMarkerItem, index: number, total: number) {
  const classes = ['story-marker', `story-marker--${item.category}`];
  if (item.kind === 'group') {
    classes.push('story-marker--group');
  }
  if (isMarkerItemSelected(item)) {
    classes.push('is-active');
  }
  if (containsMomentId(item, getLatestVisibleMomentId())) {
    classes.push('is-latest');
  }
  if (shouldBreathe(total)) {
    classes.push('is-breathing');
  }
  if (containsMomentId(item, props.motionFeedbackId)) {
    classes.push('is-motion-feedback');
  }
  if (containsMomentId(item, props.removingMotionId)) {
    classes.push('is-removing');
  }
  classes.push(`story-marker--motion-${index % 6}`);
  return classes.join(' ');
}

function markerClassObject(item: StoryMarkerItem, index: number, total: number) {
  const visible = getVisibleMarkerItems();
  return {
    'story-marker--group': item.kind === 'group',
    'is-active': isMarkerItemSelected(item),
    'is-latest': containsMomentId(item, getLatestVisibleMomentId()),
    'is-breathing': shouldBreathe(total),
    'is-reveal-pending': isMarkerRevealPending(item),
    'is-motion-feedback': containsMomentId(item, props.motionFeedbackId),
    'is-removing': containsMomentId(item, props.removingMotionId),
    [`story-marker--motion-${index % 6}`]: true,
    [`story-marker--reveal-${getMarkerRevealOrderForItem(item, visible) % 6}`]: true
  };
}

function markerMotionStyle(index: number, item?: StoryMarkerItem, visible = getVisibleMarkerItems()) {
  return {
    '--story-marker-index': String(index),
    '--story-marker-reveal-order': String(item ? getMarkerRevealOrderForItem(item, visible) : index)
  };
}

function shouldBreathe(_total: number) {
  return !props.reducedMotion;
}

function isMarkerRevealPending(item: StoryMarkerItem) {
  return !props.reducedMotion && markerMotion.isPending(item.moments.map((moment) => moment.id));
}

function getLatestVisibleMomentId() {
  return getLatestStoryMomentId(getVisibleMoments());
}

function getMarkerRevealOrderForItem(item: StoryMarkerItem, visible = getVisibleMarkerItems()) {
  return getStoryMarkerRevealOrder(item, visible, props.selectedId);
}

function applyMarkerState() {
  const visible = getVisibleMarkerItems();
  const total = visible.length;
  const latestId = getLatestVisibleMomentId();
  markers.forEach(({ key, element }, index) => {
    const item = visible.find((markerItem) => markerItem.key === key);
    const revealOrder = item ? getMarkerRevealOrderForItem(item, visible) : index;
    element.classList.toggle('story-marker--group', item?.kind === 'group');
    element.classList.toggle('is-active', item ? isMarkerItemSelected(item) : false);
    element.classList.toggle('is-latest', item ? containsMomentId(item, latestId) : false);
    element.classList.toggle('is-motion-feedback', item ? containsMomentId(item, props.motionFeedbackId) : false);
    element.classList.toggle('is-removing', item ? containsMomentId(item, props.removingMotionId) : false);
    element.classList.toggle('is-breathing', item ? shouldBreathe(total) : false);
    element.dataset.storyRevealOrder = String(revealOrder);
    element.style.setProperty('--story-marker-index', String(index));
    element.style.setProperty('--story-marker-reveal-order', String(revealOrder));
  });
}

function playPendingMarkerReveal(options: MarkerRevealOptions = {}) {
  if (props.entryLocked || props.preloaderActive || !props.listReady) {
    return Promise.resolve();
  }
  return playMarkerReveal(options);
}

function playMarkerReveal(options: MarkerRevealOptions = {}) {
  return markerMotion.reveal(getVisibleMoments(), getVisibleMarkerItems(), options);
}

function cancelLabelsPreload() {
  if (labelsPreloadTimer) {
    window.clearTimeout(labelsPreloadTimer);
    labelsPreloadTimer = null;
  }
  labelsPreloadSerial += 1;
  preparedEntryTarget = null;
}

function fallbackStyle(item: StoryMarkerItem) {
  return getStoryFallbackPosition(item, fallbackMarkerItems.value);
}

function draftFallbackStyle() {
  return {
    left: '50%',
    top: '45%'
  };
}

defineExpose({
  prepareEntryCamera,
  playEntryCamera,
  playMarkerReveal
});

</script>

<template>
  <div class="story-map-canvas" :class="{ 'is-selecting': canCreate, 'is-entry-locked': entryLocked }">
    <div ref="mapElement" class="story-map-canvas__surface" @click="handleFallbackClick" @contextmenu="handleFallbackContextMenu">
      <div v-if="mapStatus !== 'ready'" class="story-map-canvas__fallback" aria-hidden="true">
        <span v-for="line in 9" :key="line" class="story-map-canvas__road" />
      </div>

      <template v-if="mapStatus !== 'ready'">
        <button
          v-for="(markerItem, index) in fallbackMarkerItems"
          :key="markerItem.key"
          class="story-marker story-map-canvas__fallback-marker"
          :class="[`story-marker--${markerItem.category}`, markerClassObject(markerItem, index, fallbackMarkerItems.length)]"
          type="button"
          :style="[fallbackStyle(markerItem), markerMotionStyle(index, markerItem, fallbackMarkerItems)]"
          :data-story-motion-id="markerItem.id"
          :data-story-marker-key="markerItem.key"
          :data-story-group-ids="markerItem.moments.map((moment) => moment.id).join(' ')"
          :data-story-reveal-order="getMarkerRevealOrderForItem(markerItem, fallbackMarkerItems)"
          :aria-label="markerItem.kind === 'group' ? `查看${markerItem.locationName}的 ${markerItem.count} 条点滴` : `查看点滴：${markerItem.representative.title}`"
          :disabled="entryLocked"
          @click.stop="selectFallbackMarker(markerItem, $event)"
        >
          <span class="story-marker__glint" aria-hidden="true" />
          <span class="story-marker__pulse" aria-hidden="true" />
          <span class="story-marker__visual">
            <span class="story-marker__pin">
              <span v-if="markerItem.kind === 'group'" class="story-marker__count">{{ markerItem.count }}</span>
            </span>
          </span>
          <span class="story-marker__label">{{ formatMarkerLabel(markerItem) }}</span>
        </button>
        <span v-if="draftLocation" class="story-marker story-marker--draft is-active story-map-canvas__fallback-marker" :style="draftFallbackStyle()">
          <span class="story-marker__glint" aria-hidden="true" />
          <span class="story-marker__pulse" aria-hidden="true" />
          <span class="story-marker__visual">
            <span class="story-marker__pin"><span class="story-marker__glyph">+</span></span>
          </span>
        </span>
      </template>

      <aside
        v-if="activeGroupItem"
        class="story-map-group-popover"
        :style="groupPopoverStyle(groupPopoverPosition)"
        aria-label="地点点滴列表"
        @click.stop
      >
        <header>
          <p>{{ activeGroupItem.locationName }}</p>
          <span>{{ activeGroupItem.count }} 条点滴</span>
        </header>
        <button
          v-for="moment in activeGroupItem.moments"
          :key="moment.id"
          class="story-map-group-popover__item"
          type="button"
          @click="selectGroupMoment(moment.id)"
        >
          <strong>{{ moment.title }}</strong>
          <span>{{ formatDottedDate(moment.eventTime) }}</span>
        </button>
      </aside>
    </div>

    <p v-if="sdkMessage" class="story-map-canvas__sdk-note">{{ sdkMessage }}</p>
  </div>
</template>
