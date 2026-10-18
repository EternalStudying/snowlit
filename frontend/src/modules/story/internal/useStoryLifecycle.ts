import {
  computed,
  ref,
  type ComputedRef,
  type Ref
} from 'vue';
import type {
  StoryCategoryFilter,
  StoryMemoryEntry,
  StoryMoment,
  StoryMomentInput
} from '../model';
import { createHttpStoryGateway } from './httpStoryGateway';
import type { StoryGateway } from './ports';
import { errorMessage } from '../../../display';

export interface StoryLifecycleState {
  moments: Readonly<Ref<StoryMoment[]>>;
  years: Readonly<Ref<number[]>>;
  canManage: Readonly<Ref<boolean>>;
  loading: Readonly<Ref<boolean>>;
  saving: Readonly<Ref<boolean>>;
  deleting: Readonly<Ref<boolean>>;
  loadError: Readonly<Ref<string>>;
  actionError: Readonly<Ref<string>>;
  saveError: Readonly<Ref<string>>;
  selectedCategory: Readonly<Ref<StoryCategoryFilter>>;
  selectedYear: Readonly<Ref<number | null>>;
  selectedId: Readonly<Ref<number | null>>;
  selectedMoment: Readonly<Ref<StoryMoment | null>>;
  sortedMoments: ComputedRef<StoryMoment[]>;
  memoryEntry: ComputedRef<StoryMemoryEntry | null>;
}

export interface StoryLifecycle {
  state: StoryLifecycleState;
  loadMoments(): Promise<boolean>;
  selectCategory(category: StoryCategoryFilter): Promise<boolean>;
  selectYear(year: number | null): Promise<boolean>;
  clearFilters(): Promise<boolean>;
  resetBrowsing(): Promise<boolean>;
  isAllFilterSelected(): boolean;
  selectMoment(id: number): Promise<StoryMoment | null>;
  clearSelection(): void;
  saveMoment(
    input: StoryMomentInput,
    editingId?: number | null
  ): Promise<StoryMoment | null>;
  deleteMoment(id: number): Promise<boolean>;
  uploadImage(file: File): Promise<string>;
  clearActionError(): void;
  clearSaveError(): void;
}

export interface StoryLifecycleOptions {
  gateway?: StoryGateway;
  now?: () => Date;
}

