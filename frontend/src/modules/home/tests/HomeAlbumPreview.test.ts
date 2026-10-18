import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
// @ts-ignore - Vitest runs in Node and this project keeps Node types minimal.

// @ts-ignore - Same as above.
import { resolve } from 'node:path';
import HomeView from '../HomeView.vue';
import { routes } from '../../../router';
import { resetHomeLifecycleForTests } from '../internal/useHomeLifecycle';
import { homeOverviewFixture } from './support/homeOverviewFixture';

const albumPhotos = [
  { id: 1, previewUrl: 'https://example.com/photo-1.jpg', caption: '春日草坪', takenAt: '2026-05-08' },
  { id: 2, previewUrl: 'https://example.com/photo-2.jpg', caption: '雪日小记', takenAt: '2026-05-07' },
  { id: 3, previewUrl: 'https://example.com/photo-3.jpg', caption: '晚风合照', takenAt: '2026-05-06' }
];

function mockHomeFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/home') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ...homeOverviewFixture,
            latest: {
              ...homeOverviewFixture.latest,
              photo: albumPhotos[0]
            },
            stats: {
              ...homeOverviewFixture.stats,
              photoCount: albumPhotos.length
            }
          })
      });
    }

    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetHomeLifecycleForTests();
});

describe('首页最新相册预览', () => {
  it('只渲染首页接口返回的一张最新照片，并让照片区和底部文字保持稳定布局', async () => {
    resetHomeLifecycleForTests();
    vi.stubGlobal('fetch', mockHomeFetch());
    const router = createRouter({ history: createMemoryHistory(), routes });

    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();

    const albumCard = wrapper.get('.recent-paper-item--album');
    expect(albumCard.findAll('.album-preview-strip img')).toHaveLength(1);
    expect(albumCard.find('.album-preview-footer h3').text()).toBe('春日草坪');
    expect(albumCard.find('.album-preview-footer small').text()).toContain('共 3 张照片');
  });
});
