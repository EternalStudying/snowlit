<script setup lang="ts">
import './wishes.css';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type InputHTMLAttributes } from 'vue';
import { gsap } from 'gsap';
import { NAlert, NButton, NDatePicker, NInput, NModal, NUpload, type UploadFileInfo } from 'naive-ui';
import PageLoader from '../../components/PageLoader.vue';
import { useModalWheelGuard } from '../../composables/useModalWheelGuard';
import boardDone from './assets/board-done.webp';
import heroListBanner from './assets/hero-list-banner.webp';
import boardWantDo from './assets/board-want-do.webp';
import boardWantGo from './assets/board-want-go.webp';
import noteCardCorner from './assets/note-card-corner.webp';
import wishCreateDialogBackground from './assets/wish-create-dialog-background.webp';
import wishCreateEntry from './assets/wish-create-entry.webp';
import { useWishLifecycle } from './internal/useWishLifecycle';
import type {
  WishCategory,
  WishItem,
  WishLaneKey,
  WishLaneTransition
} from './model';

interface WishBoardDefinition {
  laneKey: WishLaneKey;
  title: string;
  boardImage: string;
  legend: string;
}

interface WishBoardGroup extends WishBoardDefinition {
  items: WishItem[];
  loading: boolean;
  hasMore: boolean;
}

const wishPageRef = ref<HTMLElement | null>(null);
const wishLifecycle = useWishLifecycle({ fallbackImageUrl: heroListBanner });
const wishBoardLoaded = wishLifecycle.state.loaded;
const wishBoardError = wishLifecycle.state.loadError;
const wishActionError = wishLifecycle.state.actionError;
const canManageWishes = wishLifecycle.state.canManage;
const isCreatingWish = wishLifecycle.state.creating;
const wishCreateError = wishLifecycle.state.createError;
const selectedWish = wishLifecycle.state.selectedWish;
const createWishDialogOpen = ref(false);
const isCreateWishClosing = ref(false);
const createWishCategory = ref<WishCategory>('want_go');
const createWishForm = ref({
  title: '',
  description: '',
  locationName: '',
  expectedCompletedAt: '',
  note: ''
});
const completionImageInputProps = {
  'data-wish-complete-image': '',
  accept: 'image/jpeg,image/png,image/webp,image/gif'
} as unknown as InputHTMLAttributes;
const wishTitleInputProps = {
  'data-wish-title-input': '',
  required: true
} as unknown as InputHTMLAttributes;
const isWishDetailDialogVisible = ref(false);
const isImagePreviewOpen = ref(false);
const isWishDetailAnimating = ref(false);
const isImagePreviewAnimating = ref(false);
const isCompletionAnimating = ref(false);
const completionImageError = ref('');
const wishDetailBackdropRef = ref<HTMLElement | null>(null);
const wishDetailDialogRef = ref<HTMLElement | null>(null);
const wishDetailImageRef = ref<HTMLImageElement | null>(null);
const imagePreviewRef = ref<HTMLElement | null>(null);
const imagePreviewImageRef = ref<HTMLImageElement | null>(null);
const completionBadgeRef = ref<HTMLButtonElement | null>(null);
const completionUploadHostRef = ref<HTMLElement | null>(null);
const completionImageFileList = ref<UploadFileInfo[]>([]);
const createWishBackdropRef = ref<HTMLElement | null>(null);
const createWishDialogRef = ref<HTMLFormElement | null>(null);
const wishCreatePopupPortal = ref<HTMLElement>();
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const shouldReduceMotion = prefersReducedMotion || import.meta.env.MODE === 'test';
const wishGsapMotionAttr = computed(() => (shouldReduceMotion ? undefined : 'true'));
let wishBoardEnterCleanup: (() => void) | undefined;
let wishDetailTimeline: gsap.core.Timeline | undefined;
let wishDetailClosePromise: Promise<void> | null = null;
let createWishTimeline: gsap.core.Timeline | undefined;
let createWishClosePromise: Promise<void> | null = null;
let imagePreviewTimeline: gsap.core.Timeline | undefined;
let imagePreviewClosePromise: Promise<void> | null = null;
let wishLaneMoveTimeline: gsap.core.Timeline | undefined;
let wishLaneMoveGhost: HTMLElement | null = null;
let wishLaneMoveCleanupFrames: number[] = [];
let hasPlayedWishBoardEnter = false;
const wishLaneMoveTweenDefaults = {
  autoRound: false,
  force3D: true,
  overwrite: 'auto'
} as const;

useModalWheelGuard(createWishDialogOpen);

const wishBoardDefinitions: WishBoardDefinition[] = [
  {
    laneKey: 'wantToGo',
    title: '想去',
    boardImage: boardWantGo,
    legend: '想去：去看世界'
  },
  {
    laneKey: 'wantToDo',
    title: '想做',
    boardImage: boardWantDo,
    legend: '想做：一起成长'
  },
  {
    laneKey: 'done',
    title: '已完成',
    boardImage: boardDone,
    legend: '已完成：回忆收藏'
  }
];

const wishBoardGroups = computed<WishBoardGroup[]>(() =>
  wishBoardDefinitions.map((group) => {
    const lane = wishLifecycle.state.lanes[group.laneKey];
    return {
      ...group,
      items: lane.items.value,
      loading: lane.loading.value,
      hasMore: lane.hasMore.value
    };
  })
);
const wishLegendGroups = wishBoardDefinitions.map(({ laneKey, title, legend }) => ({
  laneKey,
  title,
  legend
}));
const isWishPageReady = computed(() => wishBoardLoaded.value);
const wishPageError = computed(() => wishBoardError.value);
const wishLaneKeys: WishLaneKey[] = ['wantToGo', 'wantToDo', 'done'];
const underfilledListTolerance = 4;
const selectedWishTimeLabel = computed(() =>
  selectedWish.value?.lane === 'done' ? '完成时间' : '预计完成时间'
);
const selectedWishTimeValue = computed(() =>
  selectedWish.value?.lane === 'done'
    ? selectedWish.value.completedAt
    : selectedWish.value?.expectedCompletedAt
);
const wishActionMessage = computed(
  () => completionImageError.value || wishActionError.value
);
const isCreateWishInteractionLocked = computed(
  () => isCreatingWish.value || isCreateWishClosing.value
);

function openCreateWish(category: WishCategory = 'want_go') {
  if (
    createWishDialogOpen.value ||
    createWishClosePromise ||
    isCreateWishInteractionLocked.value
  ) {
    return;
  }

  createWishCategory.value = category;
  createWishDialogOpen.value = true;
  wishLifecycle.clearCreateError();
  createWishForm.value = {
    title: '',
    description: '',
    locationName: '',
    expectedCompletedAt: '',
    note: ''
  };
  void nextTick(() => animateCreateWishOpen());
}

