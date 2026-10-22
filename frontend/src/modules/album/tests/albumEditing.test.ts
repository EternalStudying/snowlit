import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from '../../../auth';
import { createHttpAlbumGateway } from '../internal/httpAlbumGateway';
import { useAlbumLifecycle } from '../internal/useAlbumLifecycle';
import { currentDraft, draftPhoto, firstPage, jsonResponse, publicDetail } from './fixtures';

const edit = { album: { ...publicDetail.album, hasPassword: true }, photos: publicDetail.photos };
const payload = { title: 'Changed', description: '', eventDate: '2026-05-20', location: '', visibility: 'private' as const, privatePassword: '', pinned: false };
afterEach(() => clearAuthToken());

describe('album editing', () => {
  it('uses every edit gateway path/body, omits blank passwords and supports keepalive cancellation', async () => {
    setAuthToken('fixture-token');
    const adapter = vi.fn(async (_path: string, init?: RequestInit) => init?.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(publicDetail));
    const gateway = createHttpAlbumGateway({ adapter, privateAccessStore: { get: () => null, set: vi.fn(), clear: vi.fn() } });
    await gateway.startEdit(1);
    await gateway.uploadEditPhoto(1, new File(['o'], 'a.jpg'), new File(['p'], 'p.webp'), { caption: '', takenAt: '2026-05-20', location: '', width: 1, height: 1, sortOrder: 2 });
    await gateway.removeEditPhoto(1, 'draft/id'); await gateway.cancelEdit(1, true);
    await gateway.saveAlbum(1, { ...payload, photos: [{ photoId: 101 }, { draftImageId: 'new' }] });
    await gateway.deleteAlbum(1); await gateway.reorderDraftPhotos(['b','a']);
    await gateway.publishDraft(payload, undefined, ['b','a']);
    expect(adapter.mock.calls.map(([path]) => path)).toEqual(['/api/albums/1/edit','/api/albums/1/edit/photos','/api/albums/1/edit/photos/draft%2Fid','/api/albums/1/edit','/api/albums/1','/api/albums/1','/api/drafts/album/images/order','/api/drafts/album/publish']);
    expect(adapter.mock.calls.map(([,init]) => init?.method)).toEqual(['POST','POST','DELETE','DELETE','PUT','DELETE','PUT','POST']);
    expect(adapter.mock.calls[3][1]?.keepalive).toBe(true);
    expect(JSON.parse(String(adapter.mock.calls[4][1]?.body))).toEqual({ ...payload, privatePassword: undefined, photos: [{photoId:101},{draftImageId:'new'}] });
    expect(JSON.parse(String(adapter.mock.calls[6][1]?.body))).toEqual({ ids:['b','a'] });
    expect(JSON.parse(String(adapter.mock.calls[7][1]?.body)).imageOrder).toEqual(['b','a']);
    expect(JSON.parse(String((adapter.mock.calls[1][1]?.body as FormData).get('metadata')))).not.toHaveProperty('sortOrder');
  });

  function setup() {
    setAuthToken('fixture-token');
    const adapter = vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null, {status:204});
      if (path.endsWith('/edit')) return jsonResponse(edit);
      if (path.endsWith('/edit/photos')) return jsonResponse(draftPhoto);
      if (path.includes('/api/albums?')) return jsonResponse(firstPage);
      if (path === '/api/drafts/album') return jsonResponse({draft:currentDraft});
      return jsonResponse(publicDetail);
    });
    return { adapter, lifecycle: useAlbumLifecycle({ adapter, generatePreview: async () => ({ file: new File(['p'],'p.webp'), width:1,height:1 }), isMobileUpload: () => false }) };
  }

  it('starts from published photos, keeps creation draft intact and saves grid order with photoId/draftImageId', async () => {
    const { adapter, lifecycle } = setup();
    const opened = await lifecycle.startEdit(1);
    expect(opened?.title).toBe(publicDetail.album.title);
    lifecycle.queueFiles([new File(['x'],'new.jpg',{type:'image/jpeg'})]);
    await vi.waitFor(() => expect(lifecycle.state.photoGrid.value[2].status).toBe('success'));
    await lifecycle.reorderPhotos(2,0);
    await lifecycle.saveAlbum(payload);
    const save = adapter.mock.calls.find(([path,init]) => path==='/api/albums/1' && init?.method==='PUT');
    expect(JSON.parse(String(save?.[1]?.body)).photos).toEqual([{draftImageId:draftPhoto.id},{photoId:101},{photoId:102}]);
    expect(adapter.mock.calls.some(([path]) => path.startsWith('/api/drafts'))).toBe(false);
  });

  it('reloads the catalog after saving so pinning and privacy show as the server lists them', async () => {
    const { adapter, lifecycle } = setup();
    await lifecycle.loadInitialCatalog(); await lifecycle.startEdit(1);
    const before = adapter.mock.calls.length;
    await lifecycle.saveAlbum(payload);
    const paths = adapter.mock.calls.slice(before).map(([path, init]) => `${init?.method ?? 'GET'} ${path.split('?')[0]}`);
    expect(paths).toEqual(['PUT /api/albums/1', 'GET /api/albums']);
  });

  it('discard cancels editing and a 404 delete still removes the catalog item', async () => {
    const { adapter, lifecycle } = setup();
    await lifecycle.loadInitialCatalog(); await lifecycle.startEdit(1); await lifecycle.cancelEdit();
    expect(adapter.mock.calls.some(([path,init]) => path==='/api/albums/1/edit' && init?.method==='DELETE')).toBe(true);
    adapter.mockImplementation(async () => jsonResponse({code:'ALBUM_NOT_FOUND',message:'相册不存在'},404));
    expect(await lifecycle.deleteAlbum(1)).toBe(true);
    expect(lifecycle.state.collections.value.some(album => album.albumId===1)).toBe(false);
    expect(lifecycle.state.catalogNotice.value).toBe('相册已被删除');
  });

  it('cover selection reorders creation immediately and publication carries the final order', async () => {
    const { adapter, lifecycle } = setup();
    await lifecycle.loadInitialCatalog();
    lifecycle.state.currentDraft.value = { ...currentDraft, images: [draftPhoto, { ...draftPhoto,id:'second' }] };
    lifecycle.resumeCurrentDraft();
    await lifecycle.reorderPhotos(1,0); await lifecycle.publishDraft({...payload, visibility:'public'});
    const reorder = adapter.mock.calls.find(([path]) => path.endsWith('/images/order'));
    expect(JSON.parse(String(reorder?.[1]?.body))).toEqual({ids:['second',draftPhoto.id]});
    const publish = adapter.mock.calls.find(([path]) => path.endsWith('/publish'));
    expect(JSON.parse(String(publish?.[1]?.body)).imageOrder).toEqual(['second',draftPhoto.id]);
  });
});
