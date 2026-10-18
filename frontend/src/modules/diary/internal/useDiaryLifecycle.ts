import {
  computed,
  ref,
  type ComputedRef,
  type Ref
} from 'vue';
import boyfriendAvatar from '../../../assets/couple-avatars/partner-a.webp';
import girlfriendAvatar from '../../../assets/couple-avatars/partner-b.webp';
import { formatLocalCalendarDate } from '../../../calendarDate';
import type {
  DiaryArchiveDto,
  DiaryDayGroup,
  DiaryDetailDto,
  DiaryEditorValue,
  DiaryEntry,
  DiaryImageUploadDto,
  DiaryMonthGroup,
  DiaryMoodKey,
  DiaryRole,
  DiarySaveResult,
  DiarySummaryDto,
  DiaryYearChapter
} from '../model';
import { DIARY_MOOD_LABELS } from '../moods';
import { createHttpDiaryGateway } from './httpDiaryGateway';
import type { DiaryGateway } from './ports';
import {
  createDiaryWeatherSnapshot,
  getDiaryWeatherEditorDefaults,
  type DiaryAtmosphereContext as WeatherContext
} from './weatherSnapshot';
import { errorMessage } from '../../../display';
import { createLatestRequest, createSharedRequests } from '../../../requestGuards';

export interface DiaryLifecycleState {
  entries: Readonly<Ref<DiaryEntry[]>>;
  yearChapters: Readonly<Ref<DiaryYearChapter[]>>;
  selectedMonth: Readonly<Ref<string>>;
  currentRole: Readonly<Ref<DiaryRole | null>>;
  selectedEntry: Readonly<Ref<DiaryEntry | null>>;
  loaded: Readonly<Ref<boolean>>;
  monthLoading: Readonly<Ref<boolean>>;
  saving: Readonly<Ref<boolean>>;
  deleting: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  currentMonthGroup: ComputedRef<DiaryMonthGroup>;
  currentMonthHasEntries: ComputedRef<boolean>;
  selectedMonthLabel: ComputedRef<string>;
}

export interface DiaryLifecycle {
  state: DiaryLifecycleState;
  loadInitial(): Promise<boolean>;
  loadMonth(month: string): Promise<boolean>;
  selectEntry(id: number): Promise<DiaryEntry | null>;
  clearSelectedEntry(): void;
  saveEntry(
    value: DiaryEditorValue,
    editingId: number | null,
    weatherContext: WeatherContext
  ): Promise<DiarySaveResult | null>;
  deleteSelectedEntry(): Promise<boolean>;
  uploadImage(file: File): Promise<DiaryImageUploadDto>;
  createEditorValue(
    entry: DiaryEntry | null,
    weatherContext: WeatherContext
  ): DiaryEditorValue;
  ownsEntry(entry: DiaryEntry): boolean;
  clearError(): void;
}

export interface DiaryLifecycleOptions {
  gateway?: DiaryGateway;
  today?: () => string;
}

