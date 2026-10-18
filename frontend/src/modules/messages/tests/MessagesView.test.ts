import { flushPromises, mount } from '@vue/test-utils';

import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import MessagesView from '../MessagesView.vue';
import { routes } from '../../../router';
import { clearAuthToken, setAuthToken } from '../../../auth';

const pagePayload = {
  items: [
    {
      id: 8,
      authorUserId: 1,
      authorName: 'Luna',
      content: '今天路过那家花店，买了你最爱的白色洋桔梗。',
      imageUrl: null,
      createdAt: '2026-05-27T10:28:00',
      canDelete: true
    },
    {
      id: 7,
      authorUserId: 2,
      authorName: 'Ming',
      content: '刚下班，在回家的路上。',
      imageUrl: 'https://cdn.example.com/messages/evening.webp',
      createdAt: '2026-05-26T22:47:00',
      canDelete: false
    }
  ],
  total: 2,
  page: 1,
  size: 20,
  hasMore: false
};

function okJson(payload: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload)
  } as Response);
}

function createMessagesFetch(payload: unknown = pagePayload) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith('/api/messages') && (!init || init.method === undefined || init.method === 'GET')) {
      return okJson(payload);
    }

    if (url === '/api/messages' && init?.method === 'POST') {
      return okJson({
        id: 9,
        authorUserId: 1,
        authorName: 'Luna',
        content: '新写下的一句话',
        imageUrl: null,
        createdAt: '2026-05-27T21:00:00',
        canDelete: true
      });
    }

    if (url === '/api/messages/8' && init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, status: 204 } as Response);
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${JSON.stringify(init)}`));
  });
}

function stubMatchMedia(reduced = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true
  })));
}

async function mountMessages(fetcher = createMessagesFetch(), options: { reducedMotion?: boolean } = {}) {
  setAuthToken('jwt-token');
  stubMatchMedia(options.reducedMotion ?? false);
  vi.stubGlobal('fetch', fetcher);

  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push('/messages');
  await router.isReady();

  const wrapper = mount(MessagesView, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        RouterLink: true
      }
    }
  });
  await flushPromises();
  return { wrapper, fetcher };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearAuthToken();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('/messages 气泡漂流留言墙', () => {
  it('加载后渲染气泡墙并继续携带 Authorization 请求留言接口', async () => {
    const { wrapper, fetcher } = await mountMessages();

    expect(wrapper.find('[data-page-placeholder="messages"]').exists()).toBe(false);
    expect(wrapper.get('[data-page="messages"]').text()).not.toContain('Message Board');
    expect(wrapper.find('.messages-hero').exists()).toBe(false);
    expect(wrapper.find('[data-message-bubble-wall]').exists()).toBe(true);
    expect(wrapper.find('.messages-list').exists()).toBe(false);
    expect(wrapper.findAll('[data-message-bubble]')).toHaveLength(2);
    expect(wrapper.get('[data-message-bubble="8"]').text()).toContain('今天路过那家花店');
    expect(fetcher).toHaveBeenCalledWith('/api/messages?page=1&size=20', expect.objectContaining({
      headers: { Authorization: 'Bearer jwt-token' }
    }));
  });

  it('气泡使用 content 字段展示摘要，带 imageUrl 时只显示附件标记不渲染图片', async () => {
    const { wrapper } = await mountMessages();

    const bubble = wrapper.get('[data-message-bubble="7"]');
    expect(bubble.text()).toContain('刚下班，在回家的路上。');
    expect(bubble.find('img').exists()).toBe(false);
    expect(bubble.find('[data-message-attachment]').exists()).toBe(true);
  });

  it('点击气泡先播放破裂动画，动画结束后打开详情弹窗', async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountMessages();

    await wrapper.get('[data-message-bubble="8"]').trigger('click');
    expect(wrapper.get('[data-message-bubble="8"]').classes()).toContain('is-bursting');

    vi.advanceTimersByTime(420);
    await flushPromises();

    expect(document.body.textContent).toContain('今天路过那家花店，买了你最爱的白色洋桔梗。');
    expect(document.body.querySelector('[data-message-detail-modal]')).not.toBeNull();
  });

  it('详情弹窗只按 canDelete 显示删除按钮', async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountMessages();

    await wrapper.get('[data-message-bubble="7"]').trigger('click');
    vi.advanceTimersByTime(420);
    await flushPromises();
    expect(document.body.textContent).toContain('刚下班，在回家的路上。');
    expect(document.body.querySelector('[data-message-detail-delete]')).toBeNull();

    document.body.querySelector<HTMLButtonElement>('[data-message-detail-close]')?.click();
    await flushPromises();

    await wrapper.get('[data-message-bubble="8"]').trigger('click');
    vi.advanceTimersByTime(420);
    await flushPromises();
    expect(document.body.querySelector('[data-message-detail-delete]')).not.toBeNull();
  });

  it('详情弹窗在完整文字下方直接展示留言图片', async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountMessages();

    await wrapper.get('[data-message-bubble="7"]').trigger('click');
    vi.advanceTimersByTime(420);
    await flushPromises();

    const detailImage = document.body.querySelector<HTMLImageElement>('[data-message-detail-image]');
    expect(document.body.textContent).toContain('刚下班，在回家的路上。');
    expect(document.body.textContent).not.toContain('图片附件');
    expect(detailImage).not.toBeNull();
    expect(detailImage?.getAttribute('src')).toBe('https://cdn.example.com/messages/evening.webp');
  });

  it('删除成功后调用 DELETE 接口并从当前气泡列表移除', async () => {
    vi.useFakeTimers();
    const { wrapper, fetcher } = await mountMessages();

    await wrapper.get('[data-message-bubble="8"]').trigger('click');
    vi.advanceTimersByTime(420);
    await flushPromises();
    document.body.querySelector<HTMLButtonElement>('[data-message-detail-delete]')?.click();
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/messages/8', expect.objectContaining({ method: 'DELETE' }));
    expect(wrapper.find('[data-message-bubble="8"]').exists()).toBe(false);
  });

  it('发布成功后调用 POST、新增留言并清空输入', async () => {
    const { wrapper, fetcher } = await mountMessages();

    await wrapper.get('[data-message-input]').setValue('新写下的一句话');
    await wrapper.get('[data-message-submit]').trigger('click');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith('/api/messages', expect.objectContaining({ method: 'POST' }));
    expect(wrapper.findAll('[data-message-bubble]')[0].text()).toContain('新写下的一句话');
    expect((wrapper.get('[data-message-input]').element as HTMLTextAreaElement).value).toBe('');
  });

  it('发布失败后显示错误并保留输入文字和已选图片', async () => {
    const failedFetch = createMessagesFetch();
    failedFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/messages' && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: '发布失败' })
        } as Response);
      }
      return createMessagesFetch()(input, init);
    });
    const { wrapper } = await mountMessages(failedFetch);

    const file = new File(['image'], 'message.webp', { type: 'image/webp' });
    Object.defineProperty(wrapper.get('[data-message-image-input]').element, 'files', {
      configurable: true,
      value: [file]
    });
    await wrapper.get('[data-message-image-input]').trigger('change');
    await wrapper.get('[data-message-input]').setValue('保留这句话');
    await wrapper.get('[data-message-submit]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('发布失败');
    expect((wrapper.get('[data-message-input]').element as HTMLTextAreaElement).value).toBe('保留这句话');
    expect(wrapper.text()).toContain('message.webp');
  });

  it('空文本发布提示先写一点想说的话', async () => {
    const { wrapper } = await mountMessages();

    await wrapper.get('[data-message-input]').setValue('   ');
    await wrapper.get('[data-message-submit]').trigger('click');

    expect(wrapper.text()).toContain('先写一点想说的话');
  });

  it('暂停和继续漂浮按钮能切换全局漂浮状态', async () => {
    const { wrapper } = await mountMessages();

    expect(wrapper.get('[data-message-float-toggle]').text()).toContain('暂停漂浮');
    await wrapper.get('[data-message-float-toggle]').trigger('click');

    expect(wrapper.get('[data-message-float-toggle]').text()).toContain('继续漂浮');
    expect(wrapper.get('[data-message-bubble-wrapper="8"]').classes()).toContain('is-paused');
  });

  it('reduced-motion 下不启用持续漂浮动画', async () => {
    const { wrapper } = await mountMessages(createMessagesFetch(), { reducedMotion: true });

    expect(wrapper.get('[data-message-bubble-wrapper="8"]').classes()).toContain('is-static');
    expect(wrapper.get('[data-message-bubble-wrapper="8"]').attributes('style')).toContain('--duration: 0s');
  });

  it('每次进入页面重新随机气泡布局，但当前页面会话内不跳位', async () => {
    const firstRandom = vi.spyOn(Math, 'random').mockReturnValue(0.12);
    const first = await mountMessages();
    const firstStyle = first.wrapper.get('[data-message-bubble-wrapper="8"]').attributes('style');
    await first.wrapper.get('[data-message-input]').setValue('触发一次响应式刷新');
    await flushPromises();
    expect(first.wrapper.get('[data-message-bubble-wrapper="8"]').attributes('style')).toBe(firstStyle);
    first.wrapper.unmount();
    firstRandom.mockRestore();
    document.body.innerHTML = '';

    const secondRandom = vi.spyOn(Math, 'random').mockReturnValue(0.82);
    const second = await mountMessages();
    const secondStyle = second.wrapper.get('[data-message-bubble-wrapper="8"]').attributes('style');
    secondRandom.mockRestore();

    expect(secondStyle).not.toBe(firstStyle);
  });

  it('覆盖空态和加载失败后的重试入口', async () => {
    const { wrapper } = await mountMessages(createMessagesFetch({ ...pagePayload, items: [], total: 0 }));
    expect(wrapper.text()).toContain('还没有留言气泡');

    const failingFetch = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(() => okJson(pagePayload));
    const retry = await mountMessages(failingFetch);
    expect(retry.wrapper.text()).toContain('留言请求失败');
    await retry.wrapper.get('[data-message-retry]').trigger('click');
    await flushPromises();
    expect(retry.wrapper.findAll('[data-message-bubble]')).toHaveLength(2);
  });
});