function setCreateWishCategory(category: WishCategory) {
  createWishCategory.value = category;
}

function updateCreateWishExpectedCompletedAt(value: string | null) {
  createWishForm.value.expectedCompletedAt = value ?? '';
}

function closeCreateWish(): Promise<void> {
  if (createWishClosePromise) {
    return createWishClosePromise;
  }
  if (isCreateWishInteractionLocked.value) {
    return Promise.resolve();
  }

  if (!createWishDialogOpen.value) {
    wishLifecycle.clearCreateError();
    return Promise.resolve();
  }

  wishLifecycle.clearCreateError();
  isCreateWishClosing.value = true;
  const closeOperation = (async () => {
    try {
      await animateCreateWishClose();
    } finally {
      createWishDialogOpen.value = false;
    }
  })();
  const trackedOperation = closeOperation.finally(() => {
    if (createWishClosePromise === trackedOperation) {
      createWishClosePromise = null;
    }
    isCreateWishClosing.value = false;
  });
  createWishClosePromise = trackedOperation;
  return trackedOperation;
}

async function submitCreateWish() {
  if (
    !createWishDialogOpen.value ||
    isCreateWishInteractionLocked.value ||
    createWishClosePromise
  ) {
    return;
  }

  const created = await wishLifecycle.createWish({
    title: createWishForm.value.title,
    category: createWishCategory.value,
    description: createWishForm.value.description,
    locationName: createWishForm.value.locationName,
    expectedCompletedAt: createWishForm.value.expectedCompletedAt || null,
    note: createWishForm.value.note
  });

  if (created) {
    await closeCreateWish();
    await ensureWishLaneHasScrollableContent(created.lane);
  }
}

function handleWishLaneScroll(group: WishBoardGroup, event: Event) {
  const target = event.currentTarget as HTMLElement | null;
  if (!target || !group.hasMore || group.loading) {
    return;
  }

  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
  if (distanceToBottom <= 48) {
    void wishLifecycle.loadNextPage(group.laneKey);
  }
}

function getWishLaneListElement(lane: WishLaneKey) {
  return wishPageRef.value?.querySelector<HTMLElement>(
    `.wish-lane-list[data-wish-lane="${lane}"]`
  ) ?? null;
}

function isWishLaneUnderfilled(list: HTMLElement) {
  return list.clientHeight > 0 && list.scrollHeight <= list.clientHeight + underfilledListTolerance;
}

async function ensureWishLaneHasScrollableContent(laneKey: WishLaneKey) {
  const lane = wishLifecycle.state.lanes[laneKey];
  let consecutiveNonAdvancingLoads = 0;
  while (true) {
    await nextTick();
    const list = getWishLaneListElement(laneKey);
    if (
      !list ||
      !lane.loaded.value ||
      !lane.hasMore.value ||
      !isWishLaneUnderfilled(list)
    ) {
      return;
    }

    const previousPage = lane.page.value;
    const loadedPage = await wishLifecycle.loadNextPage(laneKey);
    if (!loadedPage) {
      return;
    }
    if (lane.page.value <= previousPage) {
      consecutiveNonAdvancingLoads += 1;
      if (consecutiveNonAdvancingLoads > 1) {
        return;
      }
      continue;
    }
    consecutiveNonAdvancingLoads = 0;
  }
}

function ensureUnderfilledWishLanesCanLoadMore() {
  wishLaneKeys.forEach((laneKey) => {
    void ensureWishLaneHasScrollableContent(laneKey);
  });
}

async function openWishDetail(wish: WishItem) {
  if (isWishDetailAnimating.value || isCompletionAnimating.value) {
    return;
  }

  completionImageError.value = '';
  wishLifecycle.clearActionError();
  const detail = await wishLifecycle.selectWish(wish.id);
  if (!detail) {
    return;
  }

  isWishDetailDialogVisible.value = true;
  isImagePreviewOpen.value = false;
  await nextTick();
  await animateWishDetailOpen();
  ensureUnderfilledWishLanesCanLoadMore();
}

function closeWishDetail(): Promise<void> {
  if (wishDetailClosePromise) {
    return wishDetailClosePromise;
  }

  if (!selectedWish.value || !isWishDetailDialogVisible.value) {
    return Promise.resolve();
  }

  const closeOperation = (async () => {
    if (isImagePreviewOpen.value) {
      await closeImagePreview();
    }

    isWishDetailAnimating.value = true;
    try {
      await animateWishDetailClose();
    } finally {
      isWishDetailAnimating.value = false;
      isWishDetailDialogVisible.value = false;
      isImagePreviewOpen.value = false;
      completionImageError.value = '';
      wishLifecycle.clearSelectedWish();
    }
  })();
  const trackedOperation = closeOperation.finally(() => {
    if (wishDetailClosePromise === trackedOperation) {
      wishDetailClosePromise = null;
    }
  });
  wishDetailClosePromise = trackedOperation;
  return trackedOperation;
}

async function openImagePreview() {
  if (!selectedWish.value || isImagePreviewOpen.value || isImagePreviewAnimating.value) {
    return;
  }

  const sourceRect = wishDetailImageRef.value?.getBoundingClientRect() ?? null;
  isImagePreviewOpen.value = true;
  await nextTick();
  await animateImagePreviewOpen(sourceRect);
}

function closeImagePreview(): Promise<void> {
  if (imagePreviewClosePromise) {
    return imagePreviewClosePromise;
  }

  if (!isImagePreviewOpen.value) {
    return Promise.resolve();
  }

  const closeOperation = (async () => {
    try {
      await animateImagePreviewClose();
    } finally {
      isImagePreviewOpen.value = false;
    }
  })();
  const trackedOperation = closeOperation.finally(() => {
    if (imagePreviewClosePromise === trackedOperation) {
      imagePreviewClosePromise = null;
    }
  });
  imagePreviewClosePromise = trackedOperation;
  return trackedOperation;
}

async function requestWishCompletionImage() {
  const wish = selectedWish.value;

  if (!wish || wish.lane === 'done' || isCompletionAnimating.value) {
    return;
  }

  completionImageError.value = '';
  wishLifecycle.clearActionError();
  completionUploadHostRef.value?.querySelector<HTMLInputElement>('input[data-wish-complete-image]')?.click();
}

async function handleCompletionImageSelected(options: { fileList: UploadFileInfo[] }) {
  const image = options.fileList.at(-1)?.file ?? null;
  completionImageFileList.value = [];

  if (!image) {
    completionImageError.value = '请先选择一张完成图片';
    return;
  }
  await completeSelectedWishWithImage(image);
}

