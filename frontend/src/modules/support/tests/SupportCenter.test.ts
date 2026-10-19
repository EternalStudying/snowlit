import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils';

import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '../../../App.vue';
import { clearAuthToken, setAuthToken } from '../../../auth';
import { resetHomeLifecycleForTests } from '../../home/internal/useHomeLifecycle';
import { routes } from '../../../router';
import { homeOverviewFixture } from '../../home/tests/support/homeOverviewFixture';

enableAutoUnmount(afterEach);

function jsonResponse(payload: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(payload)
  });
}

function createFetchMock(options: { notice?: unknown; noticeOk?: boolean; noticeUnauthorized?: boolean } = {}) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === '/api/home') {
      return jsonResponse(homeOverviewFixture);
    }

    if (url.startsWith('/api/albums')) {
      return jsonResponse({ items: [], total: 0, page: 1, size: 5, hasMore: false, canManage: false });
    }

    if (url.startsWith('/api/story/moments')) {
      return jsonResponse({ items: [], years: [], canManage: false });
    }

    if (url === '/api/update-notice') {
      if (options.noticeUnauthorized) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' })
        });
      }
      if (options.noticeOk === false) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'fail' }) });
      }
      return jsonResponse(
        options.notice ?? {
          shouldShow: true,
          notice: {
            id: 1,
            title: '更新小纸条',
            version: '2026.05.17',
            publishedAt: '2026-05-17T20:00:00',
            items: ['首页已接入真实数据', '日记页支持图片上传']
          }
        }
      );
    }

    if (url === '/api/update-notice/mute-today') {
      return jsonResponse({ mutedUntil: '2026-05-17T23:59:59' });
    }

    if (url === '/api/feedback/screenshots') {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
      return jsonResponse({ url: 'https://cdn.example.com/feedback/shot.webp' });
    }

    if (url === '/api/feedback') {
      expect(init?.method).toBe('POST');
      return jsonResponse({ id: 8, status: 'pending', createdAt: '2026-05-17T20:30:00' });
    }

    if (url === '/api/auth/login') {
      return jsonResponse({ token: 'jwt-token', user: { id: 1, username: 'demo_a', displayName: '伴侣 A' } });
    }

    return jsonResponse({ shouldShow: false, notice: null });
  }) as unknown as typeof fetch;
}

