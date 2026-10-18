<script setup lang="ts">
import { errorMessage, formatDottedDate } from '../../../display';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
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

const SMOOTH_WHEEL_ZOOM_STEP = 0.22;
const SMOOTH_WHEEL_ZOOM_MIN = 3;
const SMOOTH_WHEEL_ZOOM_MAX = 18;
const SMOOTH_WHEEL_ZOOM_MAX_DELTA = 0.72;
const SMOOTH_WHEEL_ZOOM_DURATION = 120;
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
let markerContext: gsap.Context | undefined;
let markerEnterTl: gsap.core.Timeline | undefined;
let selectedPulseTl: gsap.core.Timeline | undefined;
let draftTween: gsap.core.Tween | undefined;
let rippleTween: gsap.core.Tween | undefined;
let rippleElement: HTMLSpanElement | null = null;
let entryCameraTimer: ReturnType<typeof window.setTimeout> | null = null;
let labelsPreloadTimer: ReturnType<typeof window.setTimeout> | null = null;
let labelsPreloadSerial = 0;
let forceRevealVisibleOnNextRender = false;
let lastVisibleIds = new Set<number>();
let activeRevealRoots: HTMLElement[] = [];
let smoothWheelElement: HTMLElement | null = null;
let smoothWheelRaf: number | null = null;
let pendingSmoothWheelZoomDelta = 0;
let smoothWheelTargetZoom: number | null = null;
let currentLoadingState: StoryMapLoadingState = {
  sdkSettled: false,
  instanceReady: false,
  markersReady: false,
  labelsReady: false
};
const playedMarkerIds = new Set<number>();
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
type MarkerRevealOptions = {
  ids?: number[];
  replayVisible?: boolean;
  isMobile?: boolean;
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
  cleanupSmoothWheelZoom();
  cleanupMapMotion();
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
    forceRevealVisibleOnNextRender = shouldReplayVisibleMarkers(nextVisibleIds);
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
    nextTick(playDraftMarker);
  },
  { deep: true }
);