async function completeSelectedWishWithImage(image: File) {
  const wish = selectedWish.value;

  if (!wish || wish.lane === 'done' || isCompletionAnimating.value) {
    return;
  }

  isCompletionAnimating.value = true;
  completionImageError.value = '';
  wishLifecycle.clearActionError();

  try {
    await animateCompletionStamp(completionBadgeRef.value);
    const transition = await wishLifecycle.completeWish(wish.id, image);
    if (!transition) {
      return;
    }
    await closeWishDetail();
    await animateWishLaneTransition(transition);
    ensureUnderfilledWishLanesCanLoadMore();
  } finally {
    isCompletionAnimating.value = false;
  }
}

async function reopenSelectedWish() {
  const wish = selectedWish.value;

  if (!wish || wish.lane !== 'done' || isCompletionAnimating.value) {
    return;
  }

  isCompletionAnimating.value = true;
  completionImageError.value = '';
  wishLifecycle.clearActionError();

  try {
    const transition = await wishLifecycle.reopenWish(wish.id);
    if (!transition) {
      return;
    }
    await closeWishDetail();
    await animateWishLaneTransition(transition);
    ensureUnderfilledWishLanesCanLoadMore();
  } finally {
    isCompletionAnimating.value = false;
  }
}

function handleWishDetailKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }

  if (isImagePreviewOpen.value) {
    void closeImagePreview();
    return;
  }

  if (selectedWish.value) {
    void closeWishDetail();
  }
}

function animateWishBoardEnter() {
  if (hasPlayedWishBoardEnter) {
    return;
  }

  wishBoardEnterCleanup?.();
  wishBoardEnterCleanup = undefined;

  if (!wishPageRef.value) {
    return;
  }

  const hasRenderedList = wishPageRef.value.querySelector('.wish-board');
  if (!hasRenderedList) {
    return;
  }

  hasPlayedWishBoardEnter = true;

  const ctx = gsap.context(() => {
    const find = gsap.utils.selector(wishPageRef.value);
    const heroSheet = find('.list-hero__sheet');
    const heroBanner = find('.list-hero__banner');
    const heroCopy = find('.list-hero__label, .list-hero__title, .list-hero__subtitle');
    const noteCard = find('.list-note-card');
    const noteAsset = find('.list-note-card__asset');
    const noteLines = find('.list-note-card__title, .list-note-card__copy p:last-child');
    const boards = find('.wish-board');
    const boardAssets = find('.wish-board__asset');
    const boardContents = find('.wish-board__content');
    const rows = find('.wish-lane-item');
    const legendItems = find('.list-legend span');
    const createEntry = find('.wish-create-fab');
    const animatedTargets = [
      heroSheet,
      heroBanner,
      heroCopy,
      noteCard,
      noteAsset,
      noteLines,
      boards,
      boardAssets,
      boardContents,
      rows,
      legendItems,
      createEntry
    ].flat();

    if (shouldReduceMotion) {
      gsap.set(animatedTargets, { clearProps: 'all' });
      return;
    }

    const timeline = gsap.timeline({
      defaults: {
        ease: 'power3.out',
        overwrite: 'auto'
      },
      onComplete: () => {
        gsap.set(animatedTargets, { clearProps: 'transform,opacity,visibility' });
        gsap.set(animatedTargets, { clearProps: 'willChange' });
      }
    });

    timeline
      .from(
        heroSheet,
        {
          autoAlpha: 0,
          y: 18,
          scale: 0.985,
          rotate: -0.8,
          duration: 0.5,
          willChange: 'transform, opacity'
        },
        0
      )
      .from(
        heroBanner,
        {
          autoAlpha: 0,
          scale: 1.018,
          duration: 0.42,
          willChange: 'transform, opacity'
        },
        0.04
      )
      .from(
        heroCopy,
        {
          autoAlpha: 0,
          y: 12,
          duration: 0.34,
          stagger: 0.055,
          willChange: 'transform, opacity'
        },
        0.14
      )
      .from(
        noteCard,
        {
          autoAlpha: 0,
          y: 22,
          scale: 0.96,
          rotate: 2.4,
          duration: 0.5,
          ease: 'back.out(1.22)',
          willChange: 'transform, opacity'
        },
        0.18
      )
      .from(
        noteAsset,
        {
          autoAlpha: 0,
          scale: 0.94,
          rotate: -2,
          duration: 0.42,
          willChange: 'transform, opacity'
        },
        '<0.08'
      )
      .from(
        noteLines,
        {
          autoAlpha: 0,
          y: 8,
          duration: 0.28,
          stagger: 0.05,
          willChange: 'transform, opacity'
        },
        '<0.08'
      )
      .from(
        boards,
        {
          autoAlpha: 0,
          y: 34,
          scale: 0.94,
          rotate: (index) => [-2.1, 1.6, -1.1][index % 3],
          duration: 0.56,
          stagger: 0.1,
          ease: 'back.out(1.45)',
          willChange: 'transform, opacity'
        },
        0.14
      )
      .from(
        boardAssets,
        {
          autoAlpha: 0,
          y: 14,
          scale: 0.975,
          rotate: (index) => [-0.8, 0.6, -0.4][index % 3],
          duration: 0.44,
          stagger: 0.08,
          willChange: 'transform, opacity'
        },
        0.24
      )
      .from(
        boardContents,
        {
          autoAlpha: 0,
          y: 12,
          scale: 0.985,
          duration: 0.34,
          stagger: 0.075,
          willChange: 'transform, opacity'
        },
        0.34
      )
      .from(
        rows,
        {
          autoAlpha: 0,
          y: 10,
          scale: 0.98,
          duration: 0.22,
          stagger: {
            amount: 0.22,
            from: 'start'
          },
          ease: 'power2.out'
        },
        0.44
      )
      .from(
        legendItems,
        {
          autoAlpha: 0,
          y: 8,
          duration: 0.24,
          stagger: 0.035,
          willChange: 'transform, opacity'
        },
        0.52
      );

    if (createEntry.length > 0) {
      timeline.from(
        createEntry,
        {
          autoAlpha: 0,
          y: 26,
          scale: 0.84,
          rotate: -8,
          duration: 0.44,
          ease: 'back.out(1.45)',
          clearProps: 'transform,opacity,visibility',
          willChange: 'transform, opacity'
        },
        0.62
      );
    }
  }, wishPageRef.value);

  wishBoardEnterCleanup = () => ctx.revert();
}

function getWishLaneItem(wishId: number) {
  return wishPageRef.value?.querySelector<HTMLElement>(`[data-wish-id="${wishId}"]`) ?? null;
}

function getWishLaneItems(laneKey: WishLaneKey) {
  const list = getWishLaneListElement(laneKey);

  return Array.from(list?.querySelectorAll<HTMLElement>('[data-wish-id]') ?? []);
}

