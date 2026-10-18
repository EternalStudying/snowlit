import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthToken,
  getAuthToken,
  onSessionInvalidated,
  setAuthToken
} from '../../../auth';
import { useAlbumLifecycle } from '../internal/useAlbumLifecycle';
import type { AlbumCreatePayload, AlbumPageData } from '../model';
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

const privateTokenKey = 'snowlit_album_private_token_2';

function requestMethod(init?: RequestInit) {
  return init?.method ?? 'GET';
}

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    value(key: string) {
      return values.get(key) ?? null;
    }
  };
}

function catalogPage(overrides: Partial<AlbumPageData> = {}): AlbumPageData {
  return {
    ...firstPage,
    ...overrides
  };
}

beforeEach(() => {
  clearAuthToken();
  setAuthToken('jwt-token');
});

afterEach(() => {
  clearAuthToken();
  vi.restoreAllMocks();
});

describe('useAlbumLifecycle catalog behavior', () => {
  it('loads the administrator draft, appends the next page, and stops at the end', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(firstPage);
      }
      if (url === '/api/albums/drafts/current' && requestMethod(init) === 'GET') {
        return jsonResponse({ draft: currentDraft });
      }
      if (url === '/api/albums?page=2&size=5&previewLimit=9') {
        return jsonResponse(secondPage);
      }
      throw new Error(`Unexpected request: ${url}; ${requestMethod(init)}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({ adapter: fetcher });

    await lifecycle.loadInitialCatalog();
    await flushPromises();

    expect(lifecycle.state.loaded.value).toBe(true);
    expect(lifecycle.state.canManage.value).toBe(true);
    expect(lifecycle.state.currentDraft.value).toEqual(currentDraft);
    expect(lifecycle.state.collections.value.map((album) => album.title)).toEqual([
      '见面出游',
      '锁定专辑'
    ]);
    expect(lifecycle.state.collections.value[1]).toMatchObject({
      locked: true,
      photos: [],
      previewPhotos: []
    });

    await lifecycle.loadNextPage();

    expect(lifecycle.state.collections.value.map((album) => album.title)).toEqual([
      '见面出游',
      '锁定专辑',
      '日常碎片'
    ]);
    expect(lifecycle.state.hasMore.value).toBe(false);

    await lifecycle.loadNextPage();

    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([input]) =>
        String(input).includes('/api/albums?page=')
      )
    ).toHaveLength(2);
  });

  it('does not query a draft or expose management state for non-administrators', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(catalogPage({ canManage: false, hasMore: false }));
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({ adapter: fetcher });

    await lifecycle.loadInitialCatalog();
    await flushPromises();

    expect(lifecycle.state.canManage.value).toBe(false);
    expect(lifecycle.state.currentDraft.value).toBeNull();
    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([input]) => String(input) === '/api/albums/drafts/current'
      )
    ).toBe(false);
  });

  it('returns catalog errors as observable Chinese copy and completes initial loading', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('网络暂时不可用')) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({ adapter: fetcher });

    await lifecycle.loadInitialCatalog();

    expect(lifecycle.state.loaded.value).toBe(true);
    expect(lifecycle.state.loading.value).toBe(false);
    expect(lifecycle.state.catalogError.value).toBe('相册数据加载失败');
  });

  it('invalidates the global session for ordinary 401 responses but not private-album 401 responses', async () => {
    const logoutListener = vi.fn();
    const stopListening =
      onSessionInvalidated(logoutListener);
    const unauthorizedFetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'UNAUTHORIZED',
          message: '登录状态已失效'
        },
        401
      )
    ) as unknown as typeof fetch;
    const unauthorizedLifecycle = useAlbumLifecycle({
      adapter: unauthorizedFetcher
    });

    await unauthorizedLifecycle.loadInitialCatalog();

    expect(getAuthToken()).toBe('');
    expect(logoutListener).toHaveBeenCalledTimes(1);
    // The 401 ended the session, so the request's outcome belongs to no one and is not shown.
    expect(unauthorizedLifecycle.state.catalogError.value).toBe('');

    setAuthToken('jwt-token');
    logoutListener.mockClear();
    const storage = createMemoryStorage({
      [privateTokenKey]: JSON.stringify({
        token: 'rejected-token',
        expiresAt: '2026-07-26T08:00:00.000Z'
      })
    });
    const privateUnauthorizedFetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/albums?page=1&size=5&previewLimit=9') {
          return jsonResponse(catalogPage({ canManage: false, hasMore: false }));
        }
        if (url === '/api/albums/2' && requestMethod(init) === 'GET') {
          return jsonResponse(
            {
              code: 'PRIVATE_ALBUM_TOKEN_INVALID',
              message: '私密相册访问无效，请重新输入密码'
            },
            401
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      }
    ) as unknown as typeof fetch;
    const privateUnauthorizedLifecycle = useAlbumLifecycle({
      adapter: privateUnauthorizedFetcher,
      storage,
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });
    await privateUnauthorizedLifecycle.loadInitialCatalog();

    await expect(privateUnauthorizedLifecycle.prepareOpen(2)).resolves.toMatchObject({
      kind: 'password-required',
      message: '私密相册访问无效，请重新输入密码'
    });
    expect(getAuthToken()).toBe('jwt-token');
    expect(logoutListener).not.toHaveBeenCalled();
    expect(storage.value(privateTokenKey)).toBeNull();

    stopListening();
  });
});

describe('useAlbumLifecycle open and like behavior', () => {
  it('loads public detail immediately but records a view only after entered is called', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(catalogPage({ canManage: false, hasMore: false }));
      }
      if (url === '/api/albums/1' && method === 'GET') {
        return jsonResponse(publicDetail);
      }
      if (url === '/api/albums/1/view' && method === 'POST') {
        return jsonResponse({ albumId: 1, viewCount: 22, counted: true });
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({ adapter: fetcher });
    await lifecycle.loadInitialCatalog();

    const result = await lifecycle.prepareOpen(1);

    expect(result.kind).toBe('opened');
    if (result.kind !== 'opened') {
      throw new Error('Expected a public album to open');
    }
    expect(result.collection.photos.map((photo) => photo.url)).toEqual(
      publicDetail.photos.map((photo) => photo.previewUrl)
    );
    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([input]) => String(input) === '/api/albums/1/view'
      )
    ).toBe(false);

    await result.entered();

    expect(result.collection.views).toBe(22);
    expect(lifecycle.state.collections.value[0].views).toBe(22);
    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([input]) => String(input) === '/api/albums/1/view'
      )
    ).toHaveLength(1);
  });

  it('deduplicates likes while a request is pending and applies the server result', async () => {
    const likeResponse = deferred<Response>();
    const storage = createMemoryStorage({
      [privateTokenKey]: JSON.stringify({
        token: 'private-token',
        expiresAt: '2099-05-16T21:00:00.000Z'
      })
    });
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(catalogPage({ canManage: false, hasMore: false }));
      }
      if (url === '/api/albums/2/like' && method === 'POST') {
        return likeResponse.promise;
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({ adapter: fetcher, storage });
    await lifecycle.loadInitialCatalog();

    const firstToggle = lifecycle.toggleLike(2);
    const duplicateToggle = lifecycle.toggleLike(2);

    expect(lifecycle.isLikePending(2)).toBe(true);
    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([input]) => String(input) === '/api/albums/2/like'
      )
    ).toHaveLength(1);
    const pageCall = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([input]) => String(input).startsWith('/api/albums?page=')
    );
    const likeCall = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([input]) => String(input) === '/api/albums/2/like'
    );
    expect(pageCall?.[1]?.headers).toEqual({
      Authorization: 'Bearer jwt-token'
    });
    expect(likeCall?.[1]?.headers).toEqual({
      Authorization: 'Bearer jwt-token'
    });
    expect(likeCall?.[1]?.headers).not.toHaveProperty('X-Album-Access-Token');

    likeResponse.resolve(jsonResponse({ albumId: 2, likeCount: 4, likedToday: true }));
    await Promise.all([firstToggle, duplicateToggle]);

    expect(lifecycle.isLikePending(2)).toBe(false);
    expect(lifecycle.state.collections.value[1]).toMatchObject({
      likes: 4,
      likedToday: true
    });
  });

  it('clears expired and backend-rejected private tokens through the injected storage', async () => {
    const now = () => new Date('2026-07-25T08:00:00.000Z');
    const expiredStorage = createMemoryStorage({
      [privateTokenKey]: JSON.stringify({
        token: 'expired-token',
        expiresAt: '2026-07-25T07:59:59.000Z'
      })
    });
    const expiredFetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(catalogPage({ canManage: false, hasMore: false }));
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const expiredLifecycle = useAlbumLifecycle({
      adapter: expiredFetcher,
      storage: expiredStorage,
      now
    });
    await expiredLifecycle.loadInitialCatalog();

    await expect(expiredLifecycle.prepareOpen(2)).resolves.toEqual({
      kind: 'password-required',
      albumId: 2,
      message: '请输入私密相册密码'
    });
    expect(expiredStorage.value(privateTokenKey)).toBeNull();
    expect(expiredStorage.removeItem).toHaveBeenCalledWith(privateTokenKey);

    const rejectedStorage = createMemoryStorage({
      [privateTokenKey]: JSON.stringify({
        token: 'rejected-token',
        expiresAt: '2026-07-26T08:00:00.000Z'
      })
    });
    const rejectedFetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(catalogPage({ canManage: false, hasMore: false }));
      }
      if (url === '/api/albums/2') {
        expect(new Headers(init?.headers).get('X-Album-Access-Token')).toBe('rejected-token');
        return jsonResponse(
          {
            code: 'PRIVATE_ALBUM_TOKEN_INVALID',
            message: '私密相册访问无效，请重新输入密码'
          },
          403
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const rejectedLifecycle = useAlbumLifecycle({
      adapter: rejectedFetcher,
      storage: rejectedStorage,
      now
    });
    await rejectedLifecycle.loadInitialCatalog();

    await expect(rejectedLifecycle.prepareOpen(2)).resolves.toEqual({
      kind: 'password-required',
      albumId: 2,
      message: '私密相册访问无效，请重新输入密码'
    });
    expect(rejectedStorage.value(privateTokenKey)).toBeNull();
    expect(rejectedStorage.removeItem).toHaveBeenCalledWith(privateTokenKey);
  });

  it('surfaces private errors, unlocks successfully, and keeps the catalog masked', async () => {
    const storage = createMemoryStorage();
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(catalogPage({ canManage: false, hasMore: false }));
      }
      if (url === '/api/albums/2/unlock' && method === 'POST') {
        const password = JSON.parse(String(init?.body)).password;
        return password === '5201314'
          ? jsonResponse({
              privateAccessToken: 'private-token',
              expiresAt: '2099-05-16T21:00:00.000Z'
            })
          : jsonResponse(
              {
                code: 'PRIVATE_ALBUM_PASSWORD_INVALID',
                message: '私密相册密码不正确'
              },
              400
            );
      }
      if (url === '/api/albums/2' && method === 'GET') {
        expect(new Headers(init?.headers).get('X-Album-Access-Token')).toBe('private-token');
        return jsonResponse(privateDetail);
      }
      if (url === '/api/albums/2/view' && method === 'POST') {
        return jsonResponse({ albumId: 2, viewCount: 8, counted: true });
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({
      adapter: fetcher,
      storage,
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });
    await lifecycle.loadInitialCatalog();

    await expect(lifecycle.prepareOpen(2, 'wrong')).resolves.toEqual({
      kind: 'password-required',
      albumId: 2,
      message: '私密相册密码不正确'
    });

    const result = await lifecycle.prepareOpen(2, '5201314');

    expect(result.kind).toBe('opened');
    if (result.kind !== 'opened') {
      throw new Error('Expected the private album to unlock');
    }
    expect(result.collection).toMatchObject({
      title: '私密时光',
      locked: false
    });
    expect(result.collection.photos).toHaveLength(1);
    expect(lifecycle.state.collections.value[1]).toMatchObject({
      title: '锁定专辑',
      locked: true,
      photos: [],
      previewPhotos: []
    });
    expect(storage.value(privateTokenKey)).toContain('private-token');
  });
});

describe('useAlbumLifecycle draft behavior', () => {
  it('restores the current draft and its already uploaded photos', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(firstPage);
      }
      if (url === '/api/albums/drafts/current') {
        return jsonResponse({ draft: currentDraft });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({ adapter: fetcher });
    await lifecycle.loadInitialCatalog();
    await flushPromises();

    const restored = lifecycle.resumeCurrentDraft();

    expect(restored).toEqual(currentDraft);
    expect(lifecycle.state.workingDraft.value).toEqual(currentDraft);
    expect(lifecycle.state.draftPhotos.value).toEqual(currentDraft.photos);
  });

  it('uses injected preview and time ports while saving and uploading a new draft', async () => {
    const original = new File(['original'], 'summer-trip.jpg', { type: 'image/jpeg' });
    const preview = new File(['preview'], 'summer-trip.webp', { type: 'image/webp' });
    const now = () => new Date('2026-07-25T08:09:10.000Z');
    const generatePreview = vi.fn().mockResolvedValue({
      file: preview,
      width: 1200,
      height: 800
    });
    const createdDraft = {
      album: {
        ...firstPage.items[0],
        id: 9,
        title: '新相册',
        previewPhotos: []
      },
      photos: []
    };
    const uploadedPhoto = {
      ...publicPhoto,
      id: 902,
      albumId: 9,
      previewUrl: '/uploads/summer-trip.webp'
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums' && method === 'POST') {
        return jsonResponse(createdDraft);
      }
      if (url === '/api/albums/9/photos' && method === 'POST') {
        return jsonResponse(uploadedPhoto);
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({
      adapter: fetcher,
      now,
      generatePreview,
      isMobileUpload: () => false
    });
    const payload: AlbumCreatePayload = {
      title: '新相册',
      description: '',
      eventDate: '2026-07-25',
      location: '',
      visibility: 'public'
    };

    expect(lifecycle.queueFiles([original])).toBe(true);
    await lifecycle.saveAndUpload(payload);

    expect(generatePreview).toHaveBeenCalledWith(original);
    expect(lifecycle.state.workingDraft.value).toEqual(createdDraft);
    expect(lifecycle.state.draftPhotos.value).toEqual([uploadedPhoto]);
    expect(lifecycle.state.uploadItems.value[0]).toMatchObject({
      status: 'success',
      progress: 100,
      metadata: {
        caption: 'summer-trip',
        takenAt: '2026-07-25',
        location: '地球',
        width: 1200,
        height: 800,
        sortOrder: 1
      }
    });

    const uploadCall = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([input]) => String(input) === '/api/albums/9/photos'
    );
    const form = uploadCall?.[1]?.body as FormData;
    expect(form.get('original')).toBe(original);
    expect(form.get('preview')).toBe(preview);
    expect(JSON.parse(String(form.get('metadata')))).toEqual({
      caption: 'summer-trip',
      takenAt: '2026-07-25',
      location: '地球',
      width: 1200,
      height: 800,
      sortOrder: 1
    });
  });

  it('keeps an upload batch bound to the draft that started it', async () => {
    const original = new File(['original'], 'slow-preview.jpg', {
      type: 'image/jpeg'
    });
    const preview = new File(['preview'], 'slow-preview.webp', {
      type: 'image/webp'
    });
    const previewResult = deferred<{ file: File; width: number; height: number }>();
    const generatePreview = vi.fn(() => previewResult.promise);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(firstPage);
      }
      if (url === '/api/albums/drafts/current') {
        return jsonResponse({ draft: currentDraft });
      }
      if (url === '/api/albums/9/photos' && method === 'POST') {
        return jsonResponse({
          ...publicPhoto,
          id: 904,
          albumId: 9,
          previewUrl: '/uploads/slow-preview.webp'
        });
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({
      adapter: fetcher,
      generatePreview,
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });
    await lifecycle.loadInitialCatalog();
    await flushPromises();
    lifecycle.resumeCurrentDraft();
    lifecycle.queueFiles([original]);

    const uploadRun = lifecycle.saveAndUpload({
      title: currentDraft.album.title,
      description: currentDraft.album.description,
      eventDate: currentDraft.album.eventDate,
      location: currentDraft.album.location,
      visibility: currentDraft.album.visibility
    });
    await vi.waitFor(() => {
      expect(generatePreview).toHaveBeenCalledWith(original);
    });

    lifecycle.beginNewDraft();
    previewResult.resolve({
      file: preview,
      width: 1200,
      height: 800
    });
    await uploadRun;

    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([input]) => String(input) === '/api/albums/9/photos'
      )
    ).toBe(true);
  });

  it('rejects a selection above the 300-file boundary without enqueuing it', () => {
    const lifecycle = useAlbumLifecycle({
      adapter: vi.fn() as unknown as typeof fetch,
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });
    const files = Array.from(
      { length: 301 },
      (_, index) => new File(['x'], `photo-${index + 1}.jpg`, { type: 'image/jpeg' })
    );

    expect(lifecycle.queueFiles(files)).toBe(false);
    expect(lifecycle.state.uploadError.value).toBe('最多选择 300 张照片');
    expect(lifecycle.state.uploadItems.value).toHaveLength(0);
  });

  it('blocks publishing while queued photos are unfinished', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(firstPage);
      }
      if (url === '/api/albums/drafts/current') {
        return jsonResponse({ draft: currentDraft });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({
      adapter: fetcher,
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });
    await lifecycle.loadInitialCatalog();
    await flushPromises();
    lifecycle.resumeCurrentDraft();
    lifecycle.queueFiles([
      new File(['x'], 'still-waiting.jpg', {
        type: 'image/jpeg'
      })
    ]);

    await expect(lifecycle.publishDraft()).resolves.toBe(false);
    expect(lifecycle.state.draftNotice.value).toBe(
      '还有照片未处理完成，请等待、重试或移除失败项'
    );
    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        ([input]) => String(input) === '/api/albums/9/publish'
      )
    ).toBe(false);
  });

  it('uses the refreshed masked catalog representation after publishing a private draft', async () => {
    const privateDraft = {
      ...currentDraft,
      album: {
        ...currentDraft.album,
        title: '只有我们知道的标题',
        visibility: 'private' as const
      }
    };
    const publishedDraft = {
      ...privateDraft,
      album: {
        ...privateDraft.album,
        locked: false,
        previewPhotos: privateDraft.photos
      }
    };
    const maskedAlbum = {
      ...publishedDraft.album,
      title: '锁定专辑',
      description: '已锁定',
      coverPhotoUrl: '/album-assets/private-locked-cover.png',
      authorName: '',
      location: '地球',
      locked: true,
      previewPhotos: []
    };
    let catalogLoads = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        catalogLoads += 1;
        return jsonResponse(
          catalogLoads === 1
            ? firstPage
            : {
                ...firstPage,
                items: [maskedAlbum, ...firstPage.items],
                total: firstPage.total + 1
              }
        );
      }
      if (url === '/api/albums/drafts/current') {
        return jsonResponse({ draft: privateDraft });
      }
      if (url === '/api/albums/9/publish' && method === 'POST') {
        return jsonResponse(publishedDraft);
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const lifecycle = useAlbumLifecycle({ adapter: fetcher });
    await lifecycle.loadInitialCatalog();
    await flushPromises();
    lifecycle.resumeCurrentDraft();

    await expect(lifecycle.publishDraft()).resolves.toBe(true);

    expect(lifecycle.state.collections.value[0]).toMatchObject({
      albumId: 9,
      title: '锁定专辑',
      locked: true,
      photos: [],
      previewPhotos: []
    });
    expect(lifecycle.state.collections.value[0].title).not.toBe(
      '只有我们知道的标题'
    );
  });

  it('publishes and cancels restored drafts through their observable outcomes', async () => {
    const publishedDraft = {
      ...currentDraft,
      album: {
        ...currentDraft.album,
        title: '已经发布的相册',
        locked: false
      }
    };
    const publishedCatalog = {
      ...firstPage,
      items: [
        publishedDraft.album,
        ...firstPage.items
      ],
      total: firstPage.total + 1
    };
    let publishCatalogLoads = 0;
    const publishFetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        publishCatalogLoads += 1;
        return jsonResponse(publishCatalogLoads === 1 ? firstPage : publishedCatalog);
      }
      if (url === '/api/albums/drafts/current') {
        return jsonResponse({ draft: currentDraft });
      }
      if (url === '/api/albums/9/publish' && method === 'POST') {
        return jsonResponse(publishedDraft);
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const publishLifecycle = useAlbumLifecycle({
      adapter: publishFetcher
    });
    await publishLifecycle.loadInitialCatalog();
    await flushPromises();
    publishLifecycle.resumeCurrentDraft();

    await expect(publishLifecycle.publishDraft()).resolves.toBe(true);
    expect(publishLifecycle.state.currentDraft.value).toBeNull();
    expect(publishLifecycle.state.collections.value[0]).toMatchObject({
      albumId: 9,
      title: '已经发布的相册'
    });
    expect(publishCatalogLoads).toBe(2);

    const cancelFetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = requestMethod(init);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') {
        return jsonResponse(firstPage);
      }
      if (url === '/api/albums/drafts/current') {
        return jsonResponse({ draft: currentDraft });
      }
      if (url === '/api/albums/9/draft' && method === 'DELETE') {
        return new Response(null, {
          status: 204
        });
      }
      throw new Error(`Unexpected request: ${url}; ${method}`);
    }) as unknown as typeof fetch;
    const cancelLifecycle = useAlbumLifecycle({
      adapter: cancelFetcher
    });
    await cancelLifecycle.loadInitialCatalog();
    await flushPromises();
    cancelLifecycle.resumeCurrentDraft();

    await expect(cancelLifecycle.cancelDraft()).resolves.toBe(true);
    expect(cancelLifecycle.state.currentDraft.value).toBeNull();
    expect(
      (cancelFetcher as unknown as ReturnType<typeof vi.fn>).mock.calls
    ).toContainEqual([
      '/api/albums/9/draft',
      {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer jwt-token'
        }
      }
    ]);
  });
});