export function useStoryLifecycle({
  gateway: providedGateway,
  now = () => new Date()
}: StoryLifecycleOptions = {}): StoryLifecycle {
  const gateway = providedGateway ?? createHttpStoryGateway();
  const moments = ref<StoryMoment[]>([]);
  const allMoments = ref<StoryMoment[]>([]);
  const years = ref<number[]>([]);
  const canManage = ref(false);
  const loading = ref(true);
  const saving = ref(false);
  const deleting = ref(false);
  const loadError = ref('');
  const actionError = ref('');
  const saveError = ref('');
  const selectedCategory = ref<StoryCategoryFilter>('all');
  const selectedYear = ref<number | null>(null);
  const selectedId = ref<number | null>(null);
  const selectedMoment = ref<StoryMoment | null>(null);
  const pendingDetails = new Map<number, Promise<StoryMoment>>();
  let listIntent = 0;
  let detailIntent = 0;

  const sortedMoments = computed(() =>
    [...moments.value].sort(
      (left, right) =>
        momentTimestamp(left) - momentTimestamp(right)
    )
  );

  const memoryEntry = computed<StoryMemoryEntry | null>(() => {
    const source = allMoments.value.length
      ? allMoments.value
      : moments.value;
    if (!source.length) {
      return null;
    }

    const today = now();
    const sameDayMoment = [...source]
      .filter((moment) => {
        const date = new Date(moment.eventTime);
        return (
          !Number.isNaN(date.getTime()) &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        );
      })
      .sort(
        (left, right) =>
          new Date(right.eventTime).getFullYear() -
          new Date(left.eventTime).getFullYear()
      )[0];

    if (sameDayMoment) {
      return {
        label: '今天的回忆',
        moment: sameDayMoment
      };
    }

    const latest = [...source].sort(
      (left, right) =>
        momentTimestamp(right) - momentTimestamp(left)
    )[0];
    return latest
      ? { label: '最近点滴', moment: latest }
      : null;
  });

  async function loadMoments(): Promise<boolean> {
    const intent = ++listIntent;
    loading.value = true;
    loadError.value = '';

    try {
      const response = await gateway.fetchMoments({
        category:
          selectedCategory.value === 'all'
            ? undefined
            : selectedCategory.value,
        year: selectedYear.value ?? undefined
      });
      if (intent !== listIntent) {
        return false;
      }

      moments.value = response.items;
      years.value = response.years;
      canManage.value = response.canManage;
      if (isAllFilterSelected()) {
        allMoments.value = response.items;
      }
      synchronizeSelection(response.items);
      return true;
    } catch (error) {
      if (intent === listIntent) {
        loadError.value = errorMessage(
          error,
          '点滴地图加载失败'
        );
      }
      return false;
    } finally {
      if (intent === listIntent) {
        loading.value = false;
      }
    }
  }

  function selectCategory(
    category: StoryCategoryFilter
  ): Promise<boolean> {
    selectedCategory.value = category;
    return loadMoments();
  }

  function selectYear(year: number | null): Promise<boolean> {
    selectedYear.value = year;
    return loadMoments();
  }

  function clearFilters(): Promise<boolean> {
    selectedCategory.value = 'all';
    selectedYear.value = null;
    return loadMoments();
  }

  function resetBrowsing(): Promise<boolean> {
    const shouldReload = !isAllFilterSelected();
    clearSelection();
    selectedCategory.value = 'all';
    selectedYear.value = null;
    return shouldReload ? loadMoments() : Promise.resolve(true);
  }

  function isAllFilterSelected(): boolean {
    return (
      selectedCategory.value === 'all' &&
      selectedYear.value === null
    );
  }

  async function selectMoment(
    id: number
  ): Promise<StoryMoment | null> {
    const intent = ++detailIntent;
    selectedId.value = id;
    selectedMoment.value =
      moments.value.find((moment) => moment.id === id) ?? null;
    actionError.value = '';

    try {
      const detail = await requestDetail(id);
      if (
        intent !== detailIntent ||
        selectedId.value !== id
      ) {
        return null;
      }
      selectedMoment.value = detail;
      return detail;
    } catch (error) {
      if (intent === detailIntent) {
        actionError.value = errorMessage(
          error,
          '点滴详情加载失败'
        );
      }
      return null;
    }
  }

  function requestDetail(id: number): Promise<StoryMoment> {
    const pending = pendingDetails.get(id);
    if (pending) {
      return pending;
    }

    const request = gateway.fetchMoment(id);
    const tracked = request.finally(() => {
      if (pendingDetails.get(id) === tracked) {
        pendingDetails.delete(id);
      }
    });
    pendingDetails.set(id, tracked);
    return tracked;
  }

  function clearSelection(): void {
    detailIntent += 1;
    selectedId.value = null;
    selectedMoment.value = null;
  }

  async function saveMoment(
    input: StoryMomentInput,
    editingId: number | null = null
  ): Promise<StoryMoment | null> {
    if (saving.value) {
      return null;
    }
    if (!canManage.value) {
      saveError.value = '当前账号不能管理点滴';
      return null;
    }

    saving.value = true;
    saveError.value = '';
    try {
      return editingId === null
        ? await gateway.createMoment(input)
        : await gateway.updateMoment(editingId, input);
    } catch (error) {
      saveError.value = errorMessage(
        error,
        '点滴保存失败'
      );
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function deleteMoment(id: number): Promise<boolean> {
    if (deleting.value) {
      return false;
    }
    if (!canManage.value) {
      actionError.value = '当前账号不能管理点滴';
      return false;
    }

    deleting.value = true;
    actionError.value = '';
    try {
      await gateway.deleteMoment(id);
      return true;
    } catch (error) {
      actionError.value = errorMessage(
        error,
        '点滴删除失败'
      );
      return false;
    } finally {
      deleting.value = false;
    }
  }

  async function uploadImage(file: File): Promise<string> {
    if (!canManage.value) {
      throw new Error('当前账号不能管理点滴');
    }
    return (await gateway.uploadImage(file)).url;
  }

  function clearActionError(): void {
    actionError.value = '';
  }

  function clearSaveError(): void {
    saveError.value = '';
  }

  function synchronizeSelection(items: StoryMoment[]): void {
    if (selectedId.value === null) {
      return;
    }
    const selected = items.find(
      (item) => item.id === selectedId.value
    );
    if (!selected) {
      clearSelection();
      return;
    }
    selectedMoment.value = selected;
  }

  return {
    state: {
      moments,
      years,
      canManage,
      loading,
      saving,
      deleting,
      loadError,
      actionError,
      saveError,
      selectedCategory,
      selectedYear,
      selectedId,
      selectedMoment,
      sortedMoments,
      memoryEntry
    },
    loadMoments,
    selectCategory,
    selectYear,
    clearFilters,
    resetBrowsing,
    isAllFilterSelected,
    selectMoment,
    clearSelection,
    saveMoment,
    deleteMoment,
    uploadImage,
    clearActionError,
    clearSaveError
  };
}

function momentTimestamp(moment: StoryMoment): number {
  const time = new Date(moment.eventTime).getTime();
  return Number.isFinite(time) ? time : 0;
}
