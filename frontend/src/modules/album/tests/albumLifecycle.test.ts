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
      if (url === '/api/drafts/album' && requestMethod(init) === 'GET') {
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
        ([input]) => String(input) === '/api/drafts/album'
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
  async function restored(draft = currentDraft, actions?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/albums?page=1&size=5&previewLimit=9') return jsonResponse(firstPage);
      if (url === '/api/drafts/album' && requestMethod(init) === 'GET') return jsonResponse({ draft });
      if (actions) return actions(url, init);
      throw new Error(`Unexpected request: ${url}`);
    });
    const lifecycle = useAlbumLifecycle({ adapter: fetcher });
    await lifecycle.loadInitialCatalog(); await flushPromises(); lifecycle.resumeCurrentDraft();
    return { lifecycle, fetcher };
  }

  it('restores fields and uploaded images without re-uploading', async () => {
    const { lifecycle, fetcher } = await restored();
    expect(lifecycle.state.workingDraft.value).toEqual(currentDraft);
    expect(lifecycle.state.draftPhotos.value).toEqual(currentDraft.images);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('saves only fields then uploads original, WebP and metadata', async () => {
    const original = new File(['original'], 'summer.jpg', { type: 'image/jpeg' });
    const preview = new File(['preview'], 'summer.webp', { type: 'image/webp' });
    const uploaded = { id: 'opaque-new', url: '/uploads/summer.webp', caption: 'summer' };
    const empty = { ...currentDraft, images: [] };
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/drafts/album' && init?.method === 'PUT') return jsonResponse(empty);
      if (String(input) === '/api/drafts/album/images') return jsonResponse(uploaded);
      throw new Error(`Unexpected request: ${input}`);
    });
    const generatePreview = vi.fn().mockResolvedValue({ file: preview, width: 1200, height: 800 });
    const lifecycle = useAlbumLifecycle({ adapter: fetcher, generatePreview, now: () => new Date('2026-07-25T08:00:00Z') });
    lifecycle.queueFiles([original]);
    await lifecycle.saveAndUpload({ title: 'Summer', description: '', eventDate: '2026-07-25', location: '', visibility: 'private', privatePassword: 'test-password' });
    expect(generatePreview).toHaveBeenCalledWith(original);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ fields: { title: 'Summer', description: '', eventDate: '2026-07-25', location: '', visibility: 'private' } });
    const form = fetcher.mock.calls[1][1]?.body as FormData;
    expect(form.get('original')).toBe(original); expect(form.get('preview')).toBe(preview);
    expect(JSON.parse(String(form.get('metadata')))).toEqual({ caption: 'summer', takenAt: '2026-07-25', location: '地球', width: 1200, height: 800 });
    expect(lifecycle.state.draftPhotos.value).toEqual([uploaded]);
    expect(lifecycle.state.uploadItems.value[0]).toMatchObject({ status: 'success', progress: 100 });
    expect(lifecycle.state.workingDraft.value?.fields).not.toHaveProperty('privatePassword');
  });

  it('cancels stale uploads before they can attach to a replacement draft', async () => {
    const preview = deferred<{file: File; width: number; height: number}>();
    const fetcher = vi.fn(async () => jsonResponse(currentDraft));
    const generatePreview = vi.fn(() => preview.promise);
    const lifecycle = useAlbumLifecycle({ adapter: fetcher, generatePreview });
    lifecycle.queueFiles([new File(['x'], 'x.jpg', { type: 'image/jpeg' })]);
    const run = lifecycle.saveAndUpload(currentDraft.fields as AlbumCreatePayload);
    await vi.waitFor(() => expect(generatePreview).toHaveBeenCalled());
    lifecycle.beginNewDraft();
    preview.resolve({file: new File(['p'], 'p.webp', {type:'image/webp'}), width: 1, height: 1});
    await run;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(lifecycle.state.workingDraft.value).toBeNull();
  });

  it('rejects more than 50 files without enqueuing them', () => {
    const lifecycle = useAlbumLifecycle({ adapter: vi.fn() });
    const files = Array.from({length:51}, (_, index) => new File(['x'], `p-${index}.jpg`, { type:'image/jpeg' }));
    expect(lifecycle.queueFiles(files)).toBe(false);
    expect(lifecycle.state.uploadError.value).toBe('最多选择 50 张照片');
    expect(lifecycle.state.uploadItems.value).toHaveLength(0);
  });

  it('counts restored photos toward the shared 50-photo cap without truncating an older draft', async () => {
    const images = Array.from({length:51}, (_,index) => ({...currentDraft.images[0],id:`image-${index}`}));
    const { lifecycle, fetcher } = await restored({...currentDraft, images});
    expect(lifecycle.state.draftPhotos.value).toHaveLength(51);
    expect(lifecycle.queueFiles([new File(['x'],'new.jpg',{type:'image/jpeg'})])).toBe(false);
    await expect(lifecycle.publishDraft()).resolves.toBe(false);
    expect(lifecycle.state.draftNotice.value).toBe('每本相册最多 50 张照片，请移除多余照片后再发布');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('blocks publishing while queued photos are unfinished', async () => {
    const { lifecycle, fetcher } = await restored();
    lifecycle.queueFiles([new File(['x'], 'x.jpg', {type:'image/jpeg'})]);
    await expect(lifecycle.publishDraft()).resolves.toBe(false);
    expect(lifecycle.state.draftNotice.value).toBe('还有照片未处理完成，请等待、重试或移除失败项');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('requires title and a new password for an untitled private resumed draft', async () => {
    const draft = { ...currentDraft, fields: { ...currentDraft.fields, title: '', visibility: 'private' as const } };
    const { lifecycle, fetcher } = await restored(draft);
    await expect(lifecycle.publishDraft()).resolves.toBe(false);
    expect(lifecycle.state.draftNotice.value).toBe('相册标题不能为空');
    await expect(lifecycle.publishDraft({ ...draft.fields, title: 'Private' } as AlbumCreatePayload)).resolves.toBe(false);
    expect(lifecycle.state.draftNotice.value).toBe('请重新输入私密相册密码');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('publishes latest fields/password then refreshes the masked catalog', async () => {
    const draft = { ...currentDraft, fields: { ...currentDraft.fields, visibility: 'private' as const } };
    const { lifecycle, fetcher } = await restored(draft, (url, init) => {
      if (url === '/api/drafts/album/publish' && init?.method === 'POST') return jsonResponse(privateDetail);
      throw new Error(`Unexpected request: ${url}`);
    });
    const payload = { ...draft.fields, title: 'Latest title', privatePassword: 'new-password' } as AlbumCreatePayload;
    await expect(lifecycle.publishDraft(payload)).resolves.toBe(true);
    const call = fetcher.mock.calls.find(([input]) => input === '/api/drafts/album/publish');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({fields: {...draft.fields, title:'Latest title'}, privatePassword:'new-password',imageOrder:['opaque-photo']});
    expect(lifecycle.state.currentDraft.value).toBeNull();
    expect(lifecycle.state.collections.value[1]).toMatchObject({title:'锁定专辑', locked:true, photos:[]});
  });

  it('keeps failed drafts and discards through the new root path', async () => {
    const { lifecycle, fetcher } = await restored(currentDraft, (url, init) => {
      if (url.endsWith('/publish')) return jsonResponse({code:'ALBUM_TITLE_REQUIRED', message:'相册标题不能为空'}, 400);
      if (url === '/api/drafts/album' && init?.method === 'DELETE') return new Response(null, {status:204});
      throw new Error(`Unexpected request: ${url}`);
    });
    await expect(lifecycle.publishDraft()).resolves.toBe(false);
    expect(lifecycle.state.draftNotice.value).toBe('相册标题不能为空');
    expect(lifecycle.state.currentDraft.value).toEqual(currentDraft);
    await expect(lifecycle.cancelDraft()).resolves.toBe(true);
    expect(lifecycle.state.workingDraft.value).toBeNull();
    expect(lifecycle.state.draftPhotos.value).toEqual([]);
    expect(lifecycle.state.currentDraft.value).toBeNull();
    expect(fetcher.mock.calls.some(([input, init]) => input === '/api/drafts/album' && init?.method === 'DELETE')).toBe(true);
  });

  it('removes a restored image using its opaque id', async () => {
    const { lifecycle, fetcher } = await restored(currentDraft, (url, init) => {
      if (url === '/api/drafts/album/images/opaque-photo' && init?.method === 'DELETE') return new Response(null, {status:204});
      throw new Error(`Unexpected request: ${url}`);
    });
    await expect(lifecycle.removeDraftPhoto('opaque-photo')).resolves.toBe(true);
    expect(lifecycle.state.draftPhotos.value).toEqual([]);
    expect(fetcher.mock.calls[2][0]).toBe('/api/drafts/album/images/opaque-photo');
  });
});