async function mountApp(path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

function getBodyTestElement<T extends HTMLElement>(testId: string): T {
  const element = document.body.querySelector<T>(`[data-testid="${testId}"]`);
  expect(element).not.toBeNull();

  return element as T;
}

async function inputBodyValue(testId: string, value: string) {
  const element = getBodyTestElement<HTMLInputElement | HTMLTextAreaElement>(testId);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
}

async function selectBodyValue(testId: string, value: string) {
  const element = getBodyTestElement<HTMLSelectElement>(testId);
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
  await flushPromises();
}

describe('SupportCenter integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetHomeLifecycleForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAuthToken();
    sessionStorage.clear();
    resetHomeLifecycleForTests();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('登录后请求更新公告并可确认关闭本次弹窗', async () => {
    setAuthToken('jwt-token');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await mountApp();

    expect(document.body.textContent).toContain('更新小纸条');
    expect(document.body.textContent).toContain('日记页支持图片上传');
    expect(document.body.contains(getBodyTestElement<HTMLElement>('update-notice-dialog'))).toBe(true);

    getBodyTestElement<HTMLButtonElement>('update-notice-confirm').click();
    await flushPromises();
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="update-notice-dialog"]')).toBeNull());

    expect(document.body.textContent).not.toContain('更新小纸条');
  });

  it('确认过的同一公告在从点滴沉浸页返回后不再重复弹出', async () => {
    setAuthToken('jwt-token');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const { router } = await mountApp();

    getBodyTestElement<HTMLButtonElement>('update-notice-confirm').click();
    await flushPromises();
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="update-notice-dialog"]')).toBeNull());

    await router.push('/story');
    await flushPromises();
    await router.push('/');
    await flushPromises();

    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-testid="update-notice-dialog"]')).toBeNull();
    });
    expect(document.body.textContent).not.toContain('更新小纸条');
  });

  it('今日不再提示会调用后端并关闭公告弹窗', async () => {
    setAuthToken('jwt-token');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await mountApp();

    getBodyTestElement<HTMLButtonElement>('update-notice-mute').click();
    await flushPromises();

    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="update-notice-dialog"]')).toBeNull());
    expect(document.body.textContent).not.toContain('更新小纸条');
  });

  it('公告获取失败不阻塞应用且不弹窗', async () => {
    setAuthToken('jwt-token');
    vi.stubGlobal('fetch', createFetchMock({ noticeOk: false }));

    const { wrapper } = await mountApp();

    expect(wrapper.find('.journal-hero-carousel').exists()).toBe(true);
    expect(document.body.querySelector('[data-testid="update-notice-dialog"]')).toBeNull();
  });

  it('公告请求收到普通 401 时统一失效会话并返回登录页', async () => {
    setAuthToken('jwt-token');
    vi.stubGlobal('fetch', createFetchMock({ noticeUnauthorized: true }));

    const { wrapper } = await mountApp();
    await flushPromises();

    expect(localStorage.getItem('snowlit_token')).toBeNull();
    expect(wrapper.find('form.login-form').exists()).toBe(true);
    expect(document.body.querySelector('[data-testid="update-notice-dialog"]')).toBeNull();
  });

  it('登录后显示反馈入口并能上传截图提交反馈', async () => {
    setAuthToken('jwt-token');
    const fetchMock = createFetchMock({ notice: { shouldShow: false, notice: null } });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { userAgent: 'Vitest Edge' });

    const { wrapper } = await mountApp('/album');

    expect(wrapper.find('[data-testid="feedback-entry"]').exists()).toBe(true);
    const feedbackEntry = wrapper.get('[data-testid="feedback-entry"]');
    const topbarActions = wrapper.get('.app-topbar__story-actions');
    const topbarButtons = topbarActions.findAll('button');
    expect(topbarActions.find('[data-testid="feedback-entry"]').exists()).toBe(true);
    expect(topbarButtons.at(2)?.attributes('data-testid')).toBe('feedback-entry');
    expect(feedbackEntry.classes()).toContain('app-topbar__feedback-entry');
    expect(feedbackEntry.text()).toBe('');
    expect(feedbackEntry.find('.app-topbar__entry-icon svg').exists()).toBe(true);
    await wrapper.get('[data-testid="feedback-entry"]').trigger('click');
    expect(document.body.contains(getBodyTestElement<HTMLElement>('feedback-dialog'))).toBe(true);
    expect(getBodyTestElement<HTMLElement>('feedback-type')).toBeTruthy();
    await inputBodyValue('feedback-title', '相册按钮问题');
    await inputBodyValue('feedback-content', '点击后没有反应');
    await inputBodyValue('feedback-contact', '微信：abc');

    const fileInput = getBodyTestElement<HTMLInputElement>('feedback-screenshot-input');
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['png'], 'shot.png', { type: 'image/png' })],
      configurable: true
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    getBodyTestElement<HTMLButtonElement>('feedback-submit').click();
    await flushPromises();
    await vi.waitFor(() => {
      const dialog = document.body.querySelector<HTMLElement>('[data-testid="feedback-dialog"]');
      expect(dialog === null || dialog.style.display === 'none').toBe(true);
    });

    expect(document.body.textContent).toContain('反馈已提交');
  });

  it('关闭反馈弹窗后再次打开会清空已上传截图', async () => {
    setAuthToken('jwt-token');
    const fetchMock = createFetchMock({ notice: { shouldShow: false, notice: null } });
    vi.stubGlobal('fetch', fetchMock);

    const { wrapper } = await mountApp('/album');

    await wrapper.get('[data-testid="feedback-entry"]').trigger('click');
    expect(document.body.contains(getBodyTestElement<HTMLElement>('feedback-dialog'))).toBe(true);

    const fileInput = getBodyTestElement<HTMLInputElement>('feedback-screenshot-input');
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['png'], 'shot.png', { type: 'image/png' })],
      configurable: true
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(document.body.textContent).toContain('shot.webp');

    const cancelButton = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('取消')
    );
    expect(cancelButton).toBeTruthy();
    cancelButton?.click();
    await flushPromises();

    await wrapper.get('[data-testid="feedback-entry"]').trigger('click');
    await flushPromises();

    expect(document.body.contains(getBodyTestElement<HTMLElement>('feedback-dialog'))).toBe(true);
    expect(document.body.textContent).not.toContain('shot.webp');
    expect(vi.mocked(fetchMock).mock.calls.filter(([url]) => String(url) === '/api/feedback/screenshots')).toHaveLength(1);
  });

  it('登录页不显示公告弹窗和反馈入口', async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const { wrapper } = await mountApp();

    expect(wrapper.find('form.login-form').exists()).toBe(true);
    expect(document.body.querySelector('[data-testid="update-notice-dialog"]')).toBeNull();
    expect(wrapper.find('[data-testid="feedback-entry"]').exists()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/update-notice', expect.anything());
  });
});
