import {
  computed,
  ref,
  type ComputedRef,
  type Ref
} from 'vue';
import type {
  WishCreateInput,
  WishDetailDto,
  WishItem,
  WishLaneKey,
  WishLaneTransition,
  WishPageQuery,
  WishSummaryDto
} from '../model';
import { WISH_LANE_KEYS } from '../model';
import { createHttpWishGateway } from './httpWishGateway';
import type { WishGateway } from './ports';
import { errorMessage } from '../../../display';

const DEFAULT_PAGE_SIZE = 8;

export interface WishLaneState {
  items: Readonly<Ref<WishItem[]>>;
  page: Readonly<Ref<number>>;
  size: Readonly<Ref<number>>;
  hasMore: Readonly<Ref<boolean>>;
  loaded: Readonly<Ref<boolean>>;
  loading: Readonly<Ref<boolean>>;
}

export interface WishLifecycleState {
  lanes: Readonly<Record<WishLaneKey, WishLaneState>>;
  loaded: Readonly<Ref<boolean>>;
  canManage: Readonly<Ref<boolean>>;
  loadError: Readonly<Ref<string>>;
  actionError: Readonly<Ref<string>>;
  createError: Readonly<Ref<string>>;
  creating: Readonly<Ref<boolean>>;
  selectedWish: ComputedRef<WishItem | null>;
}

export interface WishLifecycle {
  state: WishLifecycleState;
  loadInitial(): Promise<void>;
  loadNextPage(lane: WishLaneKey): Promise<boolean>;
  selectWish(id: number): Promise<WishItem | null>;
  clearSelectedWish(): void;
  createWish(input: WishCreateInput, image?: File): Promise<WishItem | null>;
  completeWish(id: number, image: File): Promise<WishLaneTransition | null>;
  reopenWish(id: number): Promise<WishLaneTransition | null>;
  commitLaneTransition(transition: WishLaneTransition): boolean;
  isWishPending(id: number): boolean;
  clearActionError(): void;
  clearCreateError(): void;
}

export interface WishLifecycleOptions {
  gateway?: WishGateway;
  pageSize?: number;
  fallbackImageUrl?: string;
}

interface MutableWishLaneState {
  items: Ref<WishItem[]>;
  page: Ref<number>;
  size: Ref<number>;
  hasMore: Ref<boolean>;
  loaded: Ref<boolean>;
  loading: Ref<boolean>;
}

interface WishLocation {
  lane: WishLaneKey;
  index: number;
  wish: WishItem;
}

