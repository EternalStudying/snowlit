import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageLoader from '../src/components/PageLoader.vue';
import DiaryView from '../src/modules/diary/DiaryView.vue';

const gsapTicker = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn()
}));

vi.mock('gsap', () => ({
  gsap: {
    ticker: gsapTicker
  }
}));

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function pendingResponse() {
  return new Promise<Response>(() => undefined);
}

describe('统一页面加载', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    gsapTicker.add.mockReset();
    gsapTicker.remove.mockReset();
    document.body.innerHTML = '';
  });

  it('PageLoader 只显示加载图标和页面顶部进度条', () => {
    const wrapper = mount(PageLoader);

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('页面数据加载中');
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('页面加载进度');
    expect(wrapper.text().trim()).toBe('');
    expect(wrapper.find('.page-loader__spinner').exists()).toBe(true);
    expect(wrapper.find('.page-loader__progress-bar').exists()).toBe(true);
    expect(wrapper.find('.page-loader__card').exists()).toBe(false);
    expect(wrapper.find('.page-loader__tape').exists()).toBe(false);
  });

  it('加载样式在全屏加载层最上方显示可见进度条，并保留 reduced-motion 降级', () => {
    const shellStyles = readSource('src/styles/02-app-shell.css');
    const keyframes = readSource('src/styles/90-keyframes.css');
    const pageLoaderProgressKeyframes = keyframes.slice(
      keyframes.indexOf('@keyframes page-loader-progress'),
      keyframes.indexOf('@keyframes pointer-heart-pop')
    );

    expect(shellStyles).toMatch(
      /\.page-loader\s*{[\s\S]*z-index:\s*2147483647;[\s\S]*background-color:\s*rgba\(255, 253, 249, 0\.96\);[\s\S]*transition:\s*background-color 160ms ease;/
    );
    expect(shellStyles).toMatch(
      /\.page-loader--complete\s*{[\s\S]*pointer-events:\s*none;[\s\S]*background-color:\s*rgba\(255, 253, 249, 0\);/
    );
    expect(shellStyles).toMatch(
      /\.page-loader__progress\s*{[\s\S]*position:\s*fixed;[\s\S]*top:\s*58px;[\s\S]*z-index:\s*2147483647;/
    );
    expect(shellStyles).toMatch(/\.page-loader__progress\s*{[\s\S]*height:\s*4px;/);
    expect(shellStyles).toMatch(
      /\.page-loader__progress-bar\s*{[\s\S]*width:\s*100%;[\s\S]*transform-origin:\s*left center;[\s\S]*transform:\s*scaleX\(0\.08\);[\s\S]*animation:\s*page-loader-progress/
    );
    expect(shellStyles).not.toContain('.page-loader__progress-bar::after');
    expect(pageLoaderProgressKeyframes).not.toContain('translateX');
    expect(pageLoaderProgressKeyframes).toMatch(
      /@keyframes\s+page-loader-progress\s*{[\s\S]*transform:\s*scaleX\(0\.08\);[\s\S]*transform:\s*scaleX\(0\.72\);[\s\S]*transform:\s*scaleX\(0\.94\);/
    );
    expect(shellStyles).toMatch(
      /\.page-loader--complete\s+\.page-loader__progress-bar\s*{[\s\S]*animation:\s*none;[\s\S]*transform:\s*scaleX\(1\);[\s\S]*transition:\s*transform 260ms cubic-bezier\(0\.19, 1, 0\.22, 1\);/
    );
    expect(shellStyles).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.page-loader__progress-bar\s*{[\s\S]*animation:\s*none;/
    );
    expect(keyframes).toContain('@keyframes page-loader-progress');
  });

  it('加载结束时先填满进度条，再卸载加载层', async () => {
    vi.useFakeTimers();
    const wrapper = mount(PageLoader, {
      props: {
        loading: true
      }
    });

    await wrapper.setProps({ loading: false });

    expect(wrapper.find('.page-loader').exists()).toBe(true);
    expect(wrapper.get('.page-loader').classes()).toContain('page-loader--complete');
    expect(wrapper.find('.page-loader__progress-bar').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.page-loader').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(280);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.page-loader').exists()).toBe(false);
  });

  it('所有会等待首屏数据的页面都接入同一个 PageLoader', () => {
    [
      [
        'src/modules/home/HomeView.vue',
        "import PageLoader from '../../components/PageLoader.vue'"
      ],
      [
        'src/modules/wishes/WishesView.vue',
        "import PageLoader from '../../components/PageLoader.vue'"
      ],
      [
        'src/modules/diary/DiaryView.vue',
        "import PageLoader from '../../components/PageLoader.vue'"
      ]
    ].forEach(([path, pageLoaderImport]) => {
      const source = readSource(path);
      expect(source).toContain(pageLoaderImport);
      expect(source).toContain('<PageLoader :loading=');
    });
  });

  it('留言页已解锁并使用手账内联加载状态', () => {
    ['src/modules/messages/MessagesView.vue'].forEach((path) => {
      const source = readSource(path);
      expect(source).not.toContain("import PageLoader from '../components/PageLoader.vue'");
      expect(source).not.toContain('<PageLoader :loading=');
      expect(source).not.toContain('data-page-placeholder=');
      expect(source).toContain('data-page="messages"');
      expect(source).toContain('useMessageLifecycle');
    });
  });

  it('日记页首屏接口未返回前显示统一加载，不提前露出章节和时间线', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/auth/me' || url === '/api/diary/months') {
          return pendingResponse();
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      })
    );

    const wrapper = mount(DiaryView, {
      global: {
        stubs: {
          Teleport: true,
          teleport: true
        }
      }
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.page-loader').exists()).toBe(true);
    expect(wrapper.find('.diary-controls').exists()).toBe(false);
    expect(wrapper.find('.diary-timeline--centered').exists()).toBe(false);

    wrapper.unmount();
  });
});
