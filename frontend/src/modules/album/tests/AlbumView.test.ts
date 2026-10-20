import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from '../../../auth';
import AlbumView from '../AlbumView.vue';
import {
  currentDraft,
  deferred,
  firstPage,
  jsonResponse,
  privateDetail,
  publicDetail,
  publicPhoto,
  secondPage
} from './fixtures';

type AlbumIntersectionEntry = Pick<
  IntersectionObserverEntry,
  'target' | 'isIntersecting' | 'intersectionRatio'
>;

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.callback(
      [
        {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1
        } as AlbumIntersectionEntry as IntersectionObserverEntry
      ],
      this as unknown as IntersectionObserver
    );
  }

  unobserve() {
    // noop
  }

  disconnect() {
    // noop
  }
}

function stubMatchMedia(reducedMotion = false) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

function requestMethod(init?: RequestInit) {
  return init?.method ?? 'GET';
}

function createAlbumRequestAdapter() {
  let wrongAttempts = 0;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = requestMethod(init);

    if (url === '/api/albums?page=1&size=5&previewLimit=9') {
      return jsonResponse(firstPage);
    }
    if (url === '/api/drafts/album' && method === 'GET') {
      return jsonResponse({ draft: null });
    }
    if (url === '/api/albums?page=2&size=5&previewLimit=9') {
      return jsonResponse(secondPage);
    }
    if (url === '/api/drafts/album' && method === 'PUT') {
      return jsonResponse({ ...currentDraft, fields: JSON.parse(String(init?.body)).fields, images: [] });
    }
    if (url === '/api/drafts/album/images' && method === 'POST') {
      return jsonResponse({ id: 'uploaded-image', url: '/uploads/preview.webp', caption: 'Photo', width:32, height:24 });
    }
    if (url === '/api/drafts/album/publish' && method === 'POST') {
      return jsonResponse({
        album: {
          ...firstPage.items[0],
          id: 9,
          title: '新相册',
          previewPhotos: [
            {
              ...publicPhoto,
              id: 901,
              albumId: 9
            }
          ]
        },
        photos: [
          {
            ...publicPhoto,
            id: 901,
            albumId: 9
          }
        ]
      });
    }
    if (url === '/api/albums/1' && method === 'GET') {
      return jsonResponse(publicDetail);
    }
    if (url === '/api/albums/2' && method === 'GET') {
      const headers = new Headers(init?.headers);
      return headers.get('X-Album-Access-Token') === 'private-token'
        ? jsonResponse(privateDetail)
        : jsonResponse(
            {
              code: 'PRIVATE_ALBUM_LOCKED',
              message: '请输入私密相册密码'
            },
            403
          );
    }
    if (url === '/api/albums/2/unlock' && method === 'POST') {
      const password = JSON.parse(String(init?.body ?? '{}')).password;
      if (password === '5201314') {
        return jsonResponse({
          privateAccessToken: 'private-token',
          expiresAt: '2099-05-16T21:00:00.000Z'
        });
      }

      wrongAttempts += 1;
      return wrongAttempts >= 2
        ? jsonResponse(
            {
              code: 'PRIVATE_ALBUM_UNLOCK_LOCKED',
              message: '密码错误次数过多，请 10 分钟后再试'
            },
            423
          )
        : jsonResponse(
            {
              code: 'PRIVATE_ALBUM_PASSWORD_INVALID',
              message: '私密相册密码不正确'
            },
            400
          );
    }
    if (url === '/api/albums/1/view' && method === 'POST') {
      return jsonResponse({
        albumId: 1,
        viewCount: 22,
        counted: true
      });
    }
    if (url === '/api/albums/2/view' && method === 'POST') {
      return jsonResponse({
        albumId: 2,
        viewCount: 8,
        counted: true
      });
    }
    if (url === '/api/albums/2/like' && method === 'POST') {
      return jsonResponse({
        albumId: 2,
        likeCount: 4,
        likedToday: true
      });
    }

    throw new Error(`Unexpected request: ${url}; ${method}`);
  }) as unknown as typeof fetch;
}

const mountedWrappers: Array<{ unmount(): void }> = [];