export function useWishLifecycle({
  gateway: providedGateway,
  pageSize = DEFAULT_PAGE_SIZE,
  fallbackImageUrl = ''
}: WishLifecycleOptions = {}): WishLifecycle {
  const gateway = providedGateway ?? createHttpWishGateway();
  const normalizedPageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const lanes: Record<WishLaneKey, MutableWishLaneState> = {
    wantToGo: createLaneState(normalizedPageSize),
    wantToDo: createLaneState(normalizedPageSize),
    done: createLaneState(normalizedPageSize)
  };
  const loaded = ref(false);
  const canManage = ref(false);
  const loadError = ref('');
  const laneLoadErrors: Record<WishLaneKey, string> = {
    wantToGo: '',
    wantToDo: '',
    done: ''
  };
  const laneMutationVersion: Record<WishLaneKey, number> = {
    wantToGo: 0,
    wantToDo: 0,
    done: 0
  };
  const laneSynchronizedVersion: Record<WishLaneKey, number> = {
    wantToGo: 0,
    wantToDo: 0,
    done: 0
  };
  const actionError = ref('');
  const createError = ref('');
  const creating = ref(false);
  const selectedWishId = ref<number | null>(null);
  const pendingDetailWishIds = ref<Set<number>>(new Set());
  const pendingMutationWishIds = ref<Set<number>>(new Set());
  const pendingPageLoads: Record<WishLaneKey, Promise<boolean> | null> = {
    wantToGo: null,
    wantToDo: null,
    done: null
  };
  const pendingDetailRequests = new Map<number, Promise<WishItem>>();
  const pendingLaneTransitions = new Map<number, WishLaneTransition>();
  let selectionIntentVersion = 0;

  const selectedWish = computed(() => {
    if (selectedWishId.value === null) {
      return null;
    }
    return findWish(selectedWishId.value)?.wish ?? null;
  });

  async function loadInitial(): Promise<void> {
    loaded.value = false;
    loadError.value = '';
    WISH_LANE_KEYS.forEach((lane) => {
      laneLoadErrors[lane] = '';
      laneMutationVersion[lane] = 0;
      laneSynchronizedVersion[lane] = 0;
      lanes[lane].loaded.value = false;
    });
    canManage.value = false;
    actionError.value = '';

    await Promise.all(WISH_LANE_KEYS.map((lane) => loadNextPage(lane)));
    syncLoadError();
    loaded.value = true;
  }

  function loadNextPage(lane: WishLaneKey): Promise<boolean> {
    const pendingLoad = pendingPageLoads[lane];
    if (pendingLoad) {
      return pendingLoad;
    }

    const loadOperation = loadLanePageSequence(lane);
    const trackedOperation = loadOperation.finally(() => {
      if (pendingPageLoads[lane] === trackedOperation) {
        pendingPageLoads[lane] = null;
      }
    });
    pendingPageLoads[lane] = trackedOperation;
    return trackedOperation;
  }

  async function loadLanePageSequence(lane: WishLaneKey): Promise<boolean> {
    const laneState = lanes[lane];
    const requestMutationVersion = laneMutationVersion[lane];
    const reset =
      !laneState.loaded.value ||
      laneSynchronizedVersion[lane] !== requestMutationVersion;
    try {
      const loadedPage = await loadLanePage(
        lane,
        reset ? 1 : laneState.page.value + 1,
        reset,
        requestMutationVersion
      );
      if (
        !loadedPage &&
        laneMutationVersion[lane] !== requestMutationVersion
      ) {
        return loadLanePageSequence(lane);
      }
      if (loadedPage) {
        if (laneMutationVersion[lane] === requestMutationVersion) {
          laneSynchronizedVersion[lane] = requestMutationVersion;
        }
        laneLoadErrors[lane] = '';
        syncLoadError();
      }
      return loadedPage;
    } catch (error) {
      if (laneMutationVersion[lane] !== requestMutationVersion) {
        return loadLanePageSequence(lane);
      }
      laneLoadErrors[lane] = errorMessage(error, '清单加载失败');
      syncLoadError();
      return false;
    }
  }

  async function loadLanePage(
    laneKey: WishLaneKey,
    targetPage: number,
    reset: boolean,
    expectedMutationVersion: number
  ): Promise<boolean> {
    const lane = lanes[laneKey];
    if (lane.loading.value || (!reset && !lane.hasMore.value)) {
      return false;
    }

    lane.loading.value = true;
    try {
      const page = await gateway.fetchPage(
        pageQueryForLane(laneKey, reset ? 1 : targetPage, lane.size.value)
      );
      const items = page.items.map((summary) => {
        const previous = lane.items.value.find((wish) => wish.id === summary.id);
        return itemFromSummary(summary, previous, fallbackImageUrl);
      });
      if (laneMutationVersion[laneKey] !== expectedMutationVersion) {
        return false;
      }

      lane.items.value = reset
        ? items
        : mergePageItems(lane.items.value, items);
      lane.page.value = page.page;
      lane.size.value = page.size;
      lane.hasMore.value = page.hasMore;
      lane.loaded.value = true;
      canManage.value = page.canManage;
      return true;
    } finally {
      lane.loading.value = false;
    }
  }

  async function selectWish(id: number): Promise<WishItem | null> {
    const intentVersion = ++selectionIntentVersion;
    const location = findWish(id);
    if (!location) {
      if (intentVersion === selectionIntentVersion) {
        actionError.value = '清单不存在或尚未加载';
      }
      return null;
    }

    actionError.value = '';
    try {
      const merged = await requestWishDetail(id, location);
      if (intentVersion !== selectionIntentVersion) {
        return null;
      }
      selectedWishId.value = id;
      return merged;
    } catch (error) {
      if (intentVersion === selectionIntentVersion) {
        actionError.value = errorMessage(error, '清单详情加载失败');
      }
      return null;
    }
  }

  function requestWishDetail(
    id: number,
    initialLocation: WishLocation
  ): Promise<WishItem> {
    const pendingRequest = pendingDetailRequests.get(id);
    if (pendingRequest) {
      return pendingRequest;
    }

    setPendingId(pendingDetailWishIds, id, true);
    const detailRequest = gateway.fetchDetail(id).then((detail) =>
      storeWishDetail(detail, initialLocation)
    );
    const trackedRequest = detailRequest.finally(() => {
      if (pendingDetailRequests.get(id) === trackedRequest) {
        pendingDetailRequests.delete(id);
        setPendingId(pendingDetailWishIds, id, false);
      }
    });
    pendingDetailRequests.set(id, trackedRequest);
    return trackedRequest;
  }

  function storeWishDetail(
    detail: WishDetailDto,
    initialLocation: WishLocation
  ): WishItem {
    const latestLocation = findWish(detail.id);
    const merged = itemFromDetail(
      detail,
      latestLocation?.wish ?? initialLocation.wish,
      fallbackImageUrl
    );

    if (!latestLocation) {
      insertWishInLaneOrder(merged.lane, merged);
      invalidateLanePagination(merged.lane);
      return merged;
    }
    if (latestLocation.lane === merged.lane) {
      lanes[latestLocation.lane].items.value.splice(
        latestLocation.index,
        1,
        merged
      );
      return merged;
    }

    lanes[latestLocation.lane].items.value.splice(latestLocation.index, 1);
    insertWishInLaneOrder(merged.lane, merged);
    invalidateLanePagination(latestLocation.lane);
    invalidateLanePagination(merged.lane);
    return merged;
  }

  function clearSelectedWish(): void {
    selectionIntentVersion += 1;
    selectedWishId.value = null;
  }

  async function createWish(
    input: WishCreateInput,
    image?: File
  ): Promise<WishItem | null> {
    if (creating.value) {
      return null;
    }

    createError.value = '';
    creating.value = true;
    try {
      const created = await gateway.createWish(
        {
          ...input,
          expectedCompletedAt: normalizeExpectedCompletedAt(
            input.expectedCompletedAt
          )
        },
        image
      );
      const item = itemFromSummary(created, undefined, fallbackImageUrl);
      insertWishInLaneOrder(item.lane, item);
      invalidateLanePagination(item.lane);
      return item;
    } catch (error) {
      createError.value = errorMessage(error, '新增清单失败');
      return null;
    } finally {
      creating.value = false;
    }
  }

  async function completeWish(
    id: number,
    image: File
  ): Promise<WishLaneTransition | null> {
    const existingTransition = pendingLaneTransitions.get(id);
    if (existingTransition) {
      return existingTransition;
    }
    const location = findWish(id);
    if (
      !location ||
      location.lane === 'done' ||
      pendingMutationWishIds.value.has(id)
    ) {
      return null;
    }

    actionError.value = '';
    setPendingId(pendingMutationWishIds, id, true);
    try {
      const updated = await gateway.completeWish(id, image);
      return rememberLaneTransition(location, updated);
    } catch (error) {
      actionError.value = errorMessage(error, '清单完成失败');
      setPendingId(pendingMutationWishIds, id, false);
      return null;
    }
  }

  async function reopenWish(id: number): Promise<WishLaneTransition | null> {
    const existingTransition = pendingLaneTransitions.get(id);
    if (existingTransition) {
      return existingTransition;
    }
    const location = findWish(id);
    if (
      !location ||
      location.lane !== 'done' ||
      pendingMutationWishIds.value.has(id)
    ) {
      return null;
    }

    actionError.value = '';
    setPendingId(pendingMutationWishIds, id, true);
    try {
      const updated = await gateway.reopenWish(id);
      return rememberLaneTransition(location, updated);
    } catch (error) {
      actionError.value = errorMessage(error, '清单撤回失败');
      setPendingId(pendingMutationWishIds, id, false);
      return null;
    }
  }

  function rememberLaneTransition(
    location: WishLocation,
    summary: WishSummaryDto
  ): WishLaneTransition {
    const wish = itemFromSummary(
      summary,
      location.wish,
      fallbackImageUrl
    );
    const transition: WishLaneTransition = {
      wishId: wish.id,
      fromLane: location.lane,
      toLane: wish.lane,
      wish
    };
    pendingLaneTransitions.set(wish.id, transition);
    return transition;
  }

  function commitLaneTransition(transition: WishLaneTransition): boolean {
    if (pendingLaneTransitions.get(transition.wishId) !== transition) {
      return false;
    }

    const location = findWish(transition.wishId);
    pendingLaneTransitions.delete(transition.wishId);
    setPendingId(pendingMutationWishIds, transition.wishId, false);
    if (!location) {
      return false;
    }

    lanes[location.lane].items.value.splice(location.index, 1);
    insertWishInLaneOrder(transition.toLane, transition.wish);
    invalidateLanePagination(location.lane);
    invalidateLanePagination(transition.toLane);
    return true;
  }

  function isWishPending(id: number): boolean {
    return (
      pendingDetailWishIds.value.has(id) ||
      pendingMutationWishIds.value.has(id)
    );
  }

  function clearActionError(): void {
    actionError.value = '';
  }

  function clearCreateError(): void {
    createError.value = '';
  }

  function syncLoadError(): void {
    loadError.value =
      WISH_LANE_KEYS.map((lane) => laneLoadErrors[lane]).find(Boolean) ?? '';
  }

  function invalidateLanePagination(lane: WishLaneKey): void {
    laneMutationVersion[lane] += 1;
    lanes[lane].hasMore.value = true;
  }

  function insertWishInLaneOrder(lane: WishLaneKey, wish: WishItem): void {
    const items = lanes[lane].items.value;
    const insertionIndex = items.findIndex((existing) =>
      comesBefore(wish, existing, lane)
    );
    if (insertionIndex < 0) {
      items.push(wish);
      return;
    }
    items.splice(insertionIndex, 0, wish);
  }

  function findWish(id: number): WishLocation | null {
    for (const lane of WISH_LANE_KEYS) {
      const index = lanes[lane].items.value.findIndex((wish) => wish.id === id);
      if (index >= 0) {
        return {
          lane,
          index,
          wish: lanes[lane].items.value[index]
        };
      }
    }
    return null;
  }

  return {
    state: {
      lanes,
      loaded,
      canManage,
      loadError,
      actionError,
      createError,
      creating,
      selectedWish
    },
    loadInitial,
    loadNextPage,
    selectWish,
    clearSelectedWish,
    createWish,
    completeWish,
    reopenWish,
    commitLaneTransition,
    isWishPending,
    clearActionError,
    clearCreateError
  };
}

