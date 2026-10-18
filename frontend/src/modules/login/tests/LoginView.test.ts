import { invalidateSession } from '../../../auth';
import { resolve } from 'node:path';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '../../../App.vue';
import LoginView from '..';
import { routes } from '../../../router';
import { resetHomeLifecycleForTests } from '../../home/internal/useHomeLifecycle';
import { homeOverviewFixture } from '../../home/tests/support/homeOverviewFixture';

enableAutoUnmount(afterEach);

function mockAppFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url === '/api/auth/login') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'jwt-token',
            user: { id: 1, username: 'lover', displayName: '小夏' }
          })
      });
    }

    if (url === '/api/home') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(homeOverviewFixture) });
    }

    if (url === '/api/update-notice') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ shouldShow: false, notice: null }) });
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`));
  }) as unknown as typeof fetch;
}

async function mountApp(path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push(path);
  await router.isReady();
  return {
    router,
    wrapper: mount(App, { global: { plugins: [router] } })
  };
}

describe('LoginView', () => {
  beforeEach(() => {
    localStorage.clear();
    resetHomeLifecycleForTests();
    vi.unstubAllGlobals();
  });

  it('默认关闭台灯并隐藏登录表单，开灯后显示表单', async () => {
    const wrapper = mount(LoginView, {
      props: { onAuthenticated: vi.fn() }
    });

    expect(wrapper.get('.login-page').classes()).toContain('is-lamp-off');
    expect(wrapper.get('form.login-form').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('.login-footer').text()).toContain(String(new Date().getFullYear()));
    expect(wrapper.get('.login-footer').text()).toContain('Snowlit');

    await wrapper.get('[data-testid="lamp-pull-knob"]').trigger('click');

    expect(wrapper.get('.login-page').classes()).toContain('is-lamp-on');
    expect(wrapper.get('form.login-form').attributes('aria-hidden')).toBe('false');
  });

  it('台灯使用吊灯造型且不显示手型提示', () => {
    const wrapper = mount(LoginView, {
      props: { onAuthenticated: vi.fn() }
    });

    expect(wrapper.find('.lamp-hanger').exists()).toBe(true);
    expect(wrapper.find('.lamp-shade-body').exists()).toBe(true);
    expect(wrapper.find('.lamp-shade-bottom').exists()).toBe(true);
    expect(wrapper.find('.lamp-hand-hint').exists()).toBe(false);
    expect(wrapper.find('.lamp-play-overlay').exists()).toBe(false);
    expect(wrapper.find('.desk-lamp title').exists()).toBe(false);
    expect(wrapper.get('.desk-lamp').attributes('aria-labelledby')).toBeUndefined();
  });

  it('首次按下拉绳时预热并复用音频上下文，避免开灯释放帧冷启动', async () => {
    const instances: Array<{
      state: string;
      resume: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      createOscillator: ReturnType<typeof vi.fn>;
      createGain: ReturnType<typeof vi.fn>;
      currentTime: number;
      destination: Record<string, never>;
    }> = [];

    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      state = 'suspended';
      resume = vi.fn(() => {
        this.state = 'running';
        return Promise.resolve();
      });
      close = vi.fn(() => {
        this.state = 'closed';
        return Promise.resolve();
      });
      createOscillator = vi.fn(() => ({
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      }));
      createGain = vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn()
      }));

      constructor() {
        instances.push(this);
      }
    }

    vi.stubGlobal('AudioContext', FakeAudioContext);

    const wrapper = mount(LoginView, {
      props: { onAuthenticated: vi.fn() }
    });
    const knob = wrapper.get('[data-testid="lamp-pull-knob"]');

    await knob.trigger('pointerdown');

    expect(instances).toHaveLength(1);
    expect(instances[0].resume).toHaveBeenCalledTimes(1);

    await knob.trigger('click');

    expect(instances).toHaveLength(1);
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1);
    expect(instances[0].close).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('底部日期署名固定在页面底部', () => {
    const wrapper = mount(LoginView, {
      props: { onAuthenticated: vi.fn() }
    });

    expect(wrapper.get('.login-footer').classes()).toContain('login-footer--pinned');
  });

  it('账号或密码为空时提示校验错误且不提交', async () => {
    const onAuthenticated = vi.fn();
    const wrapper = mount(LoginView, {
      props: { onAuthenticated }
    });

    await wrapper.get('form').trigger('submit.prevent');

    expect(wrapper.text()).toContain('请输入账号和密码');
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('提交时显示 loading，失败后显示错误', async () => {
    let resolveLogin!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveLogin = resolve;
          })
      )
    );
    const wrapper = mount(LoginView, {
      props: { onAuthenticated: vi.fn() }
    });

    await wrapper.get('input[name="username"]').setValue('lover');
    await wrapper.get('input[name="password"]').setValue('wrong');
    await wrapper.get('form').trigger('submit.prevent');

    expect(wrapper.get('button[type="submit"]').text()).toBe('登录中...');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();

    resolveLogin(
      new Response(
        JSON.stringify({
          code: 'INVALID_CREDENTIALS',
          message: 'backend detail'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    );
    await flushPromises();

    expect(wrapper.text()).toContain('账号或密码错误');
    expect(wrapper.get('button[type="submit"]').text()).toBe('登录');
  });
});

describe('App auth flow', () => {
  beforeEach(() => {
    localStorage.clear();
    resetHomeLifecycleForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('未登录时只显示登录页', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createRouter({ history: createMemoryHistory(), routes })]
      }
    });

    expect(wrapper.find('form.login-form').exists()).toBe(true);
    expect(wrapper.find('.hero').exists()).toBe(false);
    expect(wrapper.find('.app-topbar').exists()).toBe(false);
  });

  it('未登录用户可以直接浏览 /story 公开沉浸页', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], years: [], canManage: false })
      })
    );

    const { wrapper } = await mountApp('/story');
    await flushPromises();

    expect(wrapper.find('form.login-form').exists()).toBe(false);
    expect(wrapper.find('.app-topbar').exists()).toBe(false);
    expect(wrapper.find('.story-map-page').exists()).toBe(true);
  });

  it('登录成功后写入 localStorage 并进入首页', async () => {
    vi.stubGlobal('fetch', mockAppFetch());

    const { wrapper } = await mountApp();
    await wrapper.get('input[name="username"]').setValue('lover');
    await wrapper.get('input[name="password"]').setValue('secret');
    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(localStorage.getItem('snowlit_token')).toBe('jwt-token');
    expect(wrapper.find('.home-hero-carousel').exists()).toBe(true);
    expect(wrapper.find('form.login-form').exists()).toBe(false);
  });

  it('从子页面登录后回到首页入口', async () => {
    vi.stubGlobal('fetch', mockAppFetch());

    const { router, wrapper } = await mountApp('/messages');
    await wrapper.get('input[name="username"]').setValue('lover');
    await wrapper.get('input[name="password"]').setValue('secret');
    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/');
    expect(wrapper.find('.daily-dashboard').exists()).toBe(true);
    expect(wrapper.find('.directory-grid').exists()).toBe(false);
  });

  it('登录后渲染全局顶栏 logo 且不再显示旧用户入口', async () => {
    localStorage.setItem('snowlit_token', 'jwt-token');
    vi.stubGlobal('fetch', mockAppFetch());

    const { wrapper } = await mountApp();
    await flushPromises();

    const topbar = wrapper.get('.app-topbar');

    expect(topbar.find('.app-topbar__brand').exists()).toBe(true);
    expect(topbar.text()).toContain('Snowlit');
    expect(topbar.text()).not.toContain('LG Demo');
    expect(topbar.find('.app-topbar__brand-mark').exists()).toBe(false);
    expect(topbar.find('.app-topbar__quote').exists()).toBe(false);
    expect(topbar.find('.app-topbar__user').exists()).toBe(false);
    expect(topbar.find('a[href="/user"]').exists()).toBe(false);
  });

  it('401 会话失效事件会清除 token 并回到登录页', async () => {
    localStorage.setItem('snowlit_token', 'expired-token');
    const fetchMock = mockAppFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper } = await mountApp();

    invalidateSession();
    await wrapper.vm.$nextTick();

    expect(localStorage.getItem('snowlit_token')).toBeNull();
    expect(wrapper.find('form.login-form').exists()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/logout', expect.anything());
  });
});
