import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WishCategory,
  WishDetailDto,
  WishPageDto,
  WishSummaryDto
} from '../model';
import { clearAuthToken, setAuthToken } from '../../../auth';
import WishesView from '../WishesView.vue';

const wantGoFirst: WishSummaryDto = {
  id: 101,
  title: '一起去海边看日落',
  category: 'want_go',
  completed: false,
  imageUrl: '/wish-assets/sea-sunset.jpg',
  createdAt: '2026-05-16T10:00:00',
  completedAt: null
};

const wantDoFirst: WishSummaryDto = {
  id: 201,
  title: '一起做一顿周末早午餐',
  category: 'want_do',
  completed: false,
  imageUrl: '/wish-assets/brunch.jpg',
  createdAt: '2026-05-15T10:00:00',
  completedAt: null
};

const doneFirst: WishSummaryDto = {
  id: 301,
  title: '一起拍一套写真',
  category: 'want_go',
  completed: true,
  imageUrl: '/wish-assets/photo.jpg',
  createdAt: '2026-04-01T10:00:00',
  completedAt: '2026-05-14T20:00:00'
};

const wantGoSecondPage: WishSummaryDto = {
  ...wantGoFirst,
  id: 109,
  title: '去一条海边公路散步'
};

const wantGoThirdPage: WishSummaryDto = {
  ...wantGoFirst,
  id: 110,
  title: '去海岛住一个周末'
};

const wantGoDetail: WishDetailDto = {
  ...wantGoFirst,
  description: '找一个傍晚慢慢走到海边，看太阳落进海面。',
  locationName: '尼斯海滨大道',
  latitude: 43.70,
  longitude: 7.26,
  note: '记得带相机和薄外套。',
  expectedCompletedAt: '2026-06-01T18:00:00',
  updatedAt: '2026-05-16T10:00:00',
  lastOperatedByUserId: 1,
  lastOperatedAt: '2026-05-16T10:00:00'
};

const completedWishDetail: WishDetailDto = {
  ...wantGoDetail,
  ...doneFirst,
  description: '我们的第一套情侣写真，很喜欢这个纪念。',
  locationName: '摄影棚',
  expectedCompletedAt: null,
  note: '已经整理进相册。'
};

const wishPageResponses: Record<string, WishPageDto> = {
  '/api/wishes?category=want_go&completed=false&page=1&size=8': {
    items: [wantGoFirst],
    total: 9,
    page: 1,
    size: 8,
    hasMore: true,
    canManage: true
  },
  '/api/wishes?category=want_go&completed=false&page=2&size=8': {
    items: [wantGoSecondPage],
    total: 9,
    page: 2,
    size: 8,
    hasMore: false,
    canManage: true
  },
  '/api/wishes?category=want_do&completed=false&page=1&size=8': {
    items: [wantDoFirst],
    total: 1,
    page: 1,
    size: 8,
    hasMore: false,
    canManage: true
  },
  '/api/wishes?completed=true&page=1&size=8': {
    items: [doneFirst],
    total: 1,
    page: 1,
    size: 8,
    hasMore: false,
    canManage: true
  }
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  };
}

async function readWishCreatePayload(init?: RequestInit) {
  const body = init?.body;
  if (!(body instanceof FormData)) {
    throw new Error('Expected FormData body');
  }

  const payload = body.get('payload');
  if (!(payload instanceof Blob)) {
    throw new Error('Expected JSON payload blob');
  }

  if (typeof payload.text === 'function') {
    return JSON.parse(await payload.text()) as { title: string; category: WishCategory };
  }

  const text = await new Promise<string>((resolveText, rejectText) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolveText(String(reader.result ?? '')));
    reader.addEventListener('error', () => rejectText(reader.error ?? new Error('Failed to read payload blob')));
    reader.readAsText(payload);
  });

  return JSON.parse(text) as { title: string; category: WishCategory };
}

function createCompletionImage() {
  return new File(['done'], 'done.jpg', { type: 'image/jpeg' });
}

function expectCompletionImageBody(init?: RequestInit) {
  const body = init?.body;
  expect(body).toBeInstanceOf(FormData);
  const image = (body as FormData).get('image');
  expect(image).toBeInstanceOf(File);
  expect((image as File).name).toBe('done.jpg');
}