function createLaneState(size: number): MutableWishLaneState {
  return {
    items: ref([]),
    page: ref(1),
    size: ref(size),
    hasMore: ref(true),
    loaded: ref(false),
    loading: ref(false)
  };
}

function mergePageItems(
  currentItems: WishItem[],
  incomingItems: WishItem[]
): WishItem[] {
  const merged = [...currentItems];
  incomingItems.forEach((item) => {
    const existingIndex = merged.findIndex((existing) => existing.id === item.id);
    if (existingIndex >= 0) {
      merged.splice(existingIndex, 1, item);
    } else {
      merged.push(item);
    }
  });
  return merged;
}

function comesBefore(
  candidate: WishItem,
  existing: WishItem,
  lane: WishLaneKey
): boolean {
  const candidateTime =
    lane === 'done' ? candidate.completedAt : candidate.createdAt;
  const existingTime =
    lane === 'done' ? existing.completedAt : existing.createdAt;
  if (candidateTime !== existingTime) {
    return candidateTime > existingTime;
  }
  return candidate.id > existing.id;
}

function pageQueryForLane(
  lane: WishLaneKey,
  page: number,
  size: number
): WishPageQuery {
  if (lane === 'wantToGo') {
    return { category: 'want_go', completed: false, page, size };
  }
  if (lane === 'wantToDo') {
    return { category: 'want_do', completed: false, page, size };
  }
  return { completed: true, page, size };
}

