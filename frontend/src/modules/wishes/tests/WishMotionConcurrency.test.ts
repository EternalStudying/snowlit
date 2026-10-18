import { flushPromises, mount } from '@vue/test-utils';
import { gsap } from 'gsap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  WishDetailDto,
  WishPageDto,
  WishSummaryDto
} from '../model';
import { clearAuthToken, setAuthToken } from '../../../auth';
import { setInstantMotion } from '../../../motion';

const pendingWish: WishSummaryDto = {
  id: 1,
  title: '一起看海',
  category: 'want_go',
  completed: false,
  imageUrl: '/wish.webp',
  createdAt: '2026-07-25T10:00:00',
  completedAt: null
};

const pendingWishDetail: WishDetailDto = {
  ...pendingWish,
  description: '等一个晴天出发',
  locationName: '海边',
  latitude: null,
  longitude: null,
  note: null,
  expectedCompletedAt: null,
  updatedAt: pendingWish.createdAt,
  lastOperatedByUserId: null,
  lastOperatedAt: null
};

describe('Wish modal motion concurrency', () => {
  afterEach(() => {
    gsap.globalTimeline.timeScale(1);
    setInstantMotion(true);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearAuthToken();
    document.body.innerHTML = '';
  });

  it('完成成功后的关闭动画被再次关闭时仍提交移栏并释放 pending', async () => {
    installProductionMotionEnvironment();

    const completionResponse = deferred<ReturnType<typeof jsonResponse>>();
    const requestAdapter = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const page = pageResponses[url];
        if (method === 'GET' && page) {
          return Promise.resolve(jsonResponse(page));
        }
        if (url === '/api/wishes/1' && method === 'GET') {
          return Promise.resolve(jsonResponse(pendingWishDetail));
        }
        if (url === '/api/wishes/1/complete' && method === 'POST') {
          return completionResponse.promise;
        }
        return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
      }
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', requestAdapter);

    const { default: WishesView } = await import('../WishesView.vue');
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
    expect(wrapper.attributes('data-wish-gsap')).toBe('true');

    await wrapper.get('[data-wish-id="1"]').trigger('click');
    await waitFor(() => wrapper.find('.wish-detail-dialog').exists());
    await wait(380);

    await wrapper.get('.wish-completion-badge').trigger('click');
    const input = wrapper.get(
      'input[data-wish-complete-image]'
    ).element as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['done'], 'done.jpg', { type: 'image/jpeg' })]
    });
    await wrapper.get('input[data-wish-complete-image]').trigger('change');
    await waitFor(() =>
      vi.mocked(requestAdapter).mock.calls.some(
        ([url]) => String(url) === '/api/wishes/1/complete'
      )
    );

    gsap.globalTimeline.timeScale(0.1);
    completionResponse.resolve(
      jsonResponse({
        ...pendingWish,
        completed: true,
        completedAt: '2026-07-25T20:00:00'
      })
    );
    await wait(20);
    void wrapper.get('.wish-detail-dialog__close').trigger('click');
    gsap.globalTimeline.timeScale(20);
    await waitFor(
      () =>
        wrapper.findAll('.wish-lane-list')[2].text().includes(pendingWish.title),
      1600
    );

    expect(wrapper.findAll('.wish-lane-list')[0].text()).not.toContain(
      pendingWish.title
    );
    expect(wrapper.find('.wish-detail-dialog').exists()).toBe(false);

    wrapper.unmount();
  }, 5000);

  it('新增成功后的关闭动画被再次关闭时仍继续短列表分页恢复', async () => {
    installProductionMotionEnvironment();
    mockUnderfilledWishLists();
    gsap.globalTimeline.timeScale(20);

    const createResponse = deferred<ReturnType<typeof jsonResponse>>();
    let created = false;
    const createdWish: WishSummaryDto = {
      ...pendingWish,
      id: 2,
      title: '新增后继续恢复分页',
      createdAt: '2026-07-26T10:00:00'
    };
    const requestAdapter = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (
          url === '/api/wishes?category=want_go&completed=false&page=1&size=8' &&
          method === 'GET'
        ) {
          return Promise.resolve(
            jsonResponse({
              items: created ? [createdWish, pendingWish] : [pendingWish],
              total: created ? 2 : 1,
              page: 1,
              size: 8,
              hasMore: false,
              canManage: true
            })
          );
        }
        const page = pageResponses[url];
        if (method === 'GET' && page) {
          return Promise.resolve(jsonResponse(page));
        }
        if (url === '/api/wishes' && method === 'POST') {
          return createResponse.promise.then((response) => {
            created = true;
            return response;
          });
        }
        return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
      }
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', requestAdapter);

    const { default: WishesView } = await import('../WishesView.vue');
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

    await wrapper.get('[data-wish-create-open]').trigger('click');
    await waitFor(() => wrapper.find('[data-wish-create-form]').exists());
    await wait(80);
    await wrapper
      .get('[data-wish-title-input]')
      .setValue(createdWish.title);
    await wrapper.get('[data-wish-create-form]').trigger('submit');
    await waitFor(() =>
      vi.mocked(requestAdapter).mock.calls.some(
        ([url, init]) =>
          String(url) === '/api/wishes' && init?.method === 'POST'
      )
    );

    gsap.globalTimeline.timeScale(0.1);
    createResponse.resolve(jsonResponse(createdWish));
    await wait(20);
    void wrapper.get('.wish-create-dialog__cancel').trigger('click');
    gsap.globalTimeline.timeScale(20);

    await waitFor(
      () =>
        vi.mocked(requestAdapter).mock.calls.filter(
          ([url, init]) =>
            String(url) ===
              '/api/wishes?category=want_go&completed=false&page=1&size=8' &&
            (init?.method ?? 'GET') === 'GET'
        ).length === 2,
      1600
    );
    expect(wrapper.find('[data-wish-create-form]').exists()).toBe(false);
    expect(wrapper.findAll('.wish-lane-list')[0].text()).toContain(
      createdWish.title
    );

    wrapper.unmount();
  }, 5000);

  it('新增弹窗关闭期间忽略随后触发的表单提交', async () => {
    installProductionMotionEnvironment();
    gsap.globalTimeline.timeScale(20);

    const requestAdapter = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const page = pageResponses[url];
        if (method === 'GET' && page) {
          return Promise.resolve(jsonResponse(page));
        }
        if (url === '/api/wishes' && method === 'POST') {
          return Promise.resolve(
            jsonResponse({
              ...pendingWish,
              id: 2,
              title: '不应被创建'
            })
          );
        }
        return Promise.reject(new Error(`Unexpected request: ${url}; ${method}`));
      }
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', requestAdapter);

    const { default: WishesView } = await import('../WishesView.vue');
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

    await wrapper.get('[data-wish-create-open]').trigger('click');
    await waitFor(() => wrapper.find('[data-wish-create-form]').exists());
    await wait(80);
    await wrapper.get('[data-wish-title-input]').setValue('取消后不应提交');

    gsap.globalTimeline.timeScale(0.1);
    void wrapper.get('.wish-create-dialog__cancel').trigger('click');
    await wait(20);
    expect(wrapper.find('[data-wish-create-form]').exists()).toBe(true);
    await wrapper.get('[data-wish-create-form]').trigger('submit');
    gsap.globalTimeline.timeScale(20);
    await waitFor(() => !wrapper.find('[data-wish-create-form]').exists());

    expect(
      vi.mocked(requestAdapter).mock.calls.some(
        ([url, init]) =>
          String(url) === '/api/wishes' && init?.method === 'POST'
      )
    ).toBe(false);

    wrapper.unmount();
  }, 5000);
});

const pageResponses: Record<string, WishPageDto> = {
  '/api/wishes?category=want_go&completed=false&page=1&size=8': {
    items: [pendingWish],
    total: 1,
    page: 1,
    size: 8,
    hasMore: false,
    canManage: true
  },
  '/api/wishes?category=want_do&completed=false&page=1&size=8': {
    items: [],
    total: 0,
    page: 1,
    size: 8,
    hasMore: false,
    canManage: true
  },
  '/api/wishes?completed=true&page=1&size=8': {
    items: [],
    total: 0,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function installProductionMotionEnvironment(): void {
  setInstantMotion(false);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 120, 42)
  );
  setAuthToken('jwt-token');
}

function mockUnderfilledWishLists(): void {
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
    return this.querySelectorAll('.wish-lane-item').length * 44;
  });
}

async function waitFor(assertion: () => boolean, timeout = 1000): Promise<void> {
  const startedAt = Date.now();
  while (!assertion()) {
    if (Date.now() - startedAt >= timeout) {
      throw new Error('Timed out waiting for wish motion state');
    }
    await wait(10);
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
