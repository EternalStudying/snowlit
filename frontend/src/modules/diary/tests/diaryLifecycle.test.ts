import { describe, expect, it, vi } from 'vitest';
import { useDiaryLifecycle } from '../internal/useDiaryLifecycle';
import type {
  DiaryArchiveDto,
  DiaryDetailDto,
  DiaryMonthDto,
  DiarySummaryDto
} from '../model';
import { createMemoryDiaryGateway } from './support/memoryDiaryGateway';

describe('useDiaryLifecycle', () => {
  it('页面跨过午夜后新增日记仍默认当天日期', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2025, 11, 31, 23, 30));
      const lifecycle = useDiaryLifecycle({ gateway: createMemoryDiaryGateway() });
      vi.setSystemTime(new Date(2026, 0, 1, 0, 30));

      expect(lifecycle.createEditorValue(null, { weather: null, coordinates: null }).date).toBe('2026-01-01');
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { localTime: [2025, 11, 31, 23, 30], date: '2025-12-31' },
    { localTime: [2026, 0, 1, 0, 30], date: '2026-01-01' }
  ])('新增日记和默认月份使用本地自然日 $date', ({ localTime, date }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const [year, month, day, hour, minute] = localTime;
      vi.setSystemTime(new Date(year, month, day, hour, minute));
      const lifecycle = useDiaryLifecycle({ gateway: createMemoryDiaryGateway() });

      expect(lifecycle.state.selectedMonth.value).toBe(date.slice(0, 7));
      expect(lifecycle.createEditorValue(null, { weather: null, coordinates: null }).date).toBe(date);
    } finally {
      vi.useRealTimers();
    }
  });

  it('并发初始化角色和归档后选择首个有内容月份，并按日期和双方角色分组', async () => {
    const girlfriend = createDetail({
      id: 10,
      role: 'girlfriend',
      entryDate: '2026-05-17',
      title: '女方日记'
    });
    const boyfriend = createDetail({
      id: 11,
      role: 'boyfriend',
      entryDate: '2026-05-17',
      title: '男方日记'
    });
    const gateway = createMemoryDiaryGateway({
      role: 'girlfriend',
      entries: [girlfriend, boyfriend]
    });
    const lifecycle = useDiaryLifecycle({
      gateway,
      today: () => '2026-07-30'
    });

    await expect(lifecycle.loadInitial()).resolves.toBe(true);

    expect(lifecycle.state.currentRole.value).toBe('girlfriend');
    expect(lifecycle.state.selectedMonth.value).toBe('2026-05');
    expect(
      lifecycle.state.currentMonthGroup.value.days[0]
        .entriesByRole
    ).toMatchObject({
      girlfriend: { id: 10 },
      boyfriend: { id: 11 }
    });
    expect(lifecycle.state.loaded.value).toBe(true);
  });

  it('月份切换采用最后意图，较慢的旧响应不能覆盖新月份', async () => {
    const may = deferred<DiaryMonthDto>();
    const june = deferred<DiaryMonthDto>();
    const gateway = createMemoryDiaryGateway({
      overrides: {
        fetchMonth(month) {
          return month === '2026-05' ? may.promise : june.promise;
        }
      }
    });
    const lifecycle = useDiaryLifecycle({
      gateway,
      today: () => '2026-07-30'
    });

    const older = lifecycle.loadMonth('2026-05');
    const newer = lifecycle.loadMonth('2026-06');
    june.resolve({
      month: '2026-06',
      items: [toSummary(createDetail({
        id: 6,
        entryDate: '2026-06-01',
        title: '六月'
      }))]
    });
    await expect(newer).resolves.toBe(true);
    may.resolve({
      month: '2026-05',
      items: [toSummary(createDetail({
        id: 5,
        entryDate: '2026-05-01',
        title: '五月'
      }))]
    });
    await expect(older).resolves.toBe(false);

    expect(lifecycle.state.selectedMonth.value).toBe('2026-06');
    expect(lifecycle.state.entries.value.map((entry) => entry.id)).toEqual([6]);
  });

  it('详情选择采用最后意图，同一详情请求会复用进行中的 Promise', async () => {
    const firstDetail = deferred<DiaryDetailDto>();
    const secondDetail = deferred<DiaryDetailDto>();
    const first = createDetail({ id: 1, title: '第一篇' });
    const second = createDetail({ id: 2, title: '第二篇' });
    const fetchDetail = vi.fn((id: number) =>
      id === 1 ? firstDetail.promise : secondDetail.promise
    );
    const gateway = createMemoryDiaryGateway({
      entries: [first, second],
      overrides: { fetchDetail }
    });
    const lifecycle = useDiaryLifecycle({
      gateway,
      today: () => '2026-05-20'
    });
    await lifecycle.loadInitial();

    const older = lifecycle.selectEntry(1);
    const sharedOlder = lifecycle.selectEntry(1);
    expect(fetchDetail).toHaveBeenCalledTimes(1);
    const newer = lifecycle.selectEntry(2);
    secondDetail.resolve(second);
    await expect(newer).resolves.toMatchObject({ id: 2 });
    firstDetail.resolve(first);
    await expect(older).resolves.toBeNull();
    await expect(sharedOlder).resolves.toBeNull();

    expect(lifecycle.state.selectedEntry.value?.id).toBe(2);
    expect(fetchDetail).toHaveBeenCalledTimes(2);
  });

  it('同日唯一只约束当前角色，并拒绝编辑另一方日记', async () => {
    const ownEntry = createDetail({
      id: 10,
      role: 'girlfriend',
      entryDate: '2026-05-17'
    });
    const otherEntry = createDetail({
      id: 11,
      role: 'boyfriend',
      entryDate: '2026-05-18'
    });
    const createEntry = vi.fn();
    const updateEntry = vi.fn();
    const gateway = createMemoryDiaryGateway({
      role: 'girlfriend',
      entries: [ownEntry, otherEntry],
      overrides: {
        createEntry,
        updateEntry
      }
    });
    const lifecycle = useDiaryLifecycle({
      gateway,
      today: () => '2026-05-20'
    });
    await lifecycle.loadInitial();

    await expect(
      lifecycle.saveEntry(
        editorValue('2026-05-17'),
        null,
        emptyWeatherContext()
      )
    ).resolves.toBeNull();
    expect(lifecycle.state.error.value).toBe(
      '这一天已经写过日记啦'
    );
    expect(createEntry).not.toHaveBeenCalled();

    await expect(
      lifecycle.saveEntry(
        editorValue('2026-05-18'),
        11,
        emptyWeatherContext()
      )
    ).resolves.toBeNull();
    expect(lifecycle.state.error.value).toBe(
      '只能修改自己的日记'
    );
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it('创建时组合当前天气定位快照并更新月份与归档', async () => {
    const gateway = createMemoryDiaryGateway({
      role: 'girlfriend',
      now: () => '2026-06-02T12:00:00'
    });
    const createEntry = vi.fn(gateway.createEntry);
    gateway.createEntry = createEntry;
    const lifecycle = useDiaryLifecycle({
      gateway,
      today: () => '2026-05-20'
    });
    await lifecycle.loadInitial();

    const result = await lifecycle.saveEntry(
      editorValue('2026-06-02'),
      null,
      {
        weather: {
          city: '示例城市 A',
          district: '示例街区 A',
          province: '示例地区 A',
          country: '德国',
          temperature: 22,
          rawWeather: '晴',
          weatherState: 'clear',
          weatherVariant: 'clear',
          precipitationKind: 'none',
          windDirection: '东风',
          windPower: '≤3',
          humidity: '60',
          daylightHint: 'day',
          observedAt: '2026-06-02T11:00:00'
        },
        coordinates: {
          latitude: 52.52,
          longitude: 13.41
        }
      }
    );

    expect(createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-06-02',
        weatherSnapshot: expect.objectContaining({
          rawWeather: '晴',
          province: '示例地区 A',
          city: '示例城市 A',
          district: '示例街区 A',
          latitude: 52.52,
          longitude: 13.41
        })
      })
    );
    expect(result).toMatchObject({
      created: true,
      monthChanged: true
    });
    expect(lifecycle.state.selectedMonth.value).toBe('2026-06');
    expect(
      lifecycle.state.yearChapters.value[0].months.find(
        (month) => month.key === '2026-06'
      )
    ).toMatchObject({ count: 1, hasEntries: true });
  });

  it('编辑 wire input 不携带日期并在当前列表替换详情', async () => {
    const entry = createDetail({
      id: 10,
      role: 'girlfriend',
      entryDate: '2026-05-17'
    });
    const gateway = createMemoryDiaryGateway({
      role: 'girlfriend',
      entries: [entry],
      now: () => '2026-05-18T12:00:00'
    });
    const updateEntry = vi.fn(gateway.updateEntry);
    gateway.updateEntry = updateEntry;
    const lifecycle = useDiaryLifecycle({
      gateway,
      today: () => '2026-05-20'
    });
    await lifecycle.loadInitial();
    const value = {
      ...editorValue('2026-05-17'),
      content: '# 改过标题\n\n改过正文',
      moodKey: 'sweet' as const,
      visibility: 'private' as const
    };

    const result = await lifecycle.saveEntry(
      value,
      10,
      emptyWeatherContext()
    );

    expect(updateEntry).toHaveBeenCalledWith(10, {
      contentMarkdown: '# 改过标题\n\n改过正文',
      moodKey: 'sweet',
      visibility: 'private'
    });
    expect(updateEntry.mock.calls[0][1]).not.toHaveProperty('date');
    expect(result?.entry).toMatchObject({
      title: '改过标题',
      visibility: 'private'
    });
    expect(lifecycle.state.entries.value[0].title).toBe('改过标题');
  });

  it('删除自己的选中日记后刷新归档和原月份列表', async () => {
    const entry = createDetail({
      id: 10,
      role: 'girlfriend',
      entryDate: '2026-05-17'
    });
    const gateway = createMemoryDiaryGateway({
      role: 'girlfriend',
      entries: [entry]
    });
    const fetchArchive = vi.fn(gateway.fetchArchive);
    const fetchMonth = vi.fn(gateway.fetchMonth);
    gateway.fetchArchive = fetchArchive;
    gateway.fetchMonth = fetchMonth;
    const lifecycle = useDiaryLifecycle({
      gateway,
      today: () => '2026-05-20'
    });
    await lifecycle.loadInitial();
    await lifecycle.selectEntry(10);

    await expect(
      lifecycle.deleteSelectedEntry()
    ).resolves.toBe(true);

    expect(lifecycle.state.selectedEntry.value).toBeNull();
    expect(lifecycle.state.entries.value).toEqual([]);
    expect(fetchArchive).toHaveBeenCalledTimes(2);
    expect(fetchMonth).toHaveBeenCalledTimes(2);
  });
});