function getWishIdFromItem(item: HTMLElement) {
  const id = Number(item.dataset.wishId);

  return Number.isFinite(id) ? id : null;
}

function snapshotRows(rows: HTMLElement[]) {
  const snapshots = new Map<number, DOMRect>();

  rows.forEach((row) => {
    const id = getWishIdFromItem(row);

    if (id !== null) {
      snapshots.set(id, row.getBoundingClientRect());
    }
  });

  return snapshots;
}

function setRowsFromSnapshots(rows: HTMLElement[], snapshots: Map<number, DOMRect>) {
  return rows.filter((row) => {
    const id = getWishIdFromItem(row);
    const previousRect = id === null ? undefined : snapshots.get(id);

    if (!previousRect) {
      return false;
    }

    const currentRect = row.getBoundingClientRect();
    const offsetY = previousRect.top - currentRect.top;

    if (Math.abs(offsetY) > 0.5) {
      prepareWishLaneMoveStyles([row]);
      gsap.set(row, { y: offsetY });
    }

    return true;
  });
}

function getWishLaneItemTilt(row: HTMLElement) {
  const tilt = Number.parseFloat(
    getComputedStyle(row).getPropertyValue('--wish-lane-item-tilt') || '-0.12'
  );

  return Number.isFinite(tilt) ? tilt : -0.12;
}

function prepareWishLaneMoveStyles(rows: HTMLElement[]) {
  if (rows.length === 0) {
    return;
  }

  rows.forEach((row) => {
    gsap.set(row, {
      transition: 'none',
      willChange: 'transform, opacity',
      rotation: getWishLaneItemTilt(row),
      force3D: true
    });
  });
}

function clearWishLaneMoveStyles(rows: HTMLElement[]) {
  if (rows.length === 0) {
    return;
  }

  gsap.set(rows, { clearProps: 'transform,opacity,visibility' });
  scheduleWishLaneTransitionRestore(rows);
}

function scheduleWishLaneTransitionRestore(rows: HTMLElement[]) {
  const paintFrame = requestAnimationFrame(() => {
    wishLaneMoveCleanupFrames = wishLaneMoveCleanupFrames.filter((frameId) => frameId !== paintFrame);

    const restoreFrame = requestAnimationFrame(() => {
      wishLaneMoveCleanupFrames = wishLaneMoveCleanupFrames.filter((frameId) => frameId !== restoreFrame);
      gsap.set(rows, { clearProps: 'transition,willChange' });
    });

    wishLaneMoveCleanupFrames.push(restoreFrame);
  });

  wishLaneMoveCleanupFrames.push(paintFrame);
}

function scheduleWishLaneMoveGhostRemoval(onRemoved?: () => void) {
  const paintFrame = requestAnimationFrame(() => {
    wishLaneMoveCleanupFrames = wishLaneMoveCleanupFrames.filter((frameId) => frameId !== paintFrame);
    removeWishLaneMoveGhost();
    onRemoved?.();
  });

  wishLaneMoveCleanupFrames.push(paintFrame);
}

function removeWishLaneMoveGhost() {
  if (!wishLaneMoveGhost) {
    return;
  }

  gsap.killTweensOf(wishLaneMoveGhost);
  wishLaneMoveGhost.remove();
  wishLaneMoveGhost = null;
}

