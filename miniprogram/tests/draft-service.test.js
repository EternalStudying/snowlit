const assert = require('node:assert/strict');
const { test } = require('node:test');
const calls = [];
const uploads = [];
global.wx = {
  getStorageSync: () => 'draft-token',
  request(options) { calls.push(options); options.success({ statusCode: options.method === 'DELETE' ? 204 : 200, data: { draft: null } }); },
  uploadFile(options) {
    uploads.push(options);
    options.success({ statusCode: 200, data: JSON.stringify({ id: 'opaque-image', url: '/uploads/draft/image.jpg' }) });
    return { onProgressUpdate(handler) { handler({ progress: 68 }); } };
  }
};
const { getDraft, saveDraft, discardDraft, uploadDraftImage, removeDraftImage, publishDraft } = require('../services/draft');

test('draft service uses kind-scoped paths, fields envelopes and publish-only password', async () => {
  await getDraft('album');
  await saveDraft('album', { title: '', visibility: 'private' });
  await publishDraft('album', { title: 'Example' }, { privatePassword: 'example-password' });
  await removeDraftImage('album', 'opaque/image');
  await discardDraft('album');
  assert.deepEqual(calls.map((call) => [new URL(call.url).pathname, call.method]), [
    ['/api/drafts/album', 'GET'], ['/api/drafts/album', 'PUT'], ['/api/drafts/album/publish', 'POST'],
    ['/api/drafts/album/images/opaque%2Fimage', 'DELETE'], ['/api/drafts/album', 'DELETE']
  ]);
  assert.deepEqual(calls[1].data, { fields: { title: '', visibility: 'private' } });
  assert.deepEqual(calls[2].data, { fields: { title: 'Example' }, privatePassword: 'example-password' });
  calls.forEach((call) => assert.equal(call.header.Authorization, 'Bearer draft-token'));
});

test('draft images use shared upload wrapper, album metadata only and raw server URLs', async () => {
  const progress = [];
  const metadata = { width: 4, height: 3, caption: 'Example' };
  const result = await uploadDraftImage('album', 'wxfile://example.jpg', metadata, (value) => progress.push(value.progress));
  await uploadDraftImage('diary', 'wxfile://diary.jpg', null);
  await uploadDraftImage('moment', 'wxfile://moment.jpg', null);
  assert.deepEqual(result, { id: 'opaque-image', url: '/uploads/draft/image.jpg' });
  assert.deepEqual(progress, [68]);
  assert.deepEqual(uploads.map((call) => new URL(call.url).pathname), ['/api/drafts/album/images', '/api/drafts/diary/images', '/api/drafts/moment/images']);
  assert.deepEqual(JSON.parse(uploads[0].formData.metadata), metadata);
  assert.deepEqual(uploads[1].formData, {});
  assert.deepEqual(uploads[2].formData, {});
  uploads.forEach((call) => { assert.equal(call.name, 'file'); assert.equal(call.header.Authorization, 'Bearer draft-token'); });
});
