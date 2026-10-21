import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from '../../../auth';
import { createHttpAlbumGateway } from '../internal/httpAlbumGateway';
import { currentDraft, draftPhoto, jsonResponse, publicDetail } from './fixtures';

afterEach(() => clearAuthToken());
describe('album draft gateway', () => {
  it('uses only kind paths, whitelists fields, and keeps passwords publish-only', async () => {
    setAuthToken('test-token');
    const adapter = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null, {status:204});
      if (String(input).endsWith('/images')) return jsonResponse(draftPhoto);
      if (String(input).endsWith('/publish')) return jsonResponse(publicDetail);
      return jsonResponse(init?.method === 'PUT' ? currentDraft : {draft:currentDraft});
    });
    const gateway = createHttpAlbumGateway({ adapter, privateAccessStore: { get: () => null, set: vi.fn(), clear: vi.fn() } });
    const form = { title:'Private', description:'', eventDate:'2026-05-20', location:'', visibility:'private' as const, privatePassword:'test-password' };
    await gateway.fetchCurrentDraft(); await gateway.createDraft(form);
    await gateway.uploadDraftPhoto(new File(['o'],'o.jpg'), new File(['p'],'p.webp'), {caption:'Photo', takenAt:'2026-05-20', location:'', width:1, height:1, sortOrder:7});
    await gateway.publishDraft(form, form.privatePassword);
    await gateway.removeDraftPhoto('opaque/id'); await gateway.cancelDraft();
    expect(adapter.mock.calls.map(([url]) => url)).toEqual([
      '/api/drafts/album', '/api/drafts/album', '/api/drafts/album/images',
      '/api/drafts/album/publish', '/api/drafts/album/images/opaque%2Fid', '/api/drafts/album'
    ]);
    expect(adapter.mock.calls.map(([,init]) => init?.method ?? 'GET')).toEqual(['GET','PUT','POST','POST','DELETE','DELETE']);
    expect(JSON.parse(String(adapter.mock.calls[1][1]?.body))).toEqual({fields:{title:'Private',description:'',eventDate:'2026-05-20',location:'',visibility:'private'}});
    const metadata = JSON.parse(String((adapter.mock.calls[2][1]?.body as FormData).get('metadata')));
    expect(metadata).toEqual({caption:'Photo',takenAt:'2026-05-20',location:'',width:1,height:1});
    expect(JSON.parse(String(adapter.mock.calls[3][1]?.body))).toEqual({fields:{title:'Private',description:'',eventDate:'2026-05-20',location:'',visibility:'private'},privatePassword:'test-password'});
  });

  it('leaves a cleared album date out of the saved fields', async () => {
    setAuthToken('test-token');
    const adapter = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(currentDraft));
    const gateway = createHttpAlbumGateway({ adapter, privateAccessStore: { get: () => null, set: vi.fn(), clear: vi.fn() } });
    await gateway.createDraft({ title:'Untitled', description:'', eventDate:'', location:'', visibility:'public' as const, privatePassword:'' });
    expect(JSON.parse(String(adapter.mock.calls[0][1]?.body)).fields).not.toHaveProperty('eventDate');
  });
});