function createWishLaneMoveGhost(sourceRow: HTMLElement) {
  const sourceRect = sourceRow.getBoundingClientRect();
  const ghost = sourceRow.cloneNode(true) as HTMLElement;

  removeWishLaneMoveGhost();
  ghost.classList.add('wish-lane-move-ghost');
  ghost.removeAttribute('data-wish-id');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.tabIndex = -1;
  Object.assign(ghost.style, {
    left: `${sourceRect.left}px`,
    top: `${sourceRect.top}px`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`
  });

  wishPageRef.value?.appendChild(ghost);
  wishLaneMoveGhost = ghost;

  gsap.set(ghost, {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    autoAlpha: 1,
    transition: 'none',
    willChange: 'transform, opacity',
    rotation: getWishLaneItemTilt(sourceRow),
    transformOrigin: '50% 50%',
    force3D: true
  });

  return { ghost, sourceRect };
}

function animateWishDetailOpen() {
  const backdrop = wishDetailBackdropRef.value;
  const dialog = wishDetailDialogRef.value;

  if (!backdrop || !dialog) {
    return Promise.resolve();
  }

  wishDetailTimeline?.kill();

  if (shouldReduceMotion) {
    gsap.set(backdrop, { autoAlpha: 1, clearProps: 'transform' });
    gsap.set(dialog, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0 });
    return Promise.resolve();
  }

  isWishDetailAnimating.value = true;

  return new Promise<void>((resolve) => {
    const finish = () => {
      isWishDetailAnimating.value = false;
      resolve();
    };
    wishDetailTimeline = gsap
      .timeline({
        onComplete: finish,
        onInterrupt: finish
      })
      .set(backdrop, { autoAlpha: 0 })
      .set(dialog, { autoAlpha: 0, y: 20, scale: 0.94, rotate: -0.7, transformOrigin: '50% 56%' })
      .to(backdrop, { autoAlpha: 1, duration: 0.24, ease: 'power2.out' }, 0)
      .to(dialog, { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.32, ease: 'back.out(1.55)' }, 0.02);
  });
}

function animateWishDetailClose() {
  const backdrop = wishDetailBackdropRef.value;
  const dialog = wishDetailDialogRef.value;

  if (!backdrop || !dialog || shouldReduceMotion) {
    return Promise.resolve();
  }

  wishDetailTimeline?.kill();

  return new Promise<void>((resolve) => {
    wishDetailTimeline = gsap
      .timeline({ onComplete: resolve, onInterrupt: resolve })
      .to(dialog, { autoAlpha: 0, y: 16, scale: 0.96, rotate: 0.4, duration: 0.26, ease: 'power2.inOut' }, 0)
      .to(backdrop, { autoAlpha: 0, duration: 0.26, ease: 'power2.inOut' }, 0);
  });
}

function animateCreateWishOpen() {
  const backdrop = createWishBackdropRef.value;
  const dialog = createWishDialogRef.value;

  if (!backdrop || !dialog) {
    return Promise.resolve();
  }

  const background = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__background'));
  const content = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__content'));
  const fields = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-field'));
  const categoryButtons = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__category button'));
  const divider = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__divider'));
  const actions = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__actions button'));
  const animatedTargets = [dialog, ...background, ...content, ...fields, ...categoryButtons, ...divider, ...actions];
  createWishTimeline?.kill();

  if (shouldReduceMotion) {
    gsap.set(backdrop, { autoAlpha: 1, clearProps: 'transform' });
    gsap.set(dialog, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0 });
    gsap.set(fields, { autoAlpha: 1, y: 0 });
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const finish = () => {
      gsap.set([backdrop, dialog], { clearProps: 'willChange' });
      gsap.set(animatedTargets, { clearProps: 'willChange' });
      resolve();
    };
    createWishTimeline = gsap
      .timeline({
        defaults: { ease: 'power2.out' },
        onComplete: finish,
        onInterrupt: finish
      })
      .set(backdrop, { autoAlpha: 0 })
      .set(dialog, {
        autoAlpha: 0,
        y: 28,
        scale: 0.965,
        rotate: -0.45,
        transformOrigin: '50% 46%',
        willChange: 'transform, opacity'
      })
      .set(background, { autoAlpha: 0, scale: 1.016, willChange: 'transform, opacity' })
      .set(content, { autoAlpha: 0, y: 12, willChange: 'transform, opacity' })
      .set(fields, { autoAlpha: 0, y: 10, willChange: 'transform, opacity' })
      .set(categoryButtons, { autoAlpha: 0, y: 6, scale: 0.96, willChange: 'transform, opacity' })
      .set(divider, { autoAlpha: 0, scaleY: 0.72, transformOrigin: 'center center', willChange: 'transform, opacity' })
      .set(actions, { autoAlpha: 0, y: 12, scale: 0.98, willChange: 'transform, opacity' })
      .to(backdrop, { autoAlpha: 1, duration: 0.22, ease: 'power2.out' }, 0)
      .to(dialog, { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.42, ease: 'back.out(1.25)' }, 0.02)
      .to(background, { autoAlpha: 1, scale: 1, duration: 0.34, ease: 'power2.out' }, 0.08)
      .to(content, { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power3.out' }, 0.13)
      .to(divider, { autoAlpha: 1, scaleY: 1, duration: 0.24, ease: 'power2.out' }, 0.18)
      .to(fields, { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.035, ease: 'power2.out' }, 0.19)
      .to(
        categoryButtons,
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, stagger: { each: 0.03, from: 'start' }, ease: 'back.out(1.35)' },
        0.21
      )
      .to(
        actions,
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.25, stagger: { each: 0.03, from: 'start' }, ease: 'power2.out' },
        0.34
      );
  });
}

function animateCreateWishClose() {
  const backdrop = createWishBackdropRef.value;
  const dialog = createWishDialogRef.value;

  if (!backdrop || !dialog || shouldReduceMotion) {
    return Promise.resolve();
  }

  createWishTimeline?.kill();
  const closingItems = Array.from(
    dialog.querySelectorAll<HTMLElement>('.wish-create-field, .wish-create-dialog__category button, .wish-create-dialog__actions button')
  );

  return new Promise<void>((resolve) => {
    const finish = () => {
      gsap.set([backdrop, dialog, ...closingItems], { clearProps: 'transform,opacity,visibility' });
      gsap.set([backdrop, dialog, ...closingItems], { clearProps: 'willChange' });
      resolve();
    };
    createWishTimeline = gsap
      .timeline({
        onComplete: finish,
        onInterrupt: finish
      })
      .set(dialog, { willChange: 'transform, opacity' })
      .to(
        closingItems,
        { autoAlpha: 0, y: -6, duration: 0.14, stagger: { each: 0.012, from: 'end' }, ease: 'power1.in' },
        0
      )
      .to(dialog, { autoAlpha: 0, y: -14, scale: 0.982, rotate: 0.35, duration: 0.22, ease: 'power2.inOut' }, 0.04)
      .to(backdrop, { autoAlpha: 0, duration: 0.22, ease: 'power2.inOut' }, 0);
  });
}

function animateImagePreviewOpen(sourceRect: DOMRect | null) {
  const preview = imagePreviewRef.value;
  const image = imagePreviewImageRef.value;

  if (!preview || !image) {
    return Promise.resolve();
  }

  imagePreviewTimeline?.kill();

  if (shouldReduceMotion) {
    gsap.set(preview, { autoAlpha: 1 });
    gsap.set(image, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
    return Promise.resolve();
  }

  const targetRect = image.getBoundingClientRect();
  const hasSourceRect = Boolean(sourceRect && targetRect.width > 0 && targetRect.height > 0);
  const sourceLeft = sourceRect?.left ?? targetRect.left;
  const sourceTop = sourceRect?.top ?? targetRect.top;
  const sourceWidth = sourceRect?.width ?? targetRect.width;
  const sourceHeight = sourceRect?.height ?? targetRect.height;

  isImagePreviewAnimating.value = true;

  return new Promise<void>((resolve) => {
    const finish = () => {
      isImagePreviewAnimating.value = false;
      resolve();
    };
    imagePreviewTimeline = gsap
      .timeline({
        onComplete: finish,
        onInterrupt: finish
      })
      .set(preview, { autoAlpha: 0 })
      .set(image, {
        autoAlpha: hasSourceRect ? 0.92 : 0,
        x: hasSourceRect ? sourceLeft - targetRect.left : 0,
        y: hasSourceRect ? sourceTop - targetRect.top : 10,
        scaleX: hasSourceRect ? sourceWidth / targetRect.width : 0.94,
        scaleY: hasSourceRect ? sourceHeight / targetRect.height : 0.94,
        transformOrigin: 'top left'
      })
      .to(preview, { autoAlpha: 1, duration: 0.2, ease: 'power2.out' }, 0)
      .to(image, { autoAlpha: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.42, ease: 'power3.out' }, 0.03);
  });
}

function animateImagePreviewClose() {
  const preview = imagePreviewRef.value;
  const image = imagePreviewImageRef.value;

  if (!preview || !image || shouldReduceMotion) {
    return Promise.resolve();
  }

  imagePreviewTimeline?.kill();
  const sourceRect = wishDetailImageRef.value?.getBoundingClientRect() ?? null;
  const targetRect = image.getBoundingClientRect();
  const hasSourceRect = Boolean(sourceRect && targetRect.width > 0 && targetRect.height > 0);
  const sourceLeft = sourceRect?.left ?? targetRect.left;
  const sourceTop = sourceRect?.top ?? targetRect.top;
  const sourceWidth = sourceRect?.width ?? targetRect.width;
  const sourceHeight = sourceRect?.height ?? targetRect.height;

  isImagePreviewAnimating.value = true;

  return new Promise<void>((resolve) => {
    const finish = () => {
      isImagePreviewAnimating.value = false;
      resolve();
    };
    imagePreviewTimeline = gsap
      .timeline({
        onComplete: finish,
        onInterrupt: finish
      })
      .to(
        image,
        {
          autoAlpha: 0.35,
          x: hasSourceRect ? sourceLeft - targetRect.left : 0,
          y: hasSourceRect ? sourceTop - targetRect.top : 10,
          scaleX: hasSourceRect ? sourceWidth / targetRect.width : 0.96,
          scaleY: hasSourceRect ? sourceHeight / targetRect.height : 0.96,
          duration: 0.28,
          ease: 'power2.inOut'
        },
        0
      )
      .to(preview, { autoAlpha: 0, duration: 0.24, ease: 'power2.inOut' }, 0.04);
  });
}

function animateCompletionStamp(badge: HTMLElement | null) {
  if (!badge || shouldReduceMotion) {
    return Promise.resolve();
  }

  const host = badge.parentElement;
  if (!host) {
    return Promise.resolve();
  }

  const wave = document.createElement('span');
  wave.className = 'wish-completion-wave';
  host.appendChild(wave);

  const particles = Array.from({ length: 12 }, (_, index) => {
    const particle = document.createElement('span');
    particle.className = 'wish-completion-particle';
    particle.style.setProperty('--particle-hue', index % 2 === 0 ? 'var(--list-gold)' : 'var(--list-red)');
    host.appendChild(particle);
    return particle;
  });

  return new Promise<void>((resolve) => {
    const timeline = gsap.timeline({
      onComplete: () => {
        wave.remove();
        particles.forEach((particle) => particle.remove());
        resolve();
      }
    });

    timeline
      .to(badge, { y: 9, scale: 0.82, rotate: -10, duration: 0.08, ease: 'power2.in' }, 0)
      .to(badge, { y: -6, scale: 1.18, rotate: -4, duration: 0.16, ease: 'back.out(2.4)' }, 0.08)
      .to(badge, { y: 0, scale: 1, rotate: -7, duration: 0.22, ease: 'elastic.out(1, 0.46)' }, 0.24)
      .fromTo(
        wave,
        { autoAlpha: 0.58, scale: 0.42 },
        { autoAlpha: 0, scale: 1.75, duration: 0.42, ease: 'power2.out' },
        0.12
      )
      .to(wishDetailDialogRef.value, { x: 3, duration: 0.04, yoyo: true, repeat: 3, ease: 'power1.inOut' }, 0.12);

    particles.forEach((particle, index) => {
      const angle = (Math.PI * 2 * index) / particles.length - Math.PI / 2;
      const distance = 28 + (index % 4) * 8;
      timeline.fromTo(
        particle,
        { autoAlpha: 1, x: 0, y: 0, scale: 0.4, rotate: 0 },
        {
          autoAlpha: 0,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          scale: 1,
          rotate: index % 2 === 0 ? 120 : -120,
          duration: 0.48,
          ease: 'power2.out'
        },
        0.14 + index * 0.008
      );
    });
  });
}

async function animateWishLaneTransition(transition: WishLaneTransition) {
  const sourceLane = wishLifecycle.state.lanes[transition.fromLane].items.value;
  const sourceIndex = sourceLane.findIndex((wish) => wish.id === transition.wishId);
  if (sourceIndex < 0) {
    wishLifecycle.commitLaneTransition(transition);
    await nextTick();
    return;
  }

  if (transition.fromLane === transition.toLane) {
    wishLifecycle.commitLaneTransition(transition);
    await nextTick();
    return;
  }

  if (shouldReduceMotion) {
    wishLifecycle.commitLaneTransition(transition);
    await nextTick();
    return;
  }

  const sourceRows = getWishLaneItems(transition.fromLane);
  const targetRows = getWishLaneItems(transition.toLane);
  const sourceRow = getWishLaneItem(transition.wishId);
  const sourceFollowerSnapshots = snapshotRows(sourceRows.slice(sourceIndex + 1));
  const targetSnapshots = snapshotRows(targetRows);

  wishLaneMoveTimeline?.kill();
  const ghostMove = sourceRow ? createWishLaneMoveGhost(sourceRow) : null;

  if (sourceRow) {
    sourceRow.style.visibility = 'hidden';
  }

  const didMove = wishLifecycle.commitLaneTransition(transition);

  if (!didMove) {
    if (sourceRow) {
      sourceRow.style.visibility = '';
    }

    removeWishLaneMoveGhost();
    return;
  }

  await nextTick();

  const updatedSourceRows = setRowsFromSnapshots(
    getWishLaneItems(transition.fromLane),
    sourceFollowerSnapshots
  );
  const updatedTargetRows = getWishLaneItems(transition.toLane);
  const shiftedTargetRows = setRowsFromSnapshots(
    updatedTargetRows.filter(
      (row) => getWishIdFromItem(row) !== transition.wishId
    ),
    targetSnapshots
  );
  const movedRow = getWishLaneItem(transition.wishId);
  const targetRect = movedRow?.getBoundingClientRect() ?? null;
  const animatedRows = [...updatedSourceRows, ...shiftedTargetRows];

  if (movedRow) {
    movedRow.style.visibility = 'hidden';
  }

  prepareWishLaneMoveStyles(animatedRows);

  await new Promise<void>((resolve) => {
    const revealMovedRow = () => {
      if (movedRow) {
        movedRow.style.visibility = '';
      }
    };

    wishLaneMoveTimeline = gsap.timeline({
      defaults: wishLaneMoveTweenDefaults,
      onComplete: () => {
        revealMovedRow();
        clearWishLaneMoveStyles(animatedRows);
        scheduleWishLaneMoveGhostRemoval(resolve);
      }
    });

    const rowsToSettle = [...updatedSourceRows, ...shiftedTargetRows];
    let hasTween = false;

    if (rowsToSettle.length > 0) {
      hasTween = true;
      wishLaneMoveTimeline.to(
        rowsToSettle,
        {
          y: 0,
          duration: 0.32,
          ease: 'power1.in'
        },
        0
      );
    }

    if (ghostMove && targetRect) {
      const { ghost, sourceRect } = ghostMove;

      hasTween = true;
      wishLaneMoveTimeline.to(
        ghost,
        {
          x: targetRect.left - sourceRect.left,
          y: targetRect.top - sourceRect.top,
          scaleX: targetRect.width / sourceRect.width,
          scaleY: targetRect.height / sourceRect.height,
          duration: 0.46,
          ease: 'power1.in'
        },
        0
      );
    }

    if (!hasTween) {
      revealMovedRow();
      removeWishLaneMoveGhost();
      resolve();
    }
  });
}

watch(
  wishBoardLoaded,
  (hasLoadedWishBoard) => {
    if (hasLoadedWishBoard) {
      nextTick(() => {
        animateWishBoardEnter();
        ensureUnderfilledWishLanesCanLoadMore();
      });
    }
  },
  { immediate: true }
);

onMounted(() => {
  void wishLifecycle.loadInitial();
  window.addEventListener('keydown', handleWishDetailKeydown);
});

onBeforeUnmount(() => {
  wishLaneMoveCleanupFrames.forEach((frame) => cancelAnimationFrame(frame));
  wishLaneMoveCleanupFrames = [];
  wishBoardEnterCleanup?.();
  wishDetailTimeline?.kill();
  createWishTimeline?.kill();
  imagePreviewTimeline?.kill();
  wishLaneMoveTimeline?.kill();
  removeWishLaneMoveGhost();
  gsap.killTweensOf('.list-hero__sheet');
  gsap.killTweensOf('.list-hero__banner');
  gsap.killTweensOf('.list-hero__label');
  gsap.killTweensOf('.list-hero__title');
  gsap.killTweensOf('.list-hero__subtitle');
  gsap.killTweensOf('.list-note-card');
  gsap.killTweensOf('.list-note-card__asset');
  gsap.killTweensOf('.list-note-card__copy');
  gsap.killTweensOf('.wish-board');
  gsap.killTweensOf('.wish-board__asset');
  gsap.killTweensOf('.wish-board__content');
  gsap.killTweensOf('.wish-lane-item');
  gsap.killTweensOf('.list-legend span');
  gsap.killTweensOf('.wish-create-fab');
  gsap.killTweensOf(wishDetailDialogRef.value);
  gsap.killTweensOf(wishDetailBackdropRef.value);
  gsap.killTweensOf(createWishDialogRef.value);
  gsap.killTweensOf(createWishBackdropRef.value);
  gsap.killTweensOf(imagePreviewRef.value);
  gsap.killTweensOf(imagePreviewImageRef.value);
  gsap.killTweensOf(completionBadgeRef.value);
  window.removeEventListener('keydown', handleWishDetailKeydown);
});
</script>

<template>
  <main ref="wishPageRef" class="list-page" :data-wish-gsap="wishGsapMotionAttr">
    <section class="list-hero" aria-labelledby="wish-page-title">
      <div class="list-hero__sheet">
        <img class="list-hero__banner" :src="heroListBanner" alt="" aria-hidden="true" />
        <div class="list-hero__copy">
          <p class="list-hero__label">COUPLE LIST</p>
          <h1 id="wish-page-title" class="list-hero__title">
            我们的<span class="list-hero__title-accent">共同</span>清单
          </h1>
          <p class="list-hero__subtitle">每一个小心愿，都是我们一起走过的日常。</p>
        </div>
      </div>

      <aside class="list-note-card" aria-label="一起的小约定">
        <img class="list-note-card__asset" :src="noteCardCorner" alt="" aria-hidden="true" />
        <div class="list-note-card__copy">
          <p class="list-note-card__title">一起的小约定</p>
          <p>用心收藏每一刻。未来的我们，一定会感谢现在一起努力的自己。</p>
        </div>
      </aside>
    </section>

    <section v-if="isWishPageReady" class="list-main" aria-label="共同清单分组">
      <div v-if="wishPageError || (wishActionError && !isWishDetailDialogVisible)" class="wish-page-alerts">
        <NAlert v-if="wishPageError" type="error" :show-icon="false" role="alert">
          {{ wishPageError }}
        </NAlert>
        <NAlert
          v-if="wishActionError && !isWishDetailDialogVisible"
          type="error"
          :show-icon="false"
          role="alert"
        >
          {{ wishActionError }}
        </NAlert>
      </div>

      <div class="wish-board-grid">
        <article
          v-for="group in wishBoardGroups"
          :key="group.laneKey"
          class="wish-board"
          :data-group="group.laneKey"
          :aria-label="group.title"
        >
          <img class="wish-board__asset" :src="group.boardImage" alt="" aria-hidden="true" />
          <div class="wish-board__content">
            <ul
              class="wish-lane-list"
              :data-wish-lane="group.laneKey"
              :aria-label="`${group.title}清单`"
              @scroll="handleWishLaneScroll(group, $event)"
            >
              <li v-for="item in group.items" :key="item.id" class="wish-lane-entry">
                <button class="wish-lane-item" type="button" :data-wish-id="item.id" @click="openWishDetail(item)">
                  <span class="wish-lane-item__title" :title="item.title">{{ item.title }}</span>
                </button>
              </li>
            </ul>
          </div>
        </article>
      </div>

      <footer class="list-legend" aria-label="清单图例">
        <span v-for="legend in wishLegendGroups" :key="legend.laneKey" :data-group="legend.laneKey">
          {{ legend.legend }}
        </span>
      </footer>
    </section>

    <PageLoader :loading="!isWishPageReady" />

    <button v-if="canManageWishes" class="wish-create-fab" data-wish-create-open type="button" aria-label="新增清单" @click="openCreateWish()">
      <img class="wish-create-fab__image" :src="wishCreateEntry" alt="" draggable="false" />
      <span class="visually-hidden">新增清单</span>
    </button>

    <Teleport to="body">
      <div
        v-if="isWishDetailDialogVisible && selectedWish"
        ref="wishDetailBackdropRef"
        class="wish-dialog-backdrop"
        @click.self="closeWishDetail()"
      >
        <section
          ref="wishDetailDialogRef"
          class="wish-detail-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`wish-detail-title-${selectedWish.id}`"
          :data-wish-lane="selectedWish.lane"
        >
          <div class="wish-detail-dialog__image-panel">
            <button class="wish-detail-dialog__image-button" type="button" aria-label="查看完整图片" @click.stop="openImagePreview">
              <img ref="wishDetailImageRef" class="wish-detail-dialog__image" :src="selectedWish.imageUrl" :alt="selectedWish.title" />
            </button>
          </div>

          <div class="wish-detail-dialog__info">
            <button class="wish-detail-dialog__close" type="button" aria-label="关闭详情弹窗" @click="closeWishDetail()">×</button>

            <div class="wish-detail-dialog__body">
              <h2 :id="`wish-detail-title-${selectedWish.id}`" class="wish-detail-dialog__title">
                {{ selectedWish.title }}
              </h2>
              <p class="wish-detail-dialog__description">{{ selectedWish.description }}</p>

              <dl class="wish-detail-dialog__details">
                <div>
                  <dt>地点</dt>
                  <dd>{{ selectedWish.location }}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{{ selectedWish.createdAt }}</dd>
                </div>
                <div>
                  <dt>{{ selectedWishTimeLabel }}</dt>
                  <dd>{{ selectedWishTimeValue || '未设置' }}</dd>
                </div>
                <div>
                  <dt>备注</dt>
                  <dd>{{ selectedWish.note || '暂无备注' }}</dd>
                </div>
              </dl>

              <p v-if="wishActionMessage" class="wish-detail-dialog__error" role="alert">{{ wishActionMessage }}</p>
            </div>

            <div class="wish-detail-dialog__completion">
              <span ref="completionUploadHostRef" class="visually-hidden">
                <NUpload
                  v-model:file-list="completionImageFileList"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  :max="1"
                  :default-upload="false"
                  :show-file-list="false"
                  :input-props="completionImageInputProps"
                  @change="handleCompletionImageSelected"
                />
              </span>
              <button
                v-if="selectedWish.lane !== 'done'"
                ref="completionBadgeRef"
                class="wish-completion-badge wish-completion-badge--pending"
                type="button"
                aria-label="标记为已完成"
                :disabled="isCompletionAnimating"
                @click="requestWishCompletionImage"
              >
                <span aria-hidden="true">✓</span>
                <strong>待完成</strong>
              </button>
              <button
                v-else
                ref="completionBadgeRef"
                class="wish-completion-badge wish-completion-badge--done"
                type="button"
                aria-label="撤回完成"
                :disabled="isCompletionAnimating"
                @click="reopenSelectedWish"
              >
                <span aria-hidden="true">✓</span>
                <strong>撤回完成</strong>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-if="selectedWish && isImagePreviewOpen" ref="imagePreviewRef" class="wish-image-preview" @click.self="closeImagePreview">
        <button class="wish-image-preview__close" type="button" aria-label="关闭图片预览" @click="closeImagePreview">×</button>
        <img ref="imagePreviewImageRef" class="wish-image-preview__image" :src="selectedWish.imageUrl" :alt="selectedWish.title" />
      </div>

      <NModal
        :show="createWishDialogOpen"
        :block-scroll="false"
        :trap-focus="true"
        :close-on-esc="!isCreateWishInteractionLocked"
        :mask-closable="!isCreateWishInteractionLocked"
        :z-index="5000"
        display-directive="if"
        @esc="closeCreateWish"
        @mask-click="closeCreateWish"
      >
        <div
          v-if="createWishDialogOpen"
          ref="createWishBackdropRef"
          class="wish-dialog-backdrop wish-dialog-backdrop--create"
          data-smooth-scroll-prevent
        >
          <form
            ref="createWishDialogRef"
            class="wish-create-dialog"
            data-wish-create-form
            role="dialog"
            aria-modal="true"
            aria-label="新增清单"
            @submit.prevent="submitCreateWish"
          >
            <img
              class="wish-create-dialog__background"
              :src="wishCreateDialogBackground"
              alt=""
              aria-hidden="true"
              draggable="false"
              decoding="async"
            />
            <h2 class="visually-hidden">新增清单</h2>

          <div class="wish-create-dialog__content">
            <div class="wish-create-dialog__left">
              <div class="wish-create-field wish-create-field--category">
                <span>分类</span>
                <div class="wish-create-dialog__category" aria-label="清单分类">
                  <NButton
                    data-wish-category-select="want_go"
                    attr-type="button"
                    :aria-pressed="createWishCategory === 'want_go'"
                    quaternary
                    @click="setCreateWishCategory('want_go')"
                  >
                    想去
                  </NButton>
                  <NButton
                    data-wish-category-select="want_do"
                    attr-type="button"
                    :aria-pressed="createWishCategory === 'want_do'"
                    quaternary
                    @click="setCreateWishCategory('want_do')"
                  >
                    想做
                  </NButton>
                </div>
              </div>

              <label class="wish-create-field wish-create-field--single-line">
                <span>标题 <b aria-hidden="true">*</b></span>
                <span class="wish-create-input-shell">
                  <NInput
                    v-model:value="createWishForm.title"
                    required
                    maxlength="160"
                    placeholder="给这件事起个名字吧"
                    :input-props="wishTitleInputProps"
                  />
                  <small>{{ createWishForm.title.length }}/160</small>
                </span>
              </label>

              <label class="wish-create-field wish-create-field--textarea">
                <span>描述 <b aria-hidden="true">*</b></span>
                <span class="wish-create-input-shell">
                  <NInput
                    v-model:value="createWishForm.description"
                    type="textarea"
                    maxlength="500"
                    placeholder="这一件事的具体想法、原因或期待..."
                    :autosize="{ minRows: 3, maxRows: 4 }"
                  />
                  <small>{{ createWishForm.description.length }}/500</small>
                </span>
              </label>

              <label class="wish-create-field wish-create-field--single-line">
                <span>地点</span>
                <span class="wish-create-input-shell">
                  <NInput v-model:value="createWishForm.locationName" maxlength="120" placeholder="例如：巴黎、北海道、伦敦..." />
                  <small>{{ createWishForm.locationName.length }}/120</small>
                </span>
              </label>

              <label class="wish-create-field wish-create-field--date">
                <span>预计完成时间</span>
                <span class="wish-create-input-shell" :data-empty="createWishForm.expectedCompletedAt ? undefined : 'true'">
                  <NDatePicker
                    :formatted-value="createWishForm.expectedCompletedAt || null"
                    type="date"
                    value-format="yyyy-MM-dd"
                    placeholder="选择日期"
                    clearable
                    :actions="['confirm']"
                    :to="wishCreatePopupPortal"
                    @update:formatted-value="updateCreateWishExpectedCompletedAt"
                  />
                </span>
              </label>

              <label class="wish-create-field wish-create-field--textarea wish-create-field--note">
                <span>备注</span>
                <span class="wish-create-input-shell">
                  <NInput
                    v-model:value="createWishForm.note"
                    type="textarea"
                    maxlength="500"
                    placeholder="其他想补充的内容（可不填） ..."
                    :autosize="{ minRows: 2, maxRows: 3 }"
                  />
                  <small>{{ createWishForm.note.length }}/500</small>
                </span>
              </label>
            </div>

            <div class="wish-create-dialog__divider" aria-hidden="true"></div>
            <div class="wish-create-dialog__right" aria-hidden="true"></div>
          </div>

          <NAlert v-if="wishCreateError" class="wish-create-dialog__error" type="error" :show-icon="false">
            {{ wishCreateError }}
          </NAlert>
          <div class="wish-create-dialog__actions">
            <NButton
              class="wish-create-dialog__cancel"
              attr-type="button"
              secondary
              :disabled="isCreateWishInteractionLocked"
              @click="closeCreateWish"
            >
              <span>取消</span>
            </NButton>
            <NButton
              class="wish-create-dialog__submit"
              attr-type="submit"
              type="primary"
              :disabled="isCreateWishInteractionLocked"
              :loading="isCreatingWish"
            >
              <span>{{ isCreatingWish ? '保存中...' : '贴到板子上' }}</span>
            </NButton>
          </div>
          <div ref="wishCreatePopupPortal" class="wish-create-popup-portal" data-smooth-scroll-prevent></div>
          </form>
        </div>
      </NModal>
    </Teleport>
  </main>
</template>