async function mountAlbumView(
  requestAdapter: typeof fetch = createAlbumRequestAdapter(),
  settle = true
) {
  vi.stubGlobal('fetch', requestAdapter);
  const wrapper = mount(AlbumView, {
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true,
        teleport: true,
        AlbumCollectionEnterTransition: {
          name: 'AlbumCollectionEnterTransition',
          props: ['collection', 'photos', 'sourceRect', 'photoRects'],
          emits: ['done'],
          template:
            '<button class="album-enter-transition-stub__done" type="button" @click="$emit(\'done\')">done</button>'
        },
        AlbumImmersiveGallery: {
          name: 'AlbumImmersiveGallery',
          props: ['collection', 'photos'],
          emits: ['close', 'preview'],
          template: `
            <section class="album-immersive-gallery-stub" role="dialog" aria-label="immersive gallery">
              <span class="gallery-location">{{ photos[0]?.location }}</span>
              <button class="album-immersive-gallery-stub__preview" type="button" @click="$emit('preview', 0)">preview</button>
              <button class="album-immersive-gallery-stub__close" type="button" @click="$emit('close')">close</button>
            </section>
          `
        }
      }
    }
  });
  mountedWrappers.push(wrapper);

  if (settle) {
    await flushPromises();
    await nextTick();
  } else {
    await nextTick();
  }

  return wrapper;
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files
  });
}

beforeEach(() => {
  clearAuthToken();
  localStorage.clear();
  setAuthToken('jwt-token');
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({
      width: 1600,
      height: 1067,
      close: vi.fn()
    })
  );
  stubMatchMedia(false);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['preview'], { type: 'image/webp' }));
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 900
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 1600
  });
});

afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearAuthToken();
  localStorage.clear();
  document.body.classList.remove('is-album-immersive');
  document.body.innerHTML = '';
});