function createDetail({
  id,
  role = 'girlfriend',
  entryDate = '2026-05-17',
  title = `日记 ${id}`
}: {
  id: number;
  role?: 'boyfriend' | 'girlfriend';
  entryDate?: string;
  title?: string;
}): DiaryDetailDto {
  return {
    id,
    role,
    authorName: role === 'boyfriend' ? '伴侣 A' : '伴侣 B',
    authorAvatar: '',
    title,
    summary: `${title}摘要`,
    imageUrls: [],
    entryDate,
    moodKey: 'happy',
    locationName: '示例街区 A',
    weather: '晴',
    visibility: 'shared',
    createdAt: `${entryDate}T18:00:00`,
    updatedAt: `${entryDate}T18:00:00`,
    contentMarkdown: `# ${title}\n\n正文`,
    rawWeather: '晴',
    temperature: 22,
    windDirection: '东风',
    windPower: '≤3',
    humidity: '60',
    province: '示例地区 A',
    city: '示例城市 A',
    district: '示例街区 A',
    latitude: 52.52,
    longitude: 13.41
  };
}

function toSummary(detail: DiaryDetailDto): DiarySummaryDto {
  const {
    contentMarkdown: _contentMarkdown,
    rawWeather: _rawWeather,
    temperature: _temperature,
    windDirection: _windDirection,
    windPower: _windPower,
    humidity: _humidity,
    province: _province,
    city: _city,
    district: _district,
    latitude: _latitude,
    longitude: _longitude,
    ...summary
  } = detail;
  return summary;
}

function editorValue(date: string) {
  return {
    title: '新日记',
    content: '# 新日记\n\n正文',
    date,
    moodKey: 'happy' as const,
    location: '',
    weather: '',
    visibility: 'shared' as const
  };
}

function emptyWeatherContext() {
  return {
    weather: null,
    coordinates: null
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
