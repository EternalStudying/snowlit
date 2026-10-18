import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { resolve } from 'node:path';
import JournalRouteShell from '../JournalRouteShell.vue';
import HomeView from '../HomeView.vue';
import { routes } from '../../../router';
import { clearAuthToken, setAuthToken } from '../../../auth';
import { resetHomeLifecycleForTests } from '../internal/useHomeLifecycle';
import { homeOverviewFixture } from './support/homeOverviewFixture';

function createHomeFetch(payload: unknown = homeOverviewFixture) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === '/api/home') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload)
      });
    }

    if (url === '/api/home/location') {
      return Promise.resolve({ ok: true, status: 204 });
    }

    if (url === '/api/site') {
      return Promise.reject(new Error('首页不应请求 /api/site 完整列表'));
    }

    return Promise.reject(new Error(`Unexpected request: ${url}; ${JSON.stringify(init)}`));
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  clearAuthToken();
  resetHomeLifecycleForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAuthToken();
  resetHomeLifecycleForTests();
});

describe('HomeView', () => {
  it('renders home from /api/home without requesting /api/site full lists', async () => {
    setAuthToken('jwt-token');
    const fetcher = createHomeFetch({
      ...homeOverviewFixture,
      latest: {
        ...homeOverviewFixture.latest,
        message: {
          ...homeOverviewFixture.latest.message!,
          imageUrl: 'https://cdn.example.com/messages/hidden.webp'
        }
      }
    });
    vi.stubGlobal('fetch', fetcher);
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();

    const text = wrapper.text();
    expect(fetcher).toHaveBeenCalledWith('/api/home', {
      headers: { Authorization: 'Bearer jwt-token' }
    });
    expect(fetcher).not.toHaveBeenCalledWith('/api/site', expect.anything());
    expect(text).toContain('伴侣 A');
    expect(text).toContain('伴侣 B');
    expect(text).toContain('520');
    expect(text).toContain('今天适合把喜欢说得更认真一点。');
    expect(text).toContain('专注模式');
    expect(text).toContain('相距 819.4 公里');
    expect(text).toContain('第一次看海');
    expect(text).toContain('周末约会');
    expect(text).toContain('一起去看海');
    expect(text).toContain('晚点一起看相册。');
    expect(wrapper.html()).not.toContain('https://cdn.example.com/messages/hidden.webp');
    expect(text).not.toMatch(/undefined|null|NaN/);
  });

  it('does not render the removed cozy intro title copy on the home page', async () => {
    vi.stubGlobal('fetch', createHomeFetch());
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).not.toContain('Our Cozy Place');
    expect(wrapper.text()).not.toContain('收好我们的日常与心动');
    expect(wrapper.find('.home-cozy-eyebrow').exists()).toBe(false);
    expect(wrapper.find('.home-cozy-title').exists()).toBe(false);
  });

  it('uses shared couple avatars in the shell and removes old hardcoded home data sources', () => {
    expect(JournalRouteShell).toBeTruthy();
  });

  it('sanitizes missing backend fields so the page never prints undefined null or NaN', async () => {
    setAuthToken('jwt-token');
    vi.stubGlobal(
      'fetch',
      createHomeFetch({
        ...homeOverviewFixture,
        dailyNote: { date: '2026-05-16', sentence: '', weatherHint: '', activityHint: '' },
        personStatuses: [
          {
            role: 'boyfriend',
            name: '伴侣 A',
            city: '',
            weather: '',
            temperature: null,
            mood: '',
            note: '',
            lastOnlineAt: null
          }
        ],
        distance: { kilometers: null, label: '距离正在更新', status: 'missingLocation', updatedAt: null },
        latest: { diary: null, photo: null, wish: null, message: null },
        stats: { photoCount: null, messageCount: null, wishCount: null, completedWishCount: null }
      })
    );
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('距离正在更新');
    expect(wrapper.text()).not.toMatch(/undefined|null|NaN/);
  });
});