watch(
  () => [props.selectedId, props.motionFeedbackId, props.removingMotionId, props.reducedMotion] as const,
  () => {
    applyMarkerState();
    nextTick(playSelectedMarkerPulse);
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
    bindSmoothWheelZoom();
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
    !playedMarkerIds.size ||
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
  stopMarkerReveal();
  selectedPulseTl?.kill();
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
  const pendingIds = new Set(
    visible.filter((moment) => forceRevealVisibleOnNextRender || !playedMarkerIds.has(moment.id)).map((moment) => moment.id)
  );
  forceRevealVisibleOnNextRender = false;
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
    applyMapCenterZoom(target.zoom, target.center, immediate, immediate ? undefined : duration);
    return target;
  }
  if (visibleMarkers.length === 1) {
    const moment = visibleMarkers[0];
    const target = { center: { longitude: moment.longitude, latitude: moment.latitude }, zoom: 12 };
    applyMapCenterZoom(target.zoom, target.center, immediate, immediate ? undefined : duration);
    return target;
  }
  if (markers.length) {
    map.setFitView(
      markers.map((record) => record.marker),
      immediate,
      [160, 180, 190, 280],
      14
    );
    return readCurrentEntryTarget(fallback);
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
  const camera = getEntryCamera(isMobile);
  applyMapPitch(camera.targetPitch, true);
  applyMapRotation(camera.targetRotation, true);
  applyMapCenterZoom(camera.targetZoom, camera.center, true);

  labelsPreloadTimer = window.setTimeout(() => {
    if (serial !== labelsPreloadSerial || !map) {
      return;
    }
    labelsPreloadTimer = null;
    emitMapLoadingState({ labelsReady: true });
  }, isMobile ? 620 : 760);
}

function prepareEntryCamera(options: EntryCameraOptions) {
  if (!map) {
    return false;
  }
  const camera = getEntryCamera(options.isMobile);
  applyMapPitch(camera.startPitch, true);
  applyMapRotation(camera.startRotation, true);
  applyMapCenterZoom(camera.startZoom, camera.center, true);
  return true;
}

function playEntryCamera(options: EntryCameraOptions) {
  if (!map) {
    return Promise.resolve(false);
  }

  if (entryCameraTimer) {
    window.clearTimeout(entryCameraTimer);
    entryCameraTimer = null;
  }

  const camera = getEntryCamera(options.isMobile);
  if (props.reducedMotion) {
    applyMapPitch(camera.targetPitch, true);
    applyMapRotation(camera.targetRotation, true);
    applyMapCenterZoom(camera.targetZoom, camera.center, true);
    fitVisible({ immediate: true, isMobile: options.isMobile });
    return Promise.resolve(true);
  }

  const duration = options.isMobile ? 1550 : 2120;
  applyMapPitch(camera.startPitch, true);
  applyMapRotation(camera.startRotation, true);
  applyMapCenterZoom(camera.startZoom, camera.center, true);

  window.requestAnimationFrame(() => {
    applyMapPitch(camera.targetPitch, false, duration);
    applyMapRotation(camera.targetRotation, false, duration);
    applyMapCenterZoom(camera.targetZoom, camera.center, false, duration);
  });

  return new Promise<boolean>((resolve) => {
    entryCameraTimer = window.setTimeout(() => {
      entryCameraTimer = null;
      applyMapPitch(camera.targetPitch, true);
      applyMapRotation(camera.targetRotation, true);
      applyMapCenterZoom(camera.targetZoom, camera.center, true);
      fitVisible({ immediate: true, isMobile: options.isMobile });
      resolve(true);
    }, duration + 120);
  });
}

function getEntryCamera(isMobile: boolean) {
  const target = preparedEntryTarget ?? getEstimatedEntryTarget(isMobile);
  const startZoom = Math.max(isMobile ? 5.8 : 4.8, target.zoom - (isMobile ? 2.1 : 3));

  return {
    center: target.center,
    startZoom,
    targetZoom: target.zoom,
    startPitch: canTiltMap() ? (isMobile ? 7 : 20) : 0,
    targetPitch: canTiltMap() ? (isMobile ? 0 : 8) : 0,
    startRotation: canRotateMap() ? (isMobile ? 0 : -4) : 0,
    targetRotation: 0
  };
}

function getEstimatedEntryTarget(isMobile: boolean): EntryTarget {
  return getStoryMapTarget(props.moments, isMobile);
}

function readCurrentEntryTarget(fallback: EntryTarget): EntryTarget {
  if (!map) {
    return fallback;
  }

  return {
    center: readAmapCoordinate(map.getCenter()) ?? fallback.center,
    zoom: map.getZoom()
  };
}

function applyMapCenterZoom(zoom: number, center: { longitude: number; latitude: number }, immediate: boolean, duration?: number) {
  smoothWheelTargetZoom = null;
  map?.setZoomAndCenter(zoom, [center.longitude, center.latitude], immediate, duration);
}

function applyMapPitch(value: number, immediate: boolean, duration?: number) {
  if (canTiltMap()) {
    map?.setPitch(value, immediate, duration);
  }
}

function applyMapRotation(value: number, immediate: boolean, duration?: number) {
  if (canRotateMap()) {
    map?.setRotation(value, immediate, duration);
  }
}

function canTiltMap() {
  return typeof map?.setPitch === 'function';
}

function canRotateMap() {
  return typeof map?.setRotation === 'function';
}

function clampZoom(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function bindSmoothWheelZoom() {
  const element = mapElement.value;
  if (!element || smoothWheelElement === element) {
    return;
  }
  cleanupSmoothWheelZoom();
  element.addEventListener('wheel', handleSmoothWheel, { passive: false });
  smoothWheelElement = element;
}

function cleanupSmoothWheelZoom() {
  if (smoothWheelElement) {
    smoothWheelElement.removeEventListener('wheel', handleSmoothWheel);
    smoothWheelElement = null;
  }
  if (smoothWheelRaf !== null) {
    window.cancelAnimationFrame(smoothWheelRaf);
    smoothWheelRaf = null;
  }
  pendingSmoothWheelZoomDelta = 0;
  smoothWheelTargetZoom = null;
}

function handleSmoothWheel(event: WheelEvent) {
  if (!map || mapStatus.value !== 'ready') {
    return;
  }
  event.preventDefault();

  pendingSmoothWheelZoomDelta = clampZoom(
    pendingSmoothWheelZoomDelta + getWheelZoomDelta(event),
    -SMOOTH_WHEEL_ZOOM_MAX_DELTA,
    SMOOTH_WHEEL_ZOOM_MAX_DELTA
  );

  if (smoothWheelRaf !== null) {
    return;
  }
  smoothWheelRaf = window.requestAnimationFrame(flushSmoothWheelZoom);
}

function getWheelZoomDelta(event: WheelEvent) {
  const modeScale = event.deltaMode === 1 ? 36 : event.deltaMode === 2 ? 240 : 1;
  const delta = event.deltaY * modeScale;
  const direction = delta > 0 ? -1 : 1;
  const magnitude = clampZoom(Math.abs(delta) / 100, 0.72, 1.18);
  return direction * SMOOTH_WHEEL_ZOOM_STEP * magnitude;
}

function flushSmoothWheelZoom() {
  smoothWheelRaf = null;
  if (!map || Math.abs(pendingSmoothWheelZoomDelta) < 0.001) {
    pendingSmoothWheelZoomDelta = 0;
    return;
  }

  const baseZoom = smoothWheelTargetZoom ?? readCurrentZoom();
  const limits = getSmoothWheelZoomLimits();
  const targetZoom = clampZoom(baseZoom + pendingSmoothWheelZoomDelta, limits.min, limits.max);
  pendingSmoothWheelZoomDelta = 0;
  smoothWheelTargetZoom = targetZoom;
  applySmoothWheelZoom(targetZoom);
}

function readCurrentZoom() {
  return map ? map.getZoom(2) : 8;
}

function getSmoothWheelZoomLimits() {
  if (!map) {
    return { min: SMOOTH_WHEEL_ZOOM_MIN, max: SMOOTH_WHEEL_ZOOM_MAX };
  }
  const [min, max] = map.getZooms();
  return { min, max };
}

function applySmoothWheelZoom(zoom: number) {
  const immediate = props.reducedMotion;
  const duration = props.reducedMotion ? 0 : SMOOTH_WHEEL_ZOOM_DURATION;
  map?.setZoom(zoom, immediate, duration);
}

async function handleAmapClick(event: AMapMouseEvent) {
  closeGroupPopover();
  const coordinate = readAmapCoordinate(event.lnglat);
  if (props.entryLocked || !props.canCreate || !coordinate) {
    return;
  }
  const anchor = getAmapClickAnchor(event);
  showClickRipple(anchor);
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
    left: clampZoom(anchorRect.left + anchorRect.width / 2 - surface.left + 18, 12, Math.max(12, surface.width - 248)),
    top: clampZoom(anchorRect.top - surface.top - 16, 12, Math.max(12, surface.height - 210))
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
  return !props.reducedMotion && (forceRevealVisibleOnNextRender || item.moments.some((moment) => !playedMarkerIds.has(moment.id)));
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
  const scope = mapElement.value;
  if (!scope) {
    return Promise.resolve();
  }

  const visible = getVisibleMoments();
  if (!visible.length) {
    return Promise.resolve();
  }

  const idFilter = options.ids ? new Set(options.ids) : undefined;
  const revealItems = getMarkerRevealItems(visible, idFilter).filter((item) => {
    if (options.replayVisible || idFilter) {
      return true;
    }
    return item.root.classList.contains('is-reveal-pending') || !playedMarkerIds.has(item.id);
  });
  forceRevealVisibleOnNextRender = false;

  if (!revealItems.length) {
    return Promise.resolve();
  }

  stopMarkerReveal();
  revealItems.forEach((item) => {
    item.ids.forEach((id) => playedMarkerIds.add(id));
    item.root.classList.remove('is-reveal-pending');
    item.root.classList.add('is-animating');
  });
  activeRevealRoots = revealItems.map((item) => item.root);

  const isMobile = options.isMobile ?? Boolean(window.matchMedia?.('(max-width: 767px)').matches);

  return new Promise<void>((resolve) => {
    markerContext = gsap.context(() => {
      if (props.reducedMotion) {
        gsap.set(
          revealItems.flatMap((item) => [item.visual, item.glint, item.pulse].filter((element): element is HTMLElement => Boolean(element))),
          { autoAlpha: 1, scale: 1, y: 0, rotation: 0, clearProps: 'transform,visibility' }
        );
        gsap.set(
          revealItems.flatMap((item) => [item.glint, item.pulse].filter((element): element is HTMLElement => Boolean(element))),
          { autoAlpha: 0 }
        );
        cleanupRevealItems(revealItems);
        resolve();
        return;
      }

      const fullRevealLimit = getFullRevealLimit(revealItems.length, isMobile);
      const fullItems = revealItems.slice(0, fullRevealLimit);
      const fadeItems = revealItems.slice(fullRevealLimit);
      const fullVisuals = fullItems.map((item) => item.visual);
      const fullGlints = fullItems.map((item) => item.glint).filter((element): element is HTMLElement => Boolean(element));
      const fullPulses = fullItems.map((item) => item.pulse).filter((element): element is HTMLElement => Boolean(element));
      const fadeVisuals = fadeItems.map((item) => item.visual);
      const each = getRevealStagger(revealItems.length, isMobile);
      const visualY = isMobile ? 4 : 8;
      const visualRotation = isMobile ? -0.6 : -1.8;

      markerEnterTl = gsap.timeline({
        defaults: { ease: 'power3.out', overwrite: 'auto' },
        onComplete: () => {
          gsap.set([...fullVisuals, ...fadeVisuals], { clearProps: 'transform,visibility' });
          gsap.set([...fullGlints, ...fullPulses], { autoAlpha: 0, clearProps: 'transform,visibility' });
          cleanupRevealItems(revealItems);
          activeRevealRoots = [];
          resolve();
        }
      });

      if (fullGlints.length) {
        markerEnterTl
          .fromTo(fullGlints, { autoAlpha: 0, scale: 0.35 }, { autoAlpha: 0.75, scale: 1, duration: isMobile ? 0.08 : 0.12, stagger: { each } }, 0)
          .to(fullGlints, { autoAlpha: 0, duration: isMobile ? 0.08 : 0.14, stagger: { each } }, isMobile ? 0.1 : 0.15);
      }

      if (fullPulses.length) {
        markerEnterTl.fromTo(
          fullPulses,
          { autoAlpha: isMobile ? 0.22 : 0.32, scale: 0.65 },
          { autoAlpha: 0, scale: isMobile ? 1.62 : 2.05, duration: isMobile ? 0.22 : 0.34, stagger: { each } },
          isMobile ? 0.04 : 0.06
        );
      }

      if (fullVisuals.length) {
        markerEnterTl
          .fromTo(
            fullVisuals,
            { autoAlpha: 0, scale: 0.4, y: visualY, rotation: visualRotation },
            {
              autoAlpha: 1,
              scale: isMobile ? 1.04 : 1.08,
              y: isMobile ? 0 : -1,
              rotation: isMobile ? 0.45 : 0.8,
              duration: isMobile ? 0.18 : 0.24,
              ease: 'back.out(1.18)',
              stagger: { each }
            },
            isMobile ? 0.06 : 0.1
          )
          .to(
            fullVisuals,
            {
              scale: 1,
              y: 0,
              rotation: 0,
              duration: isMobile ? 0.12 : 0.18,
              ease: 'power2.inOut',
              stagger: { each }
            },
            isMobile ? 0.24 : 0.36
          );
      }

      if (fadeVisuals.length) {
        markerEnterTl.fromTo(
          fadeVisuals,
          { autoAlpha: 0, scale: 0.88 },
          { autoAlpha: 1, scale: 1, duration: isMobile ? 0.12 : 0.18, stagger: { each: isMobile ? 0.01 : 0.018 } },
          fullVisuals.length ? (isMobile ? 0.18 : 0.26) : 0
        );
      }

      if (!markerEnterTl.getChildren(false, true, true).length) {
        cleanupRevealItems(revealItems);
        resolve();
      }
    }, scope);
  });
}

function getMarkerRevealItems(visible: StoryMoment[], idFilter?: Set<number>) {
  const momentById = new Map(visible.map((moment) => [moment.id, moment]));
  const markerItemByKey = new Map(getVisibleMarkerItems().map((item) => [item.key, item]));
  const roots = Array.from(mapElement.value?.querySelectorAll<HTMLElement>('.story-marker:not(.story-marker--draft)') ?? []);
  const items = roots
    .map((root) => {
      const markerItem = root.dataset.storyMarkerKey ? markerItemByKey.get(root.dataset.storyMarkerKey) : null;
      const ids = markerItem?.moments.map((moment) => moment.id) ?? String(root.dataset.storyGroupIds ?? root.dataset.storyMotionId ?? '')
        .split(/\s+/)
        .map((value) => Number(value))
        .filter(Number.isFinite);
      const id = markerItem?.id ?? ids[0];
      const moment = markerItem?.representative ?? momentById.get(id);
      const visual = root.querySelector<HTMLElement>('.story-marker__visual');
      if (!moment || !visual || !Number.isFinite(id) || (idFilter && !ids.some((value) => idFilter.has(value)))) {
        return null;
      }
      return {
        id,
        ids,
        moment,
        root,
        visual,
        glint: root.querySelector<HTMLElement>('.story-marker__glint'),
        pulse: root.querySelector<HTMLElement>('.story-marker__pulse')
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const order = sortStoryMomentsForReveal(
    visible,
    props.selectedId,
    idFilter
  );
  const rank = new Map(order.map((moment, index) => [moment.id, index]));
  return items.sort((a, b) => Math.min(...a.ids.map((id) => rank.get(id) ?? 999)) - Math.min(...b.ids.map((id) => rank.get(id) ?? 999)));
}

function getFullRevealLimit(total: number, isMobile: boolean) {
  if (props.reducedMotion) {
    return 0;
  }
  if (isMobile) {
    return Math.min(total, total > 18 ? 8 : total);
  }
  if (total <= 12) {
    return total;
  }
  if (total <= 40) {
    return Math.min(total, 12);
  }
  return Math.min(total, 8);
}

function getRevealStagger(total: number, isMobile: boolean) {
  if (isMobile) {
    return total > 18 ? 0.018 : 0.035;
  }
  if (total <= 12) {
    return 0.06;
  }
  if (total <= 24) {
    return 0.045;
  }
  return 0.04;
}

function cleanupRevealItems(items: Array<{ root: HTMLElement }>) {
  items.forEach(({ root }) => {
    root.classList.remove('is-animating', 'is-reveal-pending');
  });
}

function stopMarkerReveal() {
  markerEnterTl?.kill();
  if (activeRevealRoots.length) {
    cleanupRevealItems(activeRevealRoots.map((root) => ({ root })));
    activeRevealRoots = [];
  }
}

function playSelectedMarkerPulse() {
  selectedPulseTl?.kill();
  if (props.reducedMotion || !mapElement.value || !props.selectedId) {
    return;
  }
  const pulse = mapElement.value.querySelector<HTMLElement>(`[data-story-motion-id="${props.selectedId}"] .story-marker__pulse`);
  const visual = mapElement.value.querySelector<HTMLElement>(`[data-story-motion-id="${props.selectedId}"] .story-marker__visual`);
  if (!pulse) {
    return;
  }
  selectedPulseTl = gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } });
  if (visual) {
    selectedPulseTl.fromTo(visual, { scale: 1 }, { scale: 1.08, duration: 0.16, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
  }
  selectedPulseTl.fromTo(pulse, { autoAlpha: 0.38, scale: 0.75 }, { autoAlpha: 0, scale: 2.25, duration: 0.55, clearProps: 'transform,visibility' }, 0.04);
}

function playDraftMarker() {
  draftTween?.kill();
  if (props.reducedMotion || !mapElement.value) {
    return;
  }
  const draft = mapElement.value.querySelector<HTMLElement>('.story-marker--draft .story-marker__visual');
  if (!draft) {
    return;
  }
  draftTween = gsap.fromTo(draft, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out', clearProps: 'transform,visibility' });
}

function showClickRipple(anchor?: StoryEditorAnchor) {
  if (props.reducedMotion || !props.canCreate || !mapElement.value || !anchor) {
    return;
  }

  rippleTween?.kill();
  rippleElement?.remove();

  const rect = mapElement.value.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'story-map-ripple story-map-click-ripple';
  ripple.setAttribute('aria-hidden', 'true');
  ripple.style.left = `${anchor.x - rect.left}px`;
  ripple.style.top = `${anchor.y - rect.top}px`;
  mapElement.value.appendChild(ripple);
  rippleElement = ripple;

  rippleTween = gsap.fromTo(
    ripple,
    { autoAlpha: 0.42, scale: 0.28 },
    {
      autoAlpha: 0,
      scale: 2.4,
      duration: 0.46,
      ease: 'power3.out',
      onComplete: () => {
        ripple.remove();
        if (rippleElement === ripple) {
          rippleElement = null;
        }
      }
    }
  );
}

function cleanupMapMotion() {
  stopMarkerReveal();
  selectedPulseTl?.kill();
  draftTween?.kill();
  rippleTween?.kill();
  if (entryCameraTimer) {
    window.clearTimeout(entryCameraTimer);
    entryCameraTimer = null;
  }
  if (labelsPreloadTimer) {
    window.clearTimeout(labelsPreloadTimer);
    labelsPreloadTimer = null;
  }
  labelsPreloadSerial += 1;
  preparedEntryTarget = null;
  rippleElement?.remove();
  rippleElement = null;
  markerContext?.revert();
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