function itemFromSummary(
  summary: WishSummaryDto,
  previous: WishItem | undefined,
  fallbackImageUrl: string
): WishItem {
  return {
    id: summary.id,
    title: summary.title || previous?.title || '未命名清单',
    description: previous?.description ?? '',
    location: previous?.location ?? '暂未设置',
    imageUrl: summary.imageUrl || previous?.imageUrl || fallbackImageUrl,
    createdAt: summary.createdAt || previous?.createdAt || '',
    completedAt: summary.completedAt || '',
    expectedCompletedAt: previous?.expectedCompletedAt ?? '',
    note: previous?.note ?? '',
    lane: laneFromSummary(summary),
    category: summary.category
  };
}

function itemFromDetail(
  detail: WishDetailDto,
  previous: WishItem | undefined,
  fallbackImageUrl: string
): WishItem {
  return {
    ...itemFromSummary(detail, previous, fallbackImageUrl),
    description: detail.description || '暂无描述',
    location: detail.locationName || '暂未设置',
    expectedCompletedAt: detail.expectedCompletedAt || '',
    note: detail.note || ''
  };
}

function laneFromSummary(
  summary: Pick<WishSummaryDto, 'completed' | 'category'>
): WishLaneKey {
  if (summary.completed) {
    return 'done';
  }
  return summary.category === 'want_go' ? 'wantToGo' : 'wantToDo';
}

function normalizeExpectedCompletedAt(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  if (trimmed.length === 10) {
    return `${trimmed}T00:00:00`;
  }
  return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
}

function setPendingId(
  target: Ref<Set<number>>,
  id: number,
  pending: boolean
): void {
  const next = new Set(target.value);
  if (pending) {
    next.add(id);
  } else {
    next.delete(id);
  }
  target.value = next;
}
