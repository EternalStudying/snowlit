import { describe, expect, it, vi } from 'vitest';
import type {
  WishCreateInput,
  WishDetailDto,
  WishPageDto,
  WishSummaryDto
} from '../model';
import type { WishGateway } from '../internal/ports';
import { useWishLifecycle } from '../internal/useWishLifecycle';
import { createMemoryWishGateway } from './support/memoryWishGateway';

const createInput: WishCreateInput = {
  title: '去看海',
  category: 'want_go',
  description: '一起看日落',
  locationName: '尼斯',
  expectedCompletedAt: '2026-08-01',
  note: '带相机'
};

describe('WishLifecycle', () => {
  it('并行初始化三个独立 lane，并保留各自分页和管理权限', async () => {
    const gateway = createMemoryWishGateway({
      summaries: [
        summary(1, 'want_go'),
        summary(2, 'want_do'),
        summary(3, 'want_go', true)
      ],
      canManage: true
    });
    const fetchPage = vi.spyOn(gateway, 'fetchPage');
    const lifecycle = useWishLifecycle({
      gateway,
      pageSize: 8,
      fallbackImageUrl: '/fallback.webp'
    });

    await lifecycle.loadInitial();

    expect(fetchPage.mock.calls.map(([query]) => query)).toEqual([
      { category: 'want_go', completed: false, page: 1, size: 8 },
      { category: 'want_do', completed: false, page: 1, size: 8 },
      { completed: true, page: 1, size: 8 }
    ]);
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([1]);
    expect(lifecycle.state.lanes.wantToDo.items.value.map(({ id }) => id)).toEqual([2]);
    expect(lifecycle.state.lanes.done.items.value.map(({ id }) => id)).toEqual([3]);
    expect(lifecycle.state.loaded.value).toBe(true);
    expect(lifecycle.state.canManage.value).toBe(true);
    expect(lifecycle.state.loadError.value).toBe('');
  });

  it('同一 lane 分页防重，并在 hasMore=false 后停止请求', async () => {
    const gateway = createMemoryWishGateway({
      summaries: Array.from({ length: 5 }, (_, index) =>
        summary(index + 1, 'want_go')
      )
    });
    const fetchPage = vi.spyOn(gateway, 'fetchPage');
    const lifecycle = useWishLifecycle({ gateway, pageSize: 2 });
    await lifecycle.loadInitial();

    const firstPageTwo = lifecycle.loadNextPage('wantToGo');
    const duplicatePageTwo = lifecycle.loadNextPage('wantToGo');
    expect(duplicatePageTwo).toBe(firstPageTwo);
    await expect(
      Promise.all([firstPageTwo, duplicatePageTwo])
    ).resolves.toEqual([true, true]);

    expect(
      fetchPage.mock.calls.filter(
        ([query]) => query.category === 'want_go' && query.page === 2
      )
    ).toHaveLength(1);
    expect(lifecycle.state.lanes.wantToGo.items.value).toHaveLength(4);

    await lifecycle.loadNextPage('wantToGo');
    expect(lifecycle.state.lanes.wantToGo.items.value).toHaveLength(5);
    expect(lifecycle.state.lanes.wantToGo.hasMore.value).toBe(false);
    await expect(lifecycle.loadNextPage('wantToGo')).resolves.toBe(false);
    expect(
      fetchPage.mock.calls.filter(
        ([query]) => query.category === 'want_go'
      )
    ).toHaveLength(3);
  });

  it('详情合并保留摘要图片并通过 selectedWish 暴露完整字段', async () => {
    const original = summary(1, 'want_go', false, {
      title: '原来的标题',
      imageUrl: '/existing.webp'
    });
    const gateway = createMemoryWishGateway({
      summaries: [original],
      details: [
        detail(original, {
          title: '',
          imageUrl: null,
          description: '完整描述',
          locationName: '尼斯海滨大道',
          expectedCompletedAt: '2026-08-01T00:00:00',
          note: '带相机'
        })
      ]
    });
    const lifecycle = useWishLifecycle({
      gateway,
      fallbackImageUrl: '/fallback.webp'
    });
    await lifecycle.loadInitial();

    const selected = await lifecycle.selectWish(1);

    expect(selected).toMatchObject({
      id: 1,
      title: '原来的标题',
      description: '完整描述',
      location: '尼斯海滨大道',
      imageUrl: '/existing.webp',
      expectedCompletedAt: '2026-08-01T00:00:00',
      note: '带相机',
      lane: 'wantToGo'
    });
    expect(lifecycle.state.selectedWish.value).toEqual(selected);
    lifecycle.clearSelectedWish();
    expect(lifecycle.state.selectedWish.value).toBeNull();
  });

  it('并发详情按最后一次选择生效，较早响应不会覆盖当前清单', async () => {
    const firstSummary = summary(1, 'want_go');
    const secondSummary = summary(2, 'want_do');
    const firstDetail = deferred<WishDetailDto>();
    const secondDetail = deferred<WishDetailDto>();
    const fetchDetail = vi.fn((id: number) =>
      id === firstSummary.id ? firstDetail.promise : secondDetail.promise
    );
    const gateway = createMemoryWishGateway({
      summaries: [firstSummary, secondSummary],
      overrides: {
        fetchDetail
      }
    });
    const lifecycle = useWishLifecycle({ gateway });
    await lifecycle.loadInitial();

    const firstSelection = lifecycle.selectWish(firstSummary.id);
    const secondSelection = lifecycle.selectWish(secondSummary.id);
    secondDetail.resolve(
      detail(secondSummary, { description: '第二次点击的详情' })
    );
    await expect(secondSelection).resolves.toMatchObject({
      id: secondSummary.id,
      description: '第二次点击的详情'
    });

    firstDetail.resolve(
      detail(firstSummary, { description: '较晚返回的旧详情' })
    );
    await expect(firstSelection).resolves.toBeNull();
    expect(lifecycle.state.selectedWish.value).toMatchObject({
      id: secondSummary.id,
      description: '第二次点击的详情'
    });
  });

  it('A→B→A 复用 A 的在途请求，并让最后一次 A 成为最终选择', async () => {
    const firstSummary = summary(1, 'want_go');
    const secondSummary = summary(2, 'want_do');
    const firstDetail = deferred<WishDetailDto>();
    const secondDetail = deferred<WishDetailDto>();
    const fetchDetail = vi.fn((id: number) =>
      id === firstSummary.id ? firstDetail.promise : secondDetail.promise
    );
    const gateway = createMemoryWishGateway({
      summaries: [firstSummary, secondSummary],
      overrides: {
        fetchDetail
      }
    });
    const lifecycle = useWishLifecycle({ gateway });
    await lifecycle.loadInitial();

    const firstSelection = lifecycle.selectWish(firstSummary.id);
    const secondSelection = lifecycle.selectWish(secondSummary.id);
    const finalSelection = lifecycle.selectWish(firstSummary.id);
    expect(fetchDetail).toHaveBeenCalledTimes(2);

    secondDetail.resolve(detail(secondSummary));
    await expect(secondSelection).resolves.toBeNull();
    firstDetail.resolve(
      detail(firstSummary, { description: '最后一次选择复用的详情' })
    );

    await expect(firstSelection).resolves.toBeNull();
    await expect(finalSelection).resolves.toMatchObject({
      id: firstSummary.id,
      description: '最后一次选择复用的详情'
    });
    expect(lifecycle.state.selectedWish.value?.id).toBe(firstSummary.id);
  });

  it('详情请求无论失败或成功，settle 后都释放 pending 并允许同 ID 重试', async () => {
    const original = summary(1, 'want_go');
    const failedDetail = deferred<WishDetailDto>();
    const successfulDetail = deferred<WishDetailDto>();
    const refreshedDetail = deferred<WishDetailDto>();
    const fetchDetail = vi
      .fn()
      .mockImplementationOnce(() => failedDetail.promise)
      .mockImplementationOnce(() => successfulDetail.promise)
      .mockImplementationOnce(() => refreshedDetail.promise);
    const gateway = createMemoryWishGateway({
      summaries: [original],
      overrides: {
        fetchDetail
      }
    });
    const lifecycle = useWishLifecycle({ gateway });
    await lifecycle.loadInitial();

    const failedSelection = lifecycle.selectWish(original.id);
    expect(lifecycle.isWishPending(original.id)).toBe(true);
    failedDetail.reject(new Error('第一次详情失败'));
    await expect(failedSelection).resolves.toBeNull();
    expect(lifecycle.isWishPending(original.id)).toBe(false);

    const successfulSelection = lifecycle.selectWish(original.id);
    expect(fetchDetail).toHaveBeenCalledTimes(2);
    successfulDetail.resolve(
      detail(original, { description: '重试成功的详情' })
    );
    await expect(successfulSelection).resolves.toMatchObject({
      description: '重试成功的详情'
    });
    expect(lifecycle.isWishPending(original.id)).toBe(false);

    const refreshedSelection = lifecycle.selectWish(original.id);
    expect(fetchDetail).toHaveBeenCalledTimes(3);
    refreshedDetail.resolve(
      detail(original, { description: '成功后仍能重新拉取' })
    );
    await expect(refreshedSelection).resolves.toMatchObject({
      description: '成功后仍能重新拉取'
    });
    expect(lifecycle.isWishPending(original.id)).toBe(false);
  });

  it('详情反映远端 lane 变化时同步移栏，后续命令按最新 lane 判断', async () => {
    const original = summary(1, 'want_go');
    const completedDetail = detail(original, {
      completed: true,
      completedAt: '2026-07-25T20:00:00'
    });
    const gateway = createMemoryWishGateway({
      summaries: [original],
      details: [completedDetail]
    });
    const lifecycle = useWishLifecycle({ gateway });
    await lifecycle.loadInitial();

    await expect(lifecycle.selectWish(original.id)).resolves.toMatchObject({
      id: original.id,
      lane: 'done'
    });
    expect(lifecycle.state.lanes.wantToGo.items.value).toHaveLength(0);
    expect(lifecycle.state.lanes.done.items.value.map(({ id }) => id)).toEqual([
      original.id
    ]);

    const reopenTransition = await lifecycle.reopenWish(original.id);
    expect(reopenTransition).toMatchObject({
      fromLane: 'done',
      toLane: 'wantToGo'
    });
  });

  it('创建成功后插入目标 lane 顶部并规范日期 wire 值', async () => {
    const gateway = createMemoryWishGateway({
      summaries: [summary(1, 'want_go')],
      now: () => '2026-07-26T10:00:00'
    });
    const createWish = vi.spyOn(gateway, 'createWish');
    const lifecycle = useWishLifecycle({
      gateway,
      fallbackImageUrl: '/fallback.webp'
    });
    await lifecycle.loadInitial();

    const created = await lifecycle.createWish(createInput);

    expect(createWish).toHaveBeenCalledWith(
      {
        ...createInput,
        expectedCompletedAt: '2026-08-01T00:00:00'
      },
      undefined
    );
    expect(created?.lane).toBe('wantToGo');
    expect(lifecycle.state.lanes.wantToGo.items.value[0]).toEqual(created);
    expect(lifecycle.state.creating.value).toBe(false);
  });

  it('完成和撤回只返回 transition，commit 后才移动 lane', async () => {
    const gateway = createMemoryWishGateway({
      summaries: [
        summary(1, 'want_go'),
        summary(2, 'want_do', true)
      ],
      now: () => '2026-07-26T10:00:00'
    });
    const completeWish = vi.spyOn(gateway, 'completeWish');
    const reopenWish = vi.spyOn(gateway, 'reopenWish');
    const lifecycle = useWishLifecycle({ gateway });
    await lifecycle.loadInitial();
    const image = new File(['done'], 'done.jpg', { type: 'image/jpeg' });

    const completed = await lifecycle.completeWish(1, image);

    expect(completed).toMatchObject({
      wishId: 1,
      fromLane: 'wantToGo',
      toLane: 'done'
    });
    expect(lifecycle.state.lanes.wantToGo.items.value.some(({ id }) => id === 1)).toBe(true);
    expect(lifecycle.state.lanes.done.items.value.some(({ id }) => id === 1)).toBe(false);
    expect(lifecycle.isWishPending(1)).toBe(true);
    await expect(lifecycle.completeWish(1, image)).resolves.toBe(completed);
    expect(completeWish).toHaveBeenCalledTimes(1);
    expect(lifecycle.commitLaneTransition(completed!)).toBe(true);
    expect(lifecycle.state.lanes.wantToGo.items.value.some(({ id }) => id === 1)).toBe(false);
    expect(lifecycle.state.lanes.done.items.value[0].id).toBe(1);
    expect(lifecycle.isWishPending(1)).toBe(false);

    const reopened = await lifecycle.reopenWish(2);

    expect(reopened).toMatchObject({
      wishId: 2,
      fromLane: 'done',
      toLane: 'wantToDo'
    });
    expect(lifecycle.state.lanes.done.items.value.some(({ id }) => id === 2)).toBe(true);
    expect(lifecycle.state.lanes.wantToDo.items.value.some(({ id }) => id === 2)).toBe(false);
    expect(lifecycle.commitLaneTransition(reopened!)).toBe(true);
    expect(lifecycle.state.lanes.wantToDo.items.value[0].id).toBe(2);
    expect(reopenWish).toHaveBeenCalledTimes(1);
  });

  it('本地创建和移栏后先刷新第一页，再继续 offset 分页且保持服务端排序', async () => {
    const gateway = createMemoryWishGateway({
      summaries: [1, 2, 3, 4].map((id) => summary(id, 'want_go')),
      now: () => '2026-07-26T10:00:00'
    });
    const lifecycle = useWishLifecycle({ gateway, pageSize: 2 });
    await lifecycle.loadInitial();

    const created = await lifecycle.createWish(createInput);
    expect(created?.id).toBe(5);
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([
      5,
      4,
      3
    ]);

    await lifecycle.loadNextPage('wantToGo');
    expect(lifecycle.state.lanes.wantToGo.page.value).toBe(1);
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([
      5,
      4
    ]);
    await lifecycle.loadNextPage('wantToGo');
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([
      5,
      4,
      3,
      2
    ]);

    const image = new File(['done'], 'done.jpg', { type: 'image/jpeg' });
    const completed = await lifecycle.completeWish(4, image);
    expect(lifecycle.commitLaneTransition(completed!)).toBe(true);
    await lifecycle.loadNextPage('wantToGo');
    await lifecycle.loadNextPage('wantToGo');
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([
      5,
      3,
      2,
      1
    ]);

    const reopened = await lifecycle.reopenWish(4);
    expect(lifecycle.commitLaneTransition(reopened!)).toBe(true);
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([
      5,
      4,
      3,
      2,
      1
    ]);
  });

  it('分页请求在本地 mutation 期间返回时不清除待刷新版本', async () => {
    const base = createMemoryWishGateway({
      summaries: [1, 2, 3, 4].map((id) => summary(id, 'want_go')),
      now: () => '2026-07-26T10:00:00'
    });
    const stalePageTwo = deferred<WishPageDto>();
    let shouldDeferPageTwo = true;
    const fetchPage = vi.fn((query) => {
      if (
        query.category === 'want_go' &&
        query.page === 2 &&
        shouldDeferPageTwo
      ) {
        shouldDeferPageTwo = false;
        return stalePageTwo.promise;
      }
      return base.fetchPage(query);
    });
    const gateway: WishGateway = { ...base, fetchPage };
    const lifecycle = useWishLifecycle({ gateway, pageSize: 2 });
    await lifecycle.loadInitial();

    const pendingPage = lifecycle.loadNextPage('wantToGo');
    await lifecycle.createWish(createInput);
    const joinedPendingPage = lifecycle.loadNextPage('wantToGo');
    expect(joinedPendingPage).toBe(pendingPage);
    stalePageTwo.resolve({
      items: [summary(2, 'want_go'), summary(1, 'want_go')],
      total: 4,
      page: 2,
      size: 2,
      hasMore: false,
      canManage: true
    });
    await expect(
      Promise.all([pendingPage, joinedPendingPage])
    ).resolves.toEqual([true, true]);
    expect(
      fetchPage.mock.calls
        .filter(([query]) => query.category === 'want_go')
        .map(([query]) => query.page)
    ).toEqual([1, 2, 1]);
    expect(lifecycle.state.lanes.wantToGo.page.value).toBe(1);
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([
      5,
      4
    ]);
  });

  it('初载期间发生本地 mutation 时丢弃旧响应，并自动重试最新第一页', async () => {
    const base = createMemoryWishGateway({
      summaries: [summary(1, 'want_go')],
      now: () => '2026-07-26T10:00:00'
    });
    const staleInitialPage = deferred<WishPageDto>();
    let shouldDeferInitialPage = true;
    const fetchPage = vi.fn((query) => {
      if (query.category === 'want_go' && shouldDeferInitialPage) {
        shouldDeferInitialPage = false;
        return staleInitialPage.promise;
      }
      return base.fetchPage(query);
    });
    const gateway: WishGateway = { ...base, fetchPage };
    const lifecycle = useWishLifecycle({ gateway });

    const initialLoad = lifecycle.loadInitial();
    await Promise.resolve();
    const created = await lifecycle.createWish(createInput);
    staleInitialPage.resolve({
      items: [summary(1, 'want_go')],
      total: 1,
      page: 1,
      size: 8,
      hasMore: false,
      canManage: true
    });
    await initialLoad;

    expect(created?.id).toBe(2);
    expect(
      fetchPage.mock.calls
        .filter(([query]) => query.category === 'want_go')
        .map(([query]) => query.page)
    ).toEqual([1, 1]);
    expect(lifecycle.state.lanes.wantToGo.loaded.value).toBe(true);
    expect(lifecycle.state.lanes.wantToGo.items.value.map(({ id }) => id)).toEqual([
      2,
      1
    ]);
  });

  it('失败写入对应 error，pending 操作拒绝重复提交并在 commit 后释放', async () => {
    const completion = deferred<WishSummaryDto>();
    const base = createMemoryWishGateway({
      summaries: [summary(1, 'want_go')]
    });
    const gateway: WishGateway = {
      ...base,
      fetchDetail: vi.fn().mockRejectedValue(new Error('详情坏了')),
      createWish: vi.fn().mockRejectedValue(new Error('创建坏了')),
      completeWish: vi.fn(() => completion.promise)
    };
    const lifecycle = useWishLifecycle({ gateway });
    await lifecycle.loadInitial();

    await expect(lifecycle.selectWish(1)).resolves.toBeNull();
    expect(lifecycle.state.actionError.value).toBe('详情坏了');
    await expect(lifecycle.createWish(createInput)).resolves.toBeNull();
    expect(lifecycle.state.createError.value).toBe('创建坏了');
    expect(lifecycle.state.creating.value).toBe(false);

    const image = new File(['done'], 'done.jpg', { type: 'image/jpeg' });
    const first = lifecycle.completeWish(1, image);
    const duplicate = lifecycle.completeWish(1, image);
    expect(lifecycle.isWishPending(1)).toBe(true);
    await expect(duplicate).resolves.toBeNull();
    expect(gateway.completeWish).toHaveBeenCalledTimes(1);
    completion.resolve(
      summary(1, 'want_go', true, {
        imageUrl: '/done.webp',
        completedAt: '2026-07-25T20:00:00'
      })
    );
    const transition = await first;
    expect(lifecycle.isWishPending(1)).toBe(true);
    expect(lifecycle.commitLaneTransition(transition!)).toBe(true);
    expect(lifecycle.isWishPending(1)).toBe(false);
  });

  it('任一初载 lane 失败仍结束 loading，重试从第一页恢复并清除该栏错误', async () => {
    const base = createMemoryWishGateway({
      summaries: [summary(1, 'want_go'), summary(2, 'want_do')]
    });
    let shouldFailWantToDo = true;
    const gateway: WishGateway = {
      ...base,
      fetchPage: vi.fn((query) => {
        if (query.category === 'want_do' && shouldFailWantToDo) {
          shouldFailWantToDo = false;
          return Promise.reject(new Error('想做列表失败'));
        }
        return base.fetchPage(query);
      })
    };
    const lifecycle = useWishLifecycle({ gateway });

    await lifecycle.loadInitial();

    expect(lifecycle.state.loaded.value).toBe(true);
    expect(lifecycle.state.loadError.value).toBe('想做列表失败');
    expect(lifecycle.state.lanes.wantToGo.items.value).toHaveLength(1);
    expect(lifecycle.state.lanes.wantToDo.loading.value).toBe(false);
    expect(lifecycle.state.lanes.wantToDo.loaded.value).toBe(false);

    await expect(lifecycle.loadNextPage('wantToDo')).resolves.toBe(true);
    expect(
      vi.mocked(gateway.fetchPage).mock.calls
        .filter(([query]) => query.category === 'want_do')
        .map(([query]) => query.page)
    ).toEqual([1, 1]);
    expect(lifecycle.state.lanes.wantToDo.items.value.map(({ id }) => id)).toEqual([2]);
    expect(lifecycle.state.loadError.value).toBe('');
  });
});

function summary(
  id: number,
  category: 'want_go' | 'want_do',
  completed = false,
  overrides: Partial<WishSummaryDto> = {}
): WishSummaryDto {
  return {
    id,
    title: `清单 ${id}`,
    category,
    completed,
    imageUrl: `/wish-${id}.webp`,
    createdAt: '2026-07-25T10:00:00',
    completedAt: completed ? '2026-07-25T18:00:00' : null,
    ...overrides
  };
}

function detail(
  source: WishSummaryDto,
  overrides: Partial<WishDetailDto> = {}
): WishDetailDto {
  return {
    ...source,
    description: '描述',
    locationName: '地点',
    latitude: null,
    longitude: null,
    note: null,
    expectedCompletedAt: null,
    updatedAt: source.createdAt,
    lastOperatedByUserId: null,
    lastOperatedAt: null,
    ...overrides
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