describe('AlbumView DOM and interaction behavior', () => {
  it.each([
    { localTime: [2025, 11, 31, 23, 30], date: '2025-12-31' },
    { localTime: [2026, 0, 1, 0, 30], date: '2026-01-01' }
  ])('打开新增相册后提交当前本地日期 $date', async ({ localTime, date }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubMatchMedia(true);
    vi.setSystemTime(new Date(2025, 11, 30, 12));
    const requests = createAlbumRequestAdapter();
    const payloads: Array<{ eventDate: string }> = [];
    const requestAdapter = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/drafts/album' && requestMethod(init) === 'PUT') {
        payloads.push(JSON.parse(String(init?.body)).fields);
      }
      return requests(input, init);
    });
    const wrapper = await mountAlbumView(requestAdapter);

    const [year, month, day, hour, minute] = localTime;
    vi.setSystemTime(new Date(year, month, day, hour, minute));
    await wrapper.get('[data-album-create-open]').trigger('click');
    await flushPromises();
    const dialog = wrapper.get('[data-album-create-dialog]');
    const input = dialog.get('[data-album-file-input]').element as HTMLInputElement;
    setInputFiles(input, [new File(['photo'], 'new-year.jpg', { type: 'image/jpeg' })]);
    await dialog.get('[data-album-file-input]').trigger('change');
    await dialog.get('[data-album-title-input]').setValue('跨年相册');
    await dialog.get('.album-create-form').trigger('submit');
    await flushPromises();

    await vi.waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0].eventDate).toBe(date);
  });

  it('shows PageLoader while the initial request is pending and hides it after completion', async () => {
    vi.useFakeTimers();
    const initialPage = deferred<Response>();
    const requestAdapter = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return initialPage.promise;
      }
      if (url === '/api/drafts/album') {
        return jsonResponse({ draft: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const wrapper = await mountAlbumView(requestAdapter, false);

    expect(wrapper.find('.page-loader').exists()).toBe(true);
    expect(wrapper.get('.page-loader').attributes('aria-label')).toBe('页面数据加载中');
    expect(wrapper.find('.album-page__inner').exists()).toBe(false);

    initialPage.resolve(jsonResponse(firstPage));
    await flushPromises();
    await nextTick();

    expect(wrapper.find('.album-page__inner').exists()).toBe(true);
    expect(wrapper.get('.page-loader').classes()).toContain('page-loader--complete');

    await vi.advanceTimersByTimeAsync(600);
    await nextTick();

    expect(wrapper.find('.page-loader').exists()).toBe(false);
  });

  it('renders catalog content and exposes the administrator create dialog controls', async () => {
    const wrapper = await mountAlbumView();

    expect(wrapper.findAll('.album-collection-card')).toHaveLength(2);
    expect(wrapper.get('.album-hero h1').text()).toContain('收藏见面与出游的闪亮瞬间');
    expect(wrapper.get('.album-hero h1').find('br').exists()).toBe(false);
    expect(wrapper.get('[data-album-id="1"]').text()).toContain('见面出游');
    expect(wrapper.get('[data-album-id="1"]').text()).toContain('法国·尼斯');
    expect(wrapper.get('[data-album-id="2"]').text()).toContain('锁定专辑');
    expect(wrapper.get('[data-album-id="2"]').text()).toContain('私密相册');
    expect(wrapper.get('.album-create-fab').attributes('aria-label')).toBe('新增相册');
    expect(wrapper.get('.album-create-fab__image').attributes('src')).toBeTruthy();

    await wrapper.get('[data-album-create-open]').trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[data-album-create-dialog]');
    expect(dialog.attributes('aria-label')).toBe('新增相册');
    expect(dialog.find('.album-create-dialog__background').exists()).toBe(true);
    expect(dialog.find('.album-create-upload__panel').exists()).toBe(true);
    expect(dialog.find('.album-create-upload__illustration').exists()).toBe(true);
    expect(dialog.text()).toContain('相册标题');
    expect(dialog.text()).toContain('私密相册');
    expect(dialog.text()).toContain('访问密码');
    expect(dialog.text()).toContain('单次最多 300 张');
    expect(dialog.find('[data-album-submit-draft]').exists()).toBe(true);
    expect(dialog.find('[data-album-publish]').exists()).toBe(true);
    expect(dialog.get('[data-album-private-password-input]').attributes('disabled')).toBeDefined();

    await dialog.get('.album-create-switch').trigger('click');
    await flushPromises();

    expect(dialog.get('.album-create-switch').attributes('aria-pressed')).toBe('true');
    expect(
      dialog.get('[data-album-private-password-input]').attributes('disabled')
    ).toBeUndefined();
  });

  it('appends the next page on bottom scroll and renders no additional page at the end', async () => {
    const requestAdapter = createAlbumRequestAdapter();
    const wrapper = await mountAlbumView(requestAdapter);

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 780
    });
    window.dispatchEvent(new Event('scroll'));
    await flushPromises();
    await nextTick();

    expect(wrapper.text()).toContain('日常碎片');
    expect(wrapper.findAll('.album-collection-card')).toHaveLength(3);

    window.dispatchEvent(new Event('scroll'));
    await flushPromises();

    expect(
      (requestAdapter as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([input]) =>
        String(input).includes('page=3')
      )
    ).toHaveLength(0);
  });

  it('enters the transition before rendering the gallery and recording a view', async () => {
    const requestAdapter = createAlbumRequestAdapter();
    const wrapper = await mountAlbumView(requestAdapter);

    await wrapper.get('[data-album-id="1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.album-enter-transition-stub__done').exists()).toBe(true);
    expect(wrapper.find('.album-immersive-gallery-stub').exists()).toBe(false);
    expect(
      (requestAdapter as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([input]) => String(input) === '/api/albums/1/view'
      )
    ).toBe(false);

    await wrapper.get('.album-enter-transition-stub__done').trigger('click');
    await flushPromises();

    expect(wrapper.find('.album-immersive-gallery-stub').exists()).toBe(true);
    expect(wrapper.get('.gallery-location').text()).toBe('法国·尼斯');
    expect(
      (requestAdapter as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([input]) => String(input) === '/api/albums/1/view'
      )
    ).toHaveLength(1);
  });

  it('disables duplicate like interaction while pending and renders the returned state', async () => {
    const likeResponse = deferred<Response>();
    const baseAdapter = createAlbumRequestAdapter();
    const requestAdapter = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/albums/2/like' && requestMethod(init) === 'POST') {
        return likeResponse.promise;
      }
      return baseAdapter(input, init);
    }) as unknown as typeof fetch;
    const wrapper = await mountAlbumView(requestAdapter);

    expect(wrapper.get('[data-album-like-id="1"]').classes()).toContain('is-liked');
    expect(wrapper.get('[data-album-like-id="2"]').attributes('aria-pressed')).toBe('false');

    await wrapper.get('[data-album-like-id="2"]').trigger('click');
    await wrapper.get('[data-album-like-id="2"]').trigger('click');

    expect(wrapper.get('[data-album-like-id="2"]').attributes('disabled')).toBeDefined();
    expect(
      (requestAdapter as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([input]) => String(input) === '/api/albums/2/like'
      )
    ).toHaveLength(1);

    likeResponse.resolve(
      jsonResponse({
        albumId: 2,
        likeCount: 4,
        likedToday: true
      })
    );
    await flushPromises();

    expect(wrapper.get('[data-album-id="2"]').text()).toContain('4 喜欢');
    expect(wrapper.get('[data-album-like-id="2"]').classes()).toContain('is-liked');
    expect(wrapper.get('[data-album-like-id="2"]').attributes('aria-pressed')).toBe('true');
  });

  it('shows private error copy, unlocks, and leaves the catalog card masked', async () => {
    const wrapper = await mountAlbumView();

    await wrapper.get('[data-album-id="2"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-album-unlock-submit]').text()).toContain(
      '请输入私密相册密码'
    );

    await wrapper.get('[data-album-unlock-input]').setValue('wrong');
    await wrapper.get('[data-album-unlock-submit]').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[data-album-unlock-submit]').text()).toContain(
      '私密相册密码不正确'
    );

    await wrapper.get('[data-album-unlock-input]').setValue('wrong-again');
    await wrapper.get('[data-album-unlock-submit]').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[data-album-unlock-submit]').text()).toContain(
      '密码错误次数过多，请 10 分钟后再试'
    );

    await wrapper.get('[data-album-unlock-input]').setValue('5201314');
    await wrapper.get('[data-album-unlock-submit]').trigger('submit');
    await flushPromises();
    await wrapper.get('.album-enter-transition-stub__done').trigger('click');
    await flushPromises();

    expect(wrapper.find('.album-immersive-gallery-stub').exists()).toBe(true);
    expect(wrapper.get('.gallery-location').text()).toBe('示例地区 B·示例城市 B');

    await wrapper.get('.album-immersive-gallery-stub__close').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-album-id="2"]').text()).toContain('锁定专辑');
    expect(wrapper.get('[data-album-id="2"]').text()).not.toContain('私密时光');
  });

  it('hides administrator entry points for non-managers', async () => {
    const requestAdapter = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse({
          ...firstPage,
          canManage: false,
          hasMore: false
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const wrapper = await mountAlbumView(requestAdapter);

    expect(wrapper.find('[data-album-create-open]').exists()).toBe(false);
    expect(wrapper.find('[data-album-draft-continue]').exists()).toBe(false);
  });

  it('labels an untitled private draft and allows title/password entry after resuming', async () => {
    const requestAdapter = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/albums?')) return jsonResponse(firstPage);
      if (String(input) === '/api/drafts/album') return jsonResponse({draft: {...currentDraft, fields: {...currentDraft.fields, title: '', visibility: 'private'}}});
      throw new Error(`Unexpected request: ${input}`);
    });
    const wrapper = await mountAlbumView(requestAdapter);
    expect(wrapper.get('[data-album-draft-continue]').text()).toContain('未命名草稿');
    await wrapper.get('[data-album-draft-continue]').trigger('click'); await flushPromises();
    const title = wrapper.get('[data-album-title-input]');
    const password = wrapper.get('[data-album-private-password-input]');
    expect(title.attributes('disabled')).toBeUndefined();
    expect(password.attributes('disabled')).toBeUndefined();
    expect((password.element as HTMLInputElement).value).toBe('');
    expect(password.attributes('required')).toBeDefined();
    await title.setValue('New title'); await password.setValue('new-password');
  });

  it('restores a draft dialog and reports the 300-file selection boundary', async () => {
    const requestAdapter = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(firstPage);
      }
      if (url === '/api/drafts/album') {
        return jsonResponse({ draft: currentDraft });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const wrapper = await mountAlbumView(requestAdapter);

    expect(wrapper.find('[data-album-draft-continue]').exists()).toBe(true);
    await wrapper.get('[data-album-draft-continue]').trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[data-album-create-dialog]');
    expect(dialog.text()).toContain('继续上传未完成相册');
    expect(dialog.text()).toContain('取消草稿');
    expect(dialog.text()).toContain('上传新照片');
    expect(dialog.text()).toContain('发布相册');
    expect(dialog.get('[data-album-title-input]').attributes('disabled')).toBeUndefined();

    const files = Array.from(
      { length: 301 },
      (_, index) => new File(['x'], `photo-${index + 1}.jpg`, { type: 'image/jpeg' })
    );
    const input = dialog.get('[data-album-file-input]').element as HTMLInputElement;
    setInputFiles(input, files);
    await dialog.get('[data-album-file-input]').trigger('change');

    expect(dialog.get('[role="status"]').text()).toContain('最多选择 300 张照片');
  });

  it('renders detailed upload queue rows from file selection without private state access', async () => {
    const wrapper = await mountAlbumView();
    await wrapper.get('[data-album-create-open]').trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[data-album-create-dialog]');
    const input = dialog.get('[data-album-file-input]').element as HTMLInputElement;
    setInputFiles(input, [
      new File(['x'], 'first-photo.jpg', {
        type: 'image/jpeg'
      })
    ]);
    await dialog.get('[data-album-file-input]').trigger('change');

    const uploadFrame = dialog.get('.album-create-upload');
    expect(uploadFrame.find('.album-create-upload__content').exists()).toBe(false);
    expect(uploadFrame.get('.album-upload-list').attributes('aria-label')).toBe(
      '照片上传队列'
    );
    expect(uploadFrame.get('.album-upload-item').attributes('data-upload-status')).toBe(
      'waiting'
    );
    expect(uploadFrame.text()).toContain('first-photo.jpg');
    expect(uploadFrame.get('[data-album-upload-status]').text()).toBe('等待上传');
    expect(uploadFrame.get('.album-upload-add').attributes('for')).toBe(
      'album-create-file-input'
    );

    await dialog.get('[data-album-title-input]').setValue('新相册');
    await dialog.get('.album-create-form').trigger('submit');
    await flushPromises();
    await vi.waitFor(() => {
      expect(
        wrapper.get(
          '[data-album-create-dialog] .album-upload-item [data-album-upload-status]'
        ).text()
      ).toBe('已上传');
    });
  });

  it('renders aggregate upload progress and reaches 100% through the form interaction', async () => {
    const requestAdapter = createAlbumRequestAdapter();
    const wrapper = await mountAlbumView(requestAdapter);
    await wrapper.get('[data-album-create-open]').trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[data-album-create-dialog]');
    const files = Array.from(
      { length: 7 },
      (_, index) => new File(['x'], `photo-${index + 1}.jpg`, { type: 'image/jpeg' })
    );
    const input = dialog.get('[data-album-file-input]').element as HTMLInputElement;
    setInputFiles(input, files);
    await dialog.get('[data-album-file-input]').trigger('change');

    expect(dialog.find('.album-upload-list').exists()).toBe(false);
    expect(dialog.get('.album-upload-progress').attributes('aria-label')).toBe(
      '照片上传进度'
    );
    expect(dialog.get('.album-upload-progress__count').text()).toBe('0/7');
    expect(dialog.get('.album-upload-progress__bar-fill').attributes('style')).toContain(
      'width: 0%'
    );

    await dialog.get('[data-album-title-input]').setValue('新相册');
    await dialog.get('.album-create-form').trigger('submit');
    await flushPromises();
    await nextTick();
    await vi.waitFor(() => {
      expect(
        wrapper.get(
          '[data-album-create-dialog] .album-upload-progress__count'
        ).text()
      ).toBe('7/7');
    });

    expect(
      (requestAdapter as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([input, init]) => String(input) === '/api/drafts/album' && requestMethod(init) === 'PUT'
      )
    ).toHaveLength(1);
    expect(
      (requestAdapter as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([input]) => String(input) === '/api/drafts/album/images'
      )
    ).toHaveLength(7);
    expect(
      wrapper
        .get('[data-album-create-dialog] .album-upload-progress__bar-fill')
        .attributes('style')
    ).toContain('width: 100%');
    expect(
      wrapper.get('[data-album-create-dialog] [data-album-submit-draft]').text()
    ).toContain('上传新照片');
  });
});