export function useDiaryLifecycle({
  gateway: providedGateway,
  today: provideToday = formatLocalCalendarDate
}: DiaryLifecycleOptions = {}): DiaryLifecycle {
  const gateway = providedGateway ?? createHttpDiaryGateway();
  const today = provideToday();
  const currentMonthKey = today.slice(0, 7);
  const entries = ref<DiaryEntry[]>([]);
  const yearChapters = ref<DiaryYearChapter[]>([]);
  const selectedMonth = ref(currentMonthKey);
  const currentRole = ref<DiaryRole | null>(null);
  const selectedEntry = ref<DiaryEntry | null>(null);
  const loaded = ref(false);
  const monthLoading = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const error = ref('');
  const detailRequests = createSharedRequests<number, DiaryEntry>();
  const latestInitialization = createLatestRequest();
  const latestMonth = createLatestRequest();
  const latestDetail = createLatestRequest();

  const sortedEntries = computed(() =>
    [...entries.value].sort((left, right) => {
      const dateOrder = right.date.localeCompare(left.date);
      return dateOrder || right.createdAt.localeCompare(left.createdAt);
    })
  );
  const currentMonthEntries = computed(() =>
    sortedEntries.value.filter((entry) =>
      entry.date.startsWith(selectedMonth.value)
    )
  );
  const currentMonthGroup = computed<DiaryMonthGroup>(() => ({
    key: selectedMonth.value,
    label: formatMonthKeyLabel(selectedMonth.value),
    days: groupEntriesByDate(currentMonthEntries.value)
  }));
  const currentMonthHasEntries = computed(
    () => currentMonthGroup.value.days.length > 0
  );
  const selectedMonthLabel = computed(
    () => currentMonthGroup.value.label
  );

  async function loadInitial(): Promise<boolean> {
    const isCurrent = latestInitialization.begin();
    loaded.value = false;
    error.value = '';

    try {
      const [role, archive] = await Promise.all([
        gateway.fetchCurrentRole(),
        gateway.fetchArchive()
      ]);
      if (!isCurrent()) {
        return false;
      }

      currentRole.value = role;
      yearChapters.value = mapYearChapters(archive);
      const defaultMonth = getDefaultMonth(yearChapters.value);
      return await loadMonth(defaultMonth);
    } catch (loadError) {
      if (isCurrent()) {
        error.value = errorMessage(
          loadError,
          '用户信息加载失败'
        );
      }
      return false;
    } finally {
      if (isCurrent()) {
        loaded.value = true;
      }
    }
  }

  async function loadMonth(month: string): Promise<boolean> {
    const isCurrent = latestMonth.begin();
    selectedMonth.value = month;
    monthLoading.value = true;
    error.value = '';

    try {
      const response = await gateway.fetchMonth(month);
      if (!isCurrent()) {
        return false;
      }

      selectedMonth.value = response.month;
      entries.value = response.items.map(normalizeSummary);
      return true;
    } catch (loadError) {
      if (isCurrent()) {
        error.value = errorMessage(
          loadError,
          '日记数据加载失败'
        );
      }
      return false;
    } finally {
      if (isCurrent()) {
        monthLoading.value = false;
      }
    }
  }

  async function selectEntry(id: number): Promise<DiaryEntry | null> {
    const isCurrent = latestDetail.begin();
    if (!entries.value.some((entry) => entry.id === id)) {
      if (isCurrent()) {
        error.value = '日记不存在或尚未加载';
      }
      return null;
    }

    error.value = '';
    try {
      const detail = await requestDetail(id);
      if (!isCurrent()) {
        return null;
      }
      selectedEntry.value = detail;
      return detail;
    } catch (detailError) {
      if (isCurrent()) {
        error.value = errorMessage(
          detailError,
          '日记详情加载失败'
        );
      }
      return null;
    }
  }

  function requestDetail(id: number): Promise<DiaryEntry> {
    return detailRequests.run(id, () => gateway.fetchDetail(id).then((detail) => storeDetail(detail)));
  }

  function storeDetail(detail: DiaryDetailDto): DiaryEntry {
    const normalized = normalizeDetail(detail);
    entries.value = entries.value.map((entry) =>
      entry.id === normalized.id ? normalized : entry
    );
    return normalized;
  }

  function clearSelectedEntry(): void {
    latestDetail.cancel();
    selectedEntry.value = null;
  }

  async function saveEntry(
    value: DiaryEditorValue,
    editingId: number | null,
    weatherContext: WeatherContext
  ): Promise<DiarySaveResult | null> {
    if (saving.value) {
      return null;
    }

    error.value = '';
    if (!currentRole.value) {
      error.value = '用户信息加载中，请稍后再试';
      return null;
    }

    const editingEntry =
      editingId === null
        ? null
        : entries.value.find((entry) => entry.id === editingId) ??
          null;
    if (
      editingId !== null &&
      (!editingEntry || !ownsEntry(editingEntry))
    ) {
      error.value = '只能修改自己的日记';
      return null;
    }

    if (hasSameDayEntry(value.date, editingId ?? undefined)) {
      error.value = '这一天已经写过日记啦';
      return null;
    }

    saving.value = true;
    const previousMonth = selectedMonth.value;

    try {
      if (editingEntry) {
        const updated = normalizeDetail(
          await gateway.updateEntry(editingEntry.id, {
            contentMarkdown: value.content.trim(),
            moodKey: value.moodKey,
            visibility: value.visibility
          })
        );
        entries.value = entries.value.map((entry) =>
          entry.id === updated.id ? updated : entry
        );
        selectedMonth.value = updated.date.slice(0, 7);
        return {
          entry: updated,
          monthChanged: previousMonth !== selectedMonth.value,
          created: false
        };
      }

      const created = normalizeSummary(
        await gateway.createEntry({
          contentMarkdown: value.content.trim(),
          date: value.date,
          moodKey: value.moodKey,
          visibility: value.visibility,
          weatherSnapshot: createDiaryWeatherSnapshot(
            value,
            weatherContext
          )
        })
      );
      entries.value = [created, ...entries.value];
      selectedMonth.value = created.date.slice(0, 7);
      await refreshArchive();
      return {
        entry: created,
        monthChanged: previousMonth !== selectedMonth.value,
        created: true
      };
    } catch (saveError) {
      error.value = errorMessage(
        saveError,
        '保存失败，请稍后再试'
      );
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function deleteSelectedEntry(): Promise<boolean> {
    const entry = selectedEntry.value;
    if (!entry || deleting.value) {
      return false;
    }
    if (!ownsEntry(entry)) {
      error.value = '只能修改自己的日记';
      return false;
    }

    deleting.value = true;
    error.value = '';
    const deletedMonth = entry.date.slice(0, 7);
    try {
      await gateway.deleteEntry(entry.id);
      if (selectedEntry.value?.id === entry.id) {
        clearSelectedEntry();
      }
      await refreshArchive();
      await loadMonth(deletedMonth);
      return true;
    } catch (deleteError) {
      error.value = errorMessage(
        deleteError,
        '删除失败，请稍后再试'
      );
      return false;
    } finally {
      deleting.value = false;
    }
  }

  function uploadImage(file: File): Promise<DiaryImageUploadDto> {
    return gateway.uploadImage(file);
  }

  function createEditorValue(
    entry: DiaryEntry | null,
    weatherContext: WeatherContext
  ): DiaryEditorValue {
    if (entry) {
      return {
        title: entry.title,
        content: entry.content,
        date: entry.date,
        moodKey: entry.moodKey,
        location: entry.location,
        weather: entry.weather,
        visibility: entry.visibility
      };
    }

    const defaults = getDiaryWeatherEditorDefaults(weatherContext);
    return {
      title: '',
      content: '',
      date: provideToday(),
      moodKey: 'happy',
      location: defaults.location,
      weather: defaults.weather,
      visibility: 'shared'
    };
  }

  function ownsEntry(entry: DiaryEntry): boolean {
    return Boolean(
      currentRole.value &&
        entry.role === currentRole.value
    );
  }

  function clearError(): void {
    error.value = '';
  }

  async function refreshArchive(): Promise<void> {
    yearChapters.value = mapYearChapters(
      await gateway.fetchArchive()
    );
  }

  function hasSameDayEntry(
    date: string,
    excludedId?: number
  ): boolean {
    if (!currentRole.value) {
      return false;
    }

    return entries.value.some(
      (entry) =>
        entry.role === currentRole.value &&
        entry.date === date &&
        entry.id !== excludedId
    );
  }

  function normalizeSummary(entry: DiarySummaryDto): DiaryEntry {
    return {
      id: entry.id,
      role: entry.role,
      authorName: entry.authorName || roleFallbackName(entry.role),
      authorAvatar: resolveAuthorAvatar(entry),
      title: entry.title || '未命名日记',
      content: entry.summary,
      images: entry.imageUrls,
      date: entry.entryDate,
      moodKey: resolveMoodKey(entry.moodKey),
      mood: moodLabel(entry.moodKey),
      location: entry.locationName || '未记录',
      weather: entry.weather || '未记录',
      visibility: entry.visibility,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    };
  }

  function normalizeDetail(entry: DiaryDetailDto): DiaryEntry {
    return {
      ...normalizeSummary(entry),
      content: entry.contentMarkdown,
      rawWeather: entry.rawWeather ?? '',
      temperature: entry.temperature,
      windDirection: entry.windDirection ?? '',
      windPower: entry.windPower ?? '',
      humidity: entry.humidity ?? '',
      province: entry.province ?? '',
      city: entry.city ?? '',
      district: entry.district ?? '',
      latitude: entry.latitude,
      longitude: entry.longitude
    };
  }

  function mapYearChapters(
    data: DiaryArchiveDto
  ): DiaryYearChapter[] {
    const years = data.years.length
      ? data.years
      : [
          {
            year: Number(currentMonthKey.slice(0, 4)),
            months: []
          }
        ];

    return years.map((year) => ({
      year: year.year,
      months: Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1;
        const key = `${year.year}-${String(monthNumber).padStart(2, '0')}`;
        const stat = year.months.find(
          (item) => item.month === key
        );
        const count = stat?.count ?? 0;
        return {
          key,
          year: year.year,
          monthNumber,
          label: `${monthNumber}月`,
          count,
          hasEntries:
            stat?.hasEntries ?? count > 0
        };
      })
    }));
  }

  function getDefaultMonth(
    chapters: DiaryYearChapter[]
  ): string {
    const months = chapters.flatMap(
      (chapter) => chapter.months
    );
    if (
      months.some(
        (month) =>
          month.key === currentMonthKey && month.hasEntries
      )
    ) {
      return currentMonthKey;
    }
    return (
      months.find((month) => month.hasEntries)?.key ??
      currentMonthKey
    );
  }

  return {
    state: {
      entries,
      yearChapters,
      selectedMonth,
      currentRole,
      selectedEntry,
      loaded,
      monthLoading,
      saving,
      deleting,
      error,
      currentMonthGroup,
      currentMonthHasEntries,
      selectedMonthLabel
    },
    loadInitial,
    loadMonth,
    selectEntry,
    clearSelectedEntry,
    saveEntry,
    deleteSelectedEntry,
    uploadImage,
    createEditorValue,
    ownsEntry,
    clearError
  };
}