function createWishRequestAdapter(
  pageResponses: Record<string, WishPageDto> = wishPageResponses
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === '/api/site') {
      return Promise.reject(new Error('清单页不应依赖 /api/site 完整列表'));
    }

    if (method === 'GET' && pageResponses[url]) {
      return Promise.resolve(jsonResponse(pageResponses[url]));
    }

    if (url === '/api/wishes/101' && method === 'GET') {
      return Promise.resolve(jsonResponse(wantGoDetail));
    }

    if (url === '/api/wishes/301' && method === 'GET') {
      return Promise.resolve(jsonResponse(completedWishDetail));
    }

    if (url === '/api/wishes/101/complete' && method === 'POST') {
      expectCompletionImageBody(init);
      return Promise.resolve(
        jsonResponse({
          ...wantGoFirst,
          completed: true,
          completedAt: '2026-05-16T20:00:00'
        })
      );
    }

    if (url === '/api/wishes/301/reopen' && method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          ...doneFirst,
          completed: false,
          completedAt: null
        })
      );
    }

    if (url === '/api/wishes' && method === 'POST') {
      const payload = await readWishCreatePayload(init);

      return Promise.resolve(
        jsonResponse({
          id: 150,
          title: payload.title,
          category: payload.category,
          completed: false,
          imageUrl: null,
          createdAt: '2026-05-25T12:00:00',
          completedAt: null
        })
      );
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
  }) as unknown as typeof fetch;
}

function createWishRequestAdapterWithInitialLaneError() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (
      method === 'GET' &&
      url === '/api/wishes?category=want_do&completed=false&page=1&size=8'
    ) {
      return Promise.resolve(
        jsonResponse(
          { code: 'WISH_LIST_UNAVAILABLE', message: '想做清单暂时不可用' },
          503
        )
      );
    }
    if (method === 'GET' && wishPageResponses[url]) {
      return Promise.resolve(jsonResponse(wishPageResponses[url]));
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
  }) as unknown as typeof fetch;
}

function createWishRequestAdapterWithDetailError() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (method === 'GET' && wishPageResponses[url]) {
      return Promise.resolve(jsonResponse(wishPageResponses[url]));
    }
    if (url === '/api/wishes/101' && method === 'GET') {
      return Promise.resolve(
        jsonResponse(
          { code: 'WISH_DETAIL_UNAVAILABLE', message: '清单详情暂时不可用' },
          503
        )
      );
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
  }) as unknown as typeof fetch;
}

function createWishRequestAdapterWithCompleteError() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (method === 'GET' && wishPageResponses[url]) {
      return Promise.resolve(jsonResponse(wishPageResponses[url]));
    }
    if (url === '/api/wishes/101' && method === 'GET') {
      return Promise.resolve(jsonResponse(wantGoDetail));
    }
    if (url === '/api/wishes/101/complete' && method === 'POST') {
      expectCompletionImageBody(init);
      return Promise.resolve(jsonResponse({ code: 'WISH_ALREADY_COMPLETED', message: '这个清单已经完成了' }, 409));
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
  }) as unknown as typeof fetch;
}

async function mountWishesView(requestAdapter = createWishRequestAdapter()) {
  vi.stubGlobal('fetch', requestAdapter);

  const wrapper = mount(WishesView, {
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true,
        teleport: true
      }
    }
  });
  await flushPromises();
  await wrapper.vm.$nextTick();

  return wrapper;
}

async function openFirstWish(wrapper: VueWrapper, listIndex = 0, rowIndex = 0) {
  const row = wrapper.findAll('.wish-lane-list')[listIndex].findAll('.wish-lane-item')[rowIndex];

  await row.trigger('click');
  await flushPromises();
  await wrapper.vm.$nextTick();

  return row;
}

async function settleWishMotion(wrapper: VueWrapper) {
  await flushPromises();
  await wrapper.vm.$nextTick();
}

async function selectCompletionImage(wrapper: VueWrapper) {
  const input = wrapper.get('input[data-wish-complete-image]').element as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [createCompletionImage()]
  });
  await wrapper.get('input[data-wish-complete-image]').trigger('change');
}

function mockScrollableWishLane(wrapper: VueWrapper, listIndex: number) {
  const list = wrapper.findAll('.wish-lane-list')[listIndex].element as HTMLElement;

  Object.defineProperty(list, 'scrollTop', { configurable: true, value: 360 });
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 240 });
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 590 });

  return wrapper.findAll('.wish-lane-list')[listIndex];
}

