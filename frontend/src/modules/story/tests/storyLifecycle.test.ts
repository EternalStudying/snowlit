import { describe, expect, it, vi } from 'vitest';
import { useStoryLifecycle } from '../internal/useStoryLifecycle';
import type {
  StoryMoment,
  StoryMomentInput,
  StoryMomentListDto
} from '../model';
import { createMemoryStoryGateway } from './support/memoryStoryGateway';

const dailyMoment = createMoment({
  id: 1,
  title: '早安早餐',
  eventTime: '2025-08-16T09:10:00',
  category: 'daily'
});
const travelMoment = createMoment({
  id: 2,
  title: '第一次去海边散步',
  eventTime: '2026-04-05T18:30:00',
  category: 'travel'
});

describe('useStoryLifecycle', () => {
  it('加载公开列表并维护时间线顺序、年份和管理权限', async () => {
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        moments: [travelMoment, dailyMoment],
        canManage: true
      })
    });

    await expect(lifecycle.loadMoments()).resolves.toBe(true);

    expect(lifecycle.state.sortedMoments.value.map(({ id }) => id))
      .toEqual([1, 2]);
    expect(lifecycle.state.years.value).toEqual([2026, 2025]);
    expect(lifecycle.state.canManage.value).toBe(true);
    expect(lifecycle.state.loading.value).toBe(false);
  });

  it('筛选列表采用最后意图，较慢的旧响应不能覆盖新筛选', async () => {
    const travel = deferred<StoryMomentListDto>();
    const daily = deferred<StoryMomentListDto>();
    const fetchMoments = vi.fn((filters = {}) =>
      filters.category === 'travel'
        ? travel.promise
        : daily.promise
    );
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        overrides: { fetchMoments }
      })
    });

    const older = lifecycle.selectCategory('travel');
    const newer = lifecycle.selectCategory('daily');
    daily.resolve({
      items: [dailyMoment],
      years: [2025],
      canManage: false
    });
    await expect(newer).resolves.toBe(true);
    travel.resolve({
      items: [travelMoment],
      years: [2026],
      canManage: false
    });
    await expect(older).resolves.toBe(false);

    expect(lifecycle.state.selectedCategory.value).toBe('daily');
    expect(lifecycle.state.moments.value.map(({ id }) => id))
      .toEqual([1]);
  });

  it('详情选择采用最后意图，同一详情复用进行中的请求', async () => {
    const first = deferred<StoryMoment>();
    const second = deferred<StoryMoment>();
    const fetchMoment = vi.fn((id: number) =>
      id === 1 ? first.promise : second.promise
    );
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        moments: [dailyMoment, travelMoment],
        overrides: { fetchMoment }
      })
    });
    await lifecycle.loadMoments();

    const older = lifecycle.selectMoment(1);
    const sharedOlder = lifecycle.selectMoment(1);
    expect(fetchMoment).toHaveBeenCalledTimes(1);
    const newer = lifecycle.selectMoment(2);
    second.resolve(travelMoment);
    await expect(newer).resolves.toMatchObject({ id: 2 });
    first.resolve(dailyMoment);
    await expect(older).resolves.toBeNull();
    await expect(sharedOlder).resolves.toBeNull();

    expect(lifecycle.state.selectedMoment.value?.id).toBe(2);
    expect(fetchMoment).toHaveBeenCalledTimes(2);
  });

  it('全部列表保留今日回忆来源，筛选后仍能定位筛选外的同月同日点滴', async () => {
    const memory = createMoment({
      id: 10,
      title: '往年的今天',
      eventTime: '2024-07-30T08:00:00',
      category: 'daily'
    });
    const latest = createMoment({
      id: 11,
      title: '最近旅行',
      eventTime: '2026-07-29T20:00:00',
      category: 'travel'
    });
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        moments: [memory, latest]
      }),
      now: () => new Date('2026-07-30T12:00:00')
    });

    await lifecycle.loadMoments();
    await lifecycle.selectCategory('travel');

    expect(lifecycle.state.moments.value.map(({ id }) => id))
      .toEqual([11]);
    expect(lifecycle.state.memoryEntry.value).toMatchObject({
      label: '今天的回忆',
      moment: { id: 10 }
    });
  });

  it('没有同日点滴时选择事件时间最近的点滴', async () => {
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        moments: [dailyMoment, travelMoment]
      }),
      now: () => new Date('2026-07-30T12:00:00')
    });

    await lifecycle.loadMoments();

    expect(lifecycle.state.memoryEntry.value).toMatchObject({
      label: '最近点滴',
      moment: { id: 2 }
    });
  });

  it('无管理权限时拒绝写入和删除，并给出业务错误', async () => {
    const createMomentRequest = vi.fn();
    const deleteMomentRequest = vi.fn();
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        moments: [dailyMoment],
        overrides: {
          createMoment: createMomentRequest,
          deleteMoment: deleteMomentRequest
        }
      })
    });
    await lifecycle.loadMoments();

    await expect(
      lifecycle.saveMoment(toInput(dailyMoment))
    ).resolves.toBeNull();
    await expect(
      lifecycle.deleteMoment(dailyMoment.id)
    ).resolves.toBe(false);

    expect(createMomentRequest).not.toHaveBeenCalled();
    expect(deleteMomentRequest).not.toHaveBeenCalled();
    expect(lifecycle.state.saveError.value)
      .toBe('当前账号不能管理点滴');
    expect(lifecycle.state.actionError.value)
      .toBe('当前账号不能管理点滴');
  });

  it('创建和编辑调用精确 ID，并用 pending guard 拒绝重复保存', async () => {
    const pending = deferred<StoryMoment>();
    const createMomentRequest = vi.fn(() => pending.promise);
    const updateMomentRequest = vi.fn(
      async (id: number, input: StoryMomentInput) => ({
        ...travelMoment,
        ...input,
        id
      })
    );
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        moments: [travelMoment],
        canManage: true,
        overrides: {
          createMoment: createMomentRequest,
          updateMoment: updateMomentRequest
        }
      })
    });
    await lifecycle.loadMoments();

    const creating = lifecycle.saveMoment(toInput(dailyMoment));
    await expect(
      lifecycle.saveMoment(toInput(travelMoment))
    ).resolves.toBeNull();
    pending.resolve(dailyMoment);
    await expect(creating).resolves.toMatchObject({ id: 1 });

    await lifecycle.saveMoment(
      { ...toInput(travelMoment), title: '更新后' },
      2
    );

    expect(createMomentRequest).toHaveBeenCalledTimes(1);
    expect(updateMomentRequest).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ title: '更新后' })
    );
  });

  it('删除和上传经由 Gateway，上传接口只向编辑器返回 URL', async () => {
    const deleteMomentRequest = vi.fn(async () => undefined);
    const uploadImage = vi.fn(async () => ({
      url: 'https://cdn.example.com/story/image.webp'
    }));
    const lifecycle = useStoryLifecycle({
      gateway: createMemoryStoryGateway({
        moments: [travelMoment],
        canManage: true,
        overrides: {
          deleteMoment: deleteMomentRequest,
          uploadImage
        }
      })
    });
    await lifecycle.loadMoments();
    const image = new File(['image'], 'story.webp', {
      type: 'image/webp'
    });

    await expect(lifecycle.deleteMoment(2)).resolves.toBe(true);
    await expect(lifecycle.uploadImage(image)).resolves.toBe(
      'https://cdn.example.com/story/image.webp'
    );

    expect(deleteMomentRequest).toHaveBeenCalledWith(2);
    expect(uploadImage).toHaveBeenCalledWith(image);
  });
});

function createMoment(
  overrides: Partial<StoryMoment>
): StoryMoment {
  return {
    id: 1,
    title: '点滴',
    content: '正文',
    eventTime: '2026-01-01T10:00:00',
    endTime: null,
    locationName: '地图落点',
    address: '法国巴黎',
    longitude: 2.35,
    latitude: 48.85,
    category: 'daily',
    createdByUserId: 1,
    createdAt: '2026-01-01T10:00:00',
    updatedAt: '2026-01-01T10:00:00',
    ...overrides,
    images: overrides.images ?? []
  };
}

function toInput(moment: StoryMoment): StoryMomentInput {
  return {
    title: moment.title,
    content: moment.content,
    eventTime: moment.eventTime,
    endTime: moment.endTime,
    locationName: moment.locationName,
    address: moment.address,
    longitude: 40,
    latitude: 10,
    category: moment.category,
    images: [...moment.images]
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