function groupEntriesByDate(
  entries: DiaryEntry[]
): DiaryDayGroup[] {
  const dayMap = new Map<string, DiaryDayGroup>();

  entries.forEach((entry) => {
    const dayGroup =
      dayMap.get(entry.date) ??
      ({
        key: entry.date,
        label: formatDayLabel(entry.date),
        weekday: formatWeekday(entry.date),
        entriesByRole: {
          boyfriend: null,
          girlfriend: null
        }
      } satisfies DiaryDayGroup);

    if (!dayGroup.entriesByRole[entry.role]) {
      dayGroup.entriesByRole[entry.role] = entry;
    }
    dayMap.set(entry.date, dayGroup);
  });

  return [...dayMap.values()].sort((left, right) =>
    right.key.localeCompare(left.key)
  );
}

function resolveMoodKey(key: string): DiaryMoodKey {
  return key in DIARY_MOOD_LABELS
    ? (key as DiaryMoodKey)
    : 'happy';
}

function moodLabel(key: string): string {
  return DIARY_MOOD_LABELS[resolveMoodKey(key)];
}

function resolveAuthorAvatar(
  entry: Pick<DiarySummaryDto, 'role' | 'authorAvatar'>
): string {
  if (entry.role === 'boyfriend') {
    return boyfriendAvatar;
  }
  if (entry.role === 'girlfriend') {
    return girlfriendAvatar;
  }
  return entry.authorAvatar;
}

function roleFallbackName(role: DiaryRole): string {
  return role === 'boyfriend' ? '伴侣 A' : '伴侣 B';
}

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function formatMonthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${Number(year)} 年 ${Number(month)} 月`;
}

function formatDayLabel(date: string): string {
  const localDate = parseLocalDate(date);
  return `${localDate.getMonth() + 1}月${localDate.getDate()}日`;
}

function formatWeekday(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    weekday: 'short'
  }).format(parseLocalDate(date));
}