function mockUnderfilledWishLists() {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function getClientHeight(this: HTMLElement) {
    return this.classList?.contains('wish-lane-list') ? 260 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function getScrollHeight(this: HTMLElement) {
    if (!this.classList?.contains('wish-lane-list')) {
      return 0;
    }

    return this.querySelectorAll('.wish-lane-item').length * 44;
  });
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

describe('WishesView 清单交互', () => {
  beforeEach(() => {
    clearAuthToken();
    setAuthToken('jwt-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearAuthToken();
    document.body.innerHTML = '';
  });

  it('按三栏请求 /api/wishes 分页摘要，不再依赖 mock 或 /api/site', async () => {
    const requestAdapter = createWishRequestAdapter();
    const wrapper = await mountWishesView(requestAdapter);

    expect(requestAdapter).toHaveBeenCalledWith('/api/wishes?category=want_go&completed=false&page=1&size=8', {
      headers: { Authorization: 'Bearer jwt-token' }
    });
    expect(requestAdapter).toHaveBeenCalledWith('/api/wishes?category=want_do&completed=false&page=1&size=8', {
      headers: { Authorization: 'Bearer jwt-token' }
    });
    expect(requestAdapter).toHaveBeenCalledWith('/api/wishes?completed=true&page=1&size=8', {
      headers: { Authorization: 'Bearer jwt-token' }
    });
    expect((requestAdapter as ReturnType<typeof vi.fn>).mock.calls.some((call) => String(call[0]) === '/api/site')).toBe(false);

    const lists = wrapper.findAll('.wish-lane-list');
    expect(lists).toHaveLength(3);
    expect(lists[0].text()).toContain(wantGoFirst.title);
    expect(lists[1].text()).toContain(wantDoFirst.title);
    expect(lists[2].text()).toContain(doneFirst.title);
    expect(wrapper.findAll('[data-wish-create-open]')).toHaveLength(1);
    expect(wrapper.get('[data-wish-create-open]').attributes('aria-label')).toBe('新增清单');
    expect(wrapper.find('[data-group="done"] [data-wish-create-open]').exists()).toBe(false);
    expect(lists[0].findAll('img')).toHaveLength(0);
    expect(wrapper.findAll('.wish-badge')).toHaveLength(0);
    expect(wrapper.findAll('.wish-card__asset')).toHaveLength(0);
    expect(wrapper.text()).not.toContain(wantGoDetail.description);

  });

  it('非 manager 不显示新增贴纸入口', async () => {
    const nonManagerPages = Object.fromEntries(
      Object.entries(wishPageResponses).map(([key, value]) => [key, { ...value, canManage: false }])
    ) as Record<string, WishPageDto>;
    const requestAdapter = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && nonManagerPages[url]) {
        return Promise.resolve(jsonResponse(nonManagerPages[url]));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
    }) as unknown as typeof fetch;

    const wrapper = await mountWishesView(requestAdapter);

    expect(wrapper.find('[data-wish-create-open]').exists()).toBe(false);
  });

  it('右下角新增清单入口使用 WebP 贴纸，并保留分类切换', async () => {
    const wrapper = await mountWishesView(createWishRequestAdapter());

    expect(existsSync(resolve(process.cwd(), 'src/modules/wishes/assets/wish-create-entry.webp'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/modules/wishes/assets/wish-create-dialog-background.webp'))).toBe(true);
    expect(wrapper.get('.wish-create-fab').attributes('aria-label')).toBe('新增清单');
    expect(wrapper.find('.wish-create-fab__image').exists()).toBe(true);

    await wrapper.get('[data-wish-create-open]').trigger('click');

    expect(wrapper.find('[data-wish-create-form]').exists()).toBe(true);
    const dialog = wrapper.get('[data-wish-create-form]');
    expect(dialog.find('.wish-create-dialog__background').exists()).toBe(true);
    expect(dialog.get('[data-wish-category-select="want_go"]').attributes('aria-pressed')).toBe('true');

    await wrapper.get('[data-wish-category-select="want_do"]').trigger('click');

    expect(wrapper.get('[data-wish-category-select="want_do"]').attributes('aria-pressed')).toBe('true');
  });

  it('新增清单弹窗使用背景图并按参考图比例分为左表单和右装饰区', async () => {
    const wrapper = await mountWishesView(createWishRequestAdapter());

    await wrapper.get('[data-wish-create-open]').trigger('click');

    const dialog = wrapper.get('[data-wish-create-form]');

    expect(dialog.find('.wish-create-dialog__content').exists()).toBe(true);
    expect(dialog.find('.wish-create-dialog__left').exists()).toBe(true);
    expect(dialog.find('.wish-create-dialog__divider').exists()).toBe(true);
    expect(dialog.find('.wish-create-dialog__right').exists()).toBe(true);
    expect(dialog.find('.wish-create-dialog__actions').exists()).toBe(true);
    expect(dialog.find('.wish-create-dialog__image').exists()).toBe(false);
    expect(dialog.find('input[type="file"]').exists()).toBe(false);
    expect(dialog.text()).toContain('分类');
    expect(dialog.text()).toContain('标题');
    expect(dialog.text()).toContain('描述');
    expect(dialog.text()).toContain('地点');
    expect(dialog.text()).toContain('预计完成时间');
    expect(dialog.text()).toContain('备注');
    expect(dialog.text()).toContain('0/160');
    expect(dialog.text()).toContain('0/120');
    expect(dialog.text()).toContain('0/500');
  });

  it('在想去板子创建清单后插入栏顶部，不刷新整页', async () => {
    const requestAdapter = createWishRequestAdapter();
    const wrapper = await mountWishesView(requestAdapter);

    await wrapper.get('[data-wish-create-open]').trigger('click');
    await wrapper.get('[data-wish-title-input]').setValue('新想去的地方');
    await wrapper.get('[data-wish-create-form]').trigger('submit');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(requestAdapter).toHaveBeenCalledWith('/api/wishes', expect.objectContaining({ method: 'POST' }));
    const createCall = (requestAdapter as ReturnType<typeof vi.fn>).mock.calls.find(([url, init]) => url === '/api/wishes' && init?.method === 'POST');
    await expect(readWishCreatePayload(createCall?.[1])).resolves.toMatchObject({ title: '新想去的地方', category: 'want_go' });
    const wantGoRows = wrapper.findAll('.wish-lane-list')[0].findAll('.wish-lane-item');
    expect(wantGoRows[0].text()).toContain('新想去的地方');
    expect((requestAdapter as ReturnType<typeof vi.fn>).mock.calls.filter((call) => String(call[0]).includes('category=want_go'))).toHaveLength(1);
  });

  it('新增弹窗切换为想做后插入想做栏顶部', async () => {
    const requestAdapter = createWishRequestAdapter();
    const wrapper = await mountWishesView(requestAdapter);

    await wrapper.get('[data-wish-create-open]').trigger('click');
    await wrapper.get('[data-wish-category-select="want_do"]').trigger('click');
    await wrapper.get('[data-wish-title-input]').setValue('新想做的事');
    await wrapper.get('[data-wish-create-form]').trigger('submit');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const createCall = (requestAdapter as ReturnType<typeof vi.fn>).mock.calls.find(([url, init]) => url === '/api/wishes' && init?.method === 'POST');
    await expect(readWishCreatePayload(createCall?.[1])).resolves.toMatchObject({ title: '新想做的事', category: 'want_do' });
    const wantDoRows = wrapper.findAll('.wish-lane-list')[1].findAll('.wish-lane-item');
    expect(wantDoRows[0].text()).toContain('新想做的事');
  });

  it('三栏触底分页互不影响，hasMore=false 后停止请求', async () => {
    const requestAdapter = createWishRequestAdapter();
    const wrapper = await mountWishesView(requestAdapter);
    const wantGoList = mockScrollableWishLane(wrapper, 0);

    await wantGoList.trigger('scroll');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(requestAdapter).toHaveBeenCalledWith('/api/wishes?category=want_go&completed=false&page=2&size=8', {
      headers: { Authorization: 'Bearer jwt-token' }
    });
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(wantGoSecondPage.title);

    await wantGoList.trigger('scroll');
    await flushPromises();
    expect((requestAdapter as ReturnType<typeof vi.fn>).mock.calls.filter((call) => String(call[0]).includes('page=3'))).toHaveLength(0);
    expect((requestAdapter as ReturnType<typeof vi.fn>).mock.calls.filter((call) => String(call[0]).includes('category=want_do'))).toHaveLength(1);
  });

  it('首屏列表不足以产生滚动条时自动补下一页，不必等待 scroll 事件', async () => {
    mockUnderfilledWishLists();
    const requestAdapter = createWishRequestAdapter();
    const wrapper = await mountWishesView(requestAdapter);

    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(requestAdapter).toHaveBeenCalledWith('/api/wishes?category=want_go&completed=false&page=2&size=8', {
      headers: { Authorization: 'Bearer jwt-token' }
    });
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(wantGoSecondPage.title);
    expect((requestAdapter as ReturnType<typeof vi.fn>).mock.calls.filter((call) => String(call[0]).includes('page=3'))).toHaveLength(0);
    expect((requestAdapter as ReturnType<typeof vi.fn>).mock.calls.filter((call) => String(call[0]).includes('category=want_do'))).toHaveLength(1);
  });

  it('首屏连续多页仍不足滚动高度时持续补页，直到可滚动或没有下一页', async () => {
    mockUnderfilledWishLists();
    const pageResponses = {
      ...wishPageResponses,
      '/api/wishes?category=want_go&completed=false&page=2&size=8': {
        ...wishPageResponses['/api/wishes?category=want_go&completed=false&page=2&size=8'],
        total: 10,
        hasMore: true
      },
      '/api/wishes?category=want_go&completed=false&page=3&size=8': {
        items: [wantGoThirdPage],
        total: 10,
        page: 3,
        size: 8,
        hasMore: false,
        canManage: true
      }
    };
    const requestAdapter = createWishRequestAdapter(pageResponses);
    const wrapper = await mountWishesView(requestAdapter);

    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    const wantGoLane = wrapper.findAll('.wish-lane-list')[0];
    expect(wantGoLane.text()).toContain(wantGoSecondPage.title);
    expect(wantGoLane.text()).toContain(wantGoThirdPage.title);
    expect(
      (requestAdapter as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => String(call[0]).includes('category=want_go')
      )
    ).toHaveLength(3);
  });

  it('本地新增触发第一页重置后，列表仍不足一屏时继续补第二页', async () => {
    const baseRequestAdapter = createWishRequestAdapter();
    let created = false;
    const createdWish: WishSummaryDto = {
      ...wantGoFirst,
      id: 150,
      title: '新增后继续补页',
      createdAt: '2026-05-25T12:00:00'
    };
    const requestAdapter = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (
          created &&
          method === 'GET' &&
          url === '/api/wishes?category=want_go&completed=false&page=1&size=8'
        ) {
          return jsonResponse({
            ...wishPageResponses[url],
            items: [createdWish, wantGoFirst],
            total: 10
          });
        }

        const response = await baseRequestAdapter(input, init);
        if (url === '/api/wishes' && method === 'POST') {
          created = true;
        }
        return response;
      }
    ) as unknown as typeof fetch;
    const wrapper = await mountWishesView(requestAdapter);
    mockUnderfilledWishLists();

    await wrapper.get('[data-wish-create-open]').trigger('click');
    await wrapper.get('[data-wish-title-input]').setValue(createdWish.title);
    await wrapper.get('[data-wish-create-form]').trigger('submit');

    await vi.waitFor(() => {
      expect(
        vi.mocked(requestAdapter).mock.calls
          .filter(
            ([url, init]) =>
              (init?.method ?? 'GET') === 'GET' &&
              String(url).includes('category=want_go')
          )
          .map(([url]) => String(url))
      ).toEqual([
        '/api/wishes?category=want_go&completed=false&page=1&size=8',
        '/api/wishes?category=want_go&completed=false&page=1&size=8',
        '/api/wishes?category=want_go&completed=false&page=2&size=8'
      ]);
    });
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(
      wantGoSecondPage.title
    );
  });

  it('补页在途期间新增时加入同一请求，重置第一页后继续补第二页', async () => {
    let underfilled = false;
    vi.spyOn(
      HTMLElement.prototype,
      'clientHeight',
      'get'
    ).mockImplementation(function getClientHeight(this: HTMLElement) {
      return this.classList?.contains('wish-lane-list') ? 260 : 0;
    });
    vi.spyOn(
      HTMLElement.prototype,
      'scrollHeight',
      'get'
    ).mockImplementation(function getScrollHeight(this: HTMLElement) {
      if (!this.classList?.contains('wish-lane-list')) {
        return 0;
      }
      return underfilled
        ? this.querySelectorAll('.wish-lane-item').length * 44
        : 590;
    });

    const stalePageTwo = deferred<ReturnType<typeof jsonResponse>>();
    const createResponse = deferred<ReturnType<typeof jsonResponse>>();
    const baseRequestAdapter = createWishRequestAdapter();
    const createdWish: WishSummaryDto = {
      ...wantGoFirst,
      id: 150,
      title: '并发补页时新增',
      createdAt: '2026-05-25T12:00:00'
    };
    let created = false;
    let pageTwoRequestCount = 0;
    const requestAdapter = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (
          method === 'GET' &&
          url === '/api/wishes?category=want_go&completed=false&page=1&size=8' &&
          created
        ) {
          return jsonResponse({
            ...wishPageResponses[url],
            items: [createdWish, wantGoFirst],
            total: 10,
            hasMore: true
          });
        }
        if (
          method === 'GET' &&
          url === '/api/wishes?category=want_go&completed=false&page=2&size=8'
        ) {
          pageTwoRequestCount += 1;
          if (pageTwoRequestCount === 1) {
            return stalePageTwo.promise;
          }
        }
        if (url === '/api/wishes' && method === 'POST') {
          return createResponse.promise.then((response) => {
            created = true;
            return response;
          });
        }

        const response = await baseRequestAdapter(input, init);
        return response;
      }
    ) as unknown as typeof fetch;
    const wrapper = await mountWishesView(requestAdapter);
    const wantGoList = wrapper.findAll('.wish-lane-list')[0];
    Object.defineProperty(wantGoList.element, 'scrollTop', {
      configurable: true,
      value: 360
    });

    await wantGoList.trigger('scroll');
    await vi.waitFor(() => expect(pageTwoRequestCount).toBe(1));
    underfilled = true;

    await wrapper.get('[data-wish-create-open]').trigger('click');
    await wrapper.get('[data-wish-title-input]').setValue(createdWish.title);
    await wrapper.get('[data-wish-create-form]').trigger('submit');
    await vi.waitFor(() => {
      expect(
        vi.mocked(requestAdapter).mock.calls.some(
          ([url, init]) =>
            String(url) === '/api/wishes' && init?.method === 'POST'
        )
      ).toBe(true);
    });
    createResponse.resolve(jsonResponse(createdWish));
    await vi.waitFor(() => {
      expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(
        createdWish.title
      );
    });
    await flushPromises();

    stalePageTwo.resolve(
      jsonResponse({
        ...wishPageResponses[
          '/api/wishes?category=want_go&completed=false&page=2&size=8'
        ]
      })
    );

    await vi.waitFor(() => {
      expect(
        vi.mocked(requestAdapter).mock.calls
          .filter(
            ([url, init]) =>
              (init?.method ?? 'GET') === 'GET' &&
              String(url).includes('category=want_go')
          )
          .map(([url]) => String(url))
      ).toEqual([
        '/api/wishes?category=want_go&completed=false&page=1&size=8',
        '/api/wishes?category=want_go&completed=false&page=2&size=8',
        '/api/wishes?category=want_go&completed=false&page=1&size=8',
        '/api/wishes?category=want_go&completed=false&page=2&size=8'
      ]);
    });
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(
      createdWish.title
    );
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(
      wantGoSecondPage.title
    );
  });

  it('保存请求未完成时禁止关闭新增弹窗，响应只关闭原表单', async () => {
    const createResponse = deferred<ReturnType<typeof jsonResponse>>();
    const baseRequestAdapter = createWishRequestAdapter();
    const createdWish: WishSummaryDto = {
      ...wantGoFirst,
      id: 150,
      title: '慢请求新增',
      createdAt: '2026-05-25T12:00:00'
    };
    const requestAdapter = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/api/wishes' && init?.method === 'POST') {
          return createResponse.promise;
        }
        return baseRequestAdapter(input, init);
      }
    ) as unknown as typeof fetch;
    const wrapper = await mountWishesView(requestAdapter);

    await wrapper.get('[data-wish-create-open]').trigger('click');
    await wrapper.get('[data-wish-title-input]').setValue(createdWish.title);
    await wrapper.get('[data-wish-create-form]').trigger('submit');
    await vi.waitFor(() => {
      expect(
        vi.mocked(requestAdapter).mock.calls.some(
          ([url, init]) =>
            String(url) === '/api/wishes' && init?.method === 'POST'
        )
      ).toBe(true);
    });

    const cancelButton = wrapper.get('.wish-create-dialog__cancel');
    expect(cancelButton.attributes('disabled')).toBeDefined();
    await cancelButton.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-wish-create-form]').exists()).toBe(true);
    expect(
      (wrapper.get('[data-wish-title-input]').element as HTMLInputElement).value
    ).toBe(createdWish.title);

    createResponse.resolve(jsonResponse(createdWish));
    await vi.waitFor(() => {
      expect(wrapper.find('[data-wish-create-form]').exists()).toBe(false);
    });
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(
      createdWish.title
    );
  });

  it('初载栏失败时保留其他栏并显示错误，不会自动跳过失败栏第一页', async () => {
    mockUnderfilledWishLists();
    const requestAdapter = createWishRequestAdapterWithInitialLaneError();
    const wrapper = await mountWishesView(requestAdapter);

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('想做清单暂时不可用');
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(wantGoFirst.title);
    expect(wrapper.findAll('.wish-lane-list')[2].text()).toContain(doneFirst.title);
    expect(
      (requestAdapter as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) =>
          String(url) ===
          '/api/wishes?category=want_do&completed=false&page=2&size=8'
      )
    ).toBe(false);
  });

  it('点击列表行后请求详情并打开横向详情弹窗，支持关闭和图片预览', async () => {
    const requestAdapter = createWishRequestAdapter();
    const wrapper = await mountWishesView(requestAdapter);

    await openFirstWish(wrapper);

    expect(requestAdapter).toHaveBeenCalledWith('/api/wishes/101', {
      headers: { Authorization: 'Bearer jwt-token' }
    });
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('data-wish-lane')).toBe('wantToGo');
    expect(dialog.text()).toContain(wantGoDetail.title);
    expect(dialog.text()).toContain(wantGoDetail.description);
    expect(dialog.text()).toContain(wantGoDetail.locationName);
    expect(dialog.text()).toContain('2026-06-01T18:00:00');
    expect(dialog.text()).not.toContain('想去');
    expect(wrapper.find('.wish-detail-dialog__action--edit').exists()).toBe(false);
    expect(wrapper.find('.wish-detail-dialog__action--delete').exists()).toBe(false);

    await wrapper.get('.wish-detail-dialog__image-button').trigger('click');
    await settleWishMotion(wrapper);
    expect(wrapper.get('.wish-image-preview__image').attributes('src')).toBe(wantGoDetail.imageUrl);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settleWishMotion(wrapper);
    expect(wrapper.find('.wish-image-preview').exists()).toBe(false);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);

    const closeButton = wrapper.get('.wish-detail-dialog__close');
    await Promise.all([closeButton.trigger('click'), closeButton.trigger('click')]);
    await settleWishMotion(wrapper);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('详情请求失败时在清单页显示稳定错误提示', async () => {
    const wrapper = await mountWishesView(createWishRequestAdapterWithDetailError());

    await openFirstWish(wrapper);

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.get('.wish-page-alerts').text()).toContain('清单详情暂时不可用');
  });

  it('完成和撤回都调用后端，并按接口返回摘要移动条目', async () => {
    const wrapper = await mountWishesView(createWishRequestAdapter());

    await openFirstWish(wrapper);
    await wrapper.get('button.wish-completion-badge').trigger('click');
    await selectCompletionImage(wrapper);
    await settleWishMotion(wrapper);

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.findAll('.wish-lane-list')[0].text()).not.toContain(wantGoFirst.title);
    expect(wrapper.findAll('.wish-lane-list')[2].text()).toContain(wantGoFirst.title);

    await openFirstWish(wrapper, 2, 1);
    const doneDialog = wrapper.get('[role="dialog"]');
    expect(doneDialog.text()).toContain(completedWishDetail.title);
    expect(wrapper.get('button.wish-completion-badge--done').text()).toContain('撤回完成');

    await wrapper.get('button.wish-completion-badge--done').trigger('click');
    await settleWishMotion(wrapper);

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.findAll('.wish-lane-list')[2].text()).not.toContain(doneFirst.title);
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(doneFirst.title);
  });

  it('接口错误展示中文 message，页面不显示 undefined/null/NaN', async () => {
    const wrapper = await mountWishesView(createWishRequestAdapterWithCompleteError());

    await openFirstWish(wrapper);
    await wrapper.get('button.wish-completion-badge').trigger('click');
    await selectCompletionImage(wrapper);
    await settleWishMotion(wrapper);

    expect(wrapper.text()).toContain('这个清单已经完成了');
    expect(wrapper.text()).not.toMatch(/undefined|null|NaN/);
  });

});
