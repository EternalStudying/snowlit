const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const presenter = require('../pages/album-edit/album-edit-presenter');

test('published album presenter keeps existing photos and builds ordered photo references', () => {
  const form = { ...presenter.createInitialAlbumForm('2026-05-02'), title: 'Example', visibility: 'private', privatePassword: '' };
  const result = presenter.buildAlbumSavePayload(form, [{ photoId: 12 }, { draftImageId: 'new-photo' }, { photoId: 11 }], 'private');
  assert.equal(result.valid, true);
  assert.deepEqual(result.payload.photos, [{ photoId: 12 }, { draftImageId: 'new-photo' }, { photoId: 11 }]);
  assert.equal(Object.hasOwn(result.payload, 'privatePassword'), false);
});

test('password is required for public to private only, and last photo cannot be removed', () => {
  assert.equal(presenter.albumPasswordRequired('private', 'private'), false);
  assert.equal(presenter.albumPasswordRequired('private', 'public'), true);
  assert.equal(presenter.albumPasswordRequired('public', 'private'), false);
  assert.equal(presenter.canRemoveAlbumPhoto(1, true), false);
  assert.equal(presenter.canRemoveAlbumPhoto(2, true), true);
  assert.equal(presenter.canRemoveAlbumPhoto(1, false), true);
});

test('sortable order derives slots and moves across rows with first, last, same and one-column edges', () => {
  const { slotFromCoordinates, moveItem } = require('../components/snowlit-sortable-grid/sortable-order');
  const layout = { left: 10, top: 20, cellWidth: 100, cellHeight: 110, columns: 3, count: 8 };
  assert.equal(slotFromCoordinates(15, 25, layout), 0);
  assert.equal(slotFromCoordinates(210, 135, layout), 5);
  assert.equal(slotFromCoordinates(400, 900, layout), 7);
  assert.equal(slotFromCoordinates(-100, -50, layout), 0);
  assert.equal(slotFromCoordinates(20, 260, { ...layout, columns: 1 }), 2);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(moveItem(['a'], 0, 0), ['a']);
  assert.deepEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b']);
});

const opened = [];
afterEach(() => opened.splice(0).forEach((p) => { if (p.autosave) p.autosave.stop(); if (p.unsubscribeSession) p.unsubscribeSession(); }));
function assign(target, key, value) { const parts = key.split('.'); parts.slice(0, -1).forEach((part) => { target = target[part]; }); target[parts.at(-1)] = value; }
async function settle() { for (let i = 0; i < 50; i += 1) await Promise.resolve(); }
function createPage(name, settings = {}) {
  Object.keys(require.cache).forEach((key) => { if (key.startsWith(root + path.sep) && !key.includes(path.sep + 'tests' + path.sep)) delete require.cache[key]; });
  let definition; let page;
  const calls = []; const uploads = []; const navigation = []; const alerts = []; const notices = []; const dialogs = [];
  const store = new Map([['snowlit_token', 'example-member']]);
  const album = { id: 7, title: 'Example album', eventDate: '2026-05-02', location: 'Example place', visibility: 'private', hasPassword: true, photoCount: 2, pinned: false };
  const photos = [11, 12].map((id) => ({ id, previewUrl: '/uploads/' + id + '.jpg', originalUrl: '/uploads/original-' + id + '.jpg', width: 4, height: 3 }));
  const finish = (call, data, statusCode = 200) => call.success({ statusCode, data });
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => settings.pages || [page];
  global.wx = {
    getStorageSync: (key) => store.get(key) || '', setStorageSync: (key, value) => store.set(key, value), removeStorageSync: (key) => store.delete(key), getStorageInfoSync: () => ({ keys: [...store.keys()] }),
    showToast: (value) => notices.push(value.title), setNavigationBarTitle() {},
    enableAlertBeforeUnload: (value) => alerts.push(value.message), disableAlertBeforeUnload: () => alerts.push('disabled'),
    navigateBack: (value) => navigation.push(['back', value]), switchTab: (value) => navigation.push(['tab', value.url]), navigateTo: (value) => navigation.push(['to', value.url]),
    request(call) {
      calls.push(call); const url = new URL(call.url).pathname;
      if (url === '/api/weather/atmosphere/browser') finish(call, { city: 'Photo city', country: 'Example country' });
      else if (url.endsWith('/edit') && call.method === 'POST') finish(call, { album, photos });
      else if (url.startsWith('/api/drafts/') && call.method === 'GET') finish(call, { draft: null });
      else if (settings.saveError && call.method === 'PUT' && url === '/api/albums/7') finish(call, { code: settings.saveError, message: settings.saveError === 'ALBUM_NOT_FOUND' ? '相册不存在' : '编辑已失效，请重新打开相册编辑' }, settings.saveError === 'ALBUM_NOT_FOUND' ? 404 : 409);
      else if (settings.detailMissing && call.method === 'GET') finish(call, { code: 'ALBUM_NOT_FOUND', message: '相册不存在' }, 404);
      else if (url === '/api/albums/7' && call.method === 'GET') finish(call, { album, photos, canManage: settings.canManage !== false });
      else if (url === '/api/albums/7' && call.method === 'DELETE' && settings.deleteMissing) finish(call, { code: 'ALBUM_NOT_FOUND', message: '相册不存在' }, 404);
      else finish(call, { album, photos, canManage: true });
    },
    uploadFile(call) { uploads.push(call); if (!settings.waitUpload) finish(call, JSON.stringify({ id: 'new-photo', url: '/uploads/new.jpg' })); return { onProgressUpdate() {} }; },
    compressImage: ({ src, success }) => success({ tempFilePath: src + '.small' }),
    getFileSystemManager: () => ({ readFile: ({ success, fail }) => settings.exif ? success({ data: settings.exif }) : fail({}) })
  };
  require(path.join(root, 'pages', name, 'index.js'));
  page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)), setData(patch) { Object.keys(patch).forEach((key) => assign(this.data, key, patch[key])); }, selectComponent(selector) { if (selector === '#snowlit-toast') return { show: (value) => notices.push(value.title) }; if (selector === '#snowlit-dialog') return { open: (options) => { dialogs.push(options); return Promise.resolve({ confirm: settings.confirm !== false }); } }; return null; } };
  opened.push(page);
  return { page, calls, uploads, navigation, alerts, notices, dialogs, finish, album, photos, setToken: require('../utils/auth').setToken };
}

test('edit starts without creation drafts, saves grid order with blank password omitted', async () => {
  const c = createPage('album-edit'); await c.page.onLoad({ albumId: '7' });
  assert.equal(c.calls.some((call) => call.url.includes('/api/drafts/')), false);
  assert.equal(c.page.autosave, undefined); assert.equal(c.page.data.editMode, true);
  assert.deepEqual(c.page.data.photos.map((p) => p.photoId), [11, 12]);
  await c.page.reorderPhotos({ detail: { from: 1, to: 0 } });
  await c.page.saveAlbum();
  const save = c.calls.find((call) => call.method === 'PUT');
  assert.deepEqual(save.data.photos, [{ photoId: 12 }, { photoId: 11 }]);
  assert.equal(Object.hasOwn(save.data, 'privatePassword'), false);
  assert.deepEqual(c.alerts, ['放弃修改？', 'disabled']);
});

test('edit settles date and place, new image uses edit upload and its own metadata', async () => {
  const c = createPage('album-edit'); await c.page.onLoad({ albumId: '7' });
  assert.equal(c.page.isSettled('eventDate'), true); assert.equal(c.page.isSettled('location'), true);
  c.page.updatePhotos(c.page.data.photos.concat({ id: 'picked', path: 'wxfile://new.jpg', takenAt: '2020-01-02', location: 'Photo place', width: 4, height: 3, status: 'local' }));
  await c.page.fillFromPhotos([c.page.data.photos[2]]); await c.page.uploadPhotos();
  assert.equal(c.page.data.form.eventDate, '2026-05-02'); assert.equal(c.page.data.form.location, 'Example place');
  assert.equal(new URL(c.uploads[0].url).pathname, '/api/albums/7/edit/photos');
  assert.equal(JSON.parse(c.uploads[0].formData.metadata).takenAt, '2020-01-02');
  assert.equal(c.page.data.photos[2].draftImageId, 'new-photo');
});

test('edit missing save returns to albums, expired save stays, and unload cancels after uploads', async () => {
  for (const code of ['ALBUM_NOT_FOUND', 'ALBUM_EDIT_EXPIRED']) {
    const c = createPage('album-edit', { saveError: code }); await c.page.onLoad({ albumId: '7' }); await c.page.saveAlbum();
    assert.equal(c.page.data.message, code === 'ALBUM_NOT_FOUND' ? '相册已被删除' : '编辑已失效，请重新打开相册编辑');
    assert.equal(c.navigation.some(([type]) => type === 'tab'), code === 'ALBUM_NOT_FOUND');
  }
  const c = createPage('album-edit', { waitUpload: true }); await c.page.onLoad({ albumId: '7' });
  c.page.updatePhotos(c.page.data.photos.concat({ id: 'picked', path: 'wxfile://new.jpg', status: 'local' }));
  const uploading = c.page.uploadPhotos(); await settle(); const leaving = c.page.onUnload(); await settle();
  assert.equal(c.calls.some((call) => call.method === 'DELETE'), false);
  c.finish(c.uploads[0], JSON.stringify({ id: 'new-photo', url: '/uploads/new.jpg' })); await uploading; await leaving;
  assert.equal(c.calls.some((call) => call.method === 'DELETE' && new URL(call.url).pathname === '/api/albums/7/edit'), true);
});

test('creation reorder saves uploaded IDs and publish includes final imageOrder', async () => {
  const c = createPage('album-edit'); await c.page.onLoad({});
  c.page.setData({ form: { ...c.page.data.form, title: 'Example', eventDate: '2026-05-02' } });
  c.page.updatePhotos(['a', 'b'].map((id) => ({ id, serverId: id, path: id, url: id, status: 'uploaded' })));
  await c.page.reorderPhotos({ detail: { from: 1, to: 0 } }); await c.page.saveAlbum();
  assert.deepEqual(c.calls.find((call) => call.url.endsWith('/images/order')).data, { ids: ['b', 'a'] });
  assert.deepEqual(c.calls.find((call) => call.url.endsWith('/publish')).data.imageOrder, ['b', 'a']);
});

test('album detail exposes manager actions, confirms deletion and refreshes both open tabs', async () => {
  let lists = 0; let homes = 0;
  const c = createPage('album-detail'); c.page.data.albumId = 7; await c.page.loadAlbumDetail();
  assert.equal(c.page.data.album.canManage, true);
  global.getCurrentPages = () => [{ route: 'pages/albums/index', loadAlbums: () => lists++ }, { route: 'pages/index/index', loadHome: () => homes++ }, c.page];
  c.page.editAlbum(); assert.deepEqual(c.navigation.at(-1), ['to', '/pages/album-edit/index?albumId=7']);
  await c.page.deleteAlbum();
  assert.equal(c.dialogs[0].title, '删除相册'); assert.match(c.dialogs[0].content, /2 张照片会一起删除，无法恢复/);
  assert.equal(lists, 1); assert.equal(homes, 1); assert.equal(c.navigation.at(-1)[0], 'back');
  const markup = fs.readFileSync(path.join(root, 'pages/album-detail/index.wxml'), 'utf8');
  assert.match(markup, /wx:if="{{album.canManage}}"/);
  const other = createPage('album-detail', { canManage: false }); other.page.data.albumId = 7; await other.page.loadAlbumDetail();
  other.page.editAlbum(); await other.page.deleteAlbum(); assert.deepEqual(other.navigation, []); assert.deepEqual(other.dialogs, []);
});

test('deleted detail has a back state and an already deleted album delete succeeds', async () => {
  const missing = createPage('album-detail', { detailMissing: true }); missing.page.data.albumId = 7; await missing.page.loadAlbumDetail();
  assert.equal(missing.page.data.message, '相册不存在'); assert.equal(missing.page.data.album, null);
  const c = createPage('album-detail', { deleteMissing: true }); c.page.data.albumId = 7; await c.page.loadAlbumDetail(); await c.page.deleteAlbum(); assert.equal(c.navigation.at(-1)[0], 'tab');
});


test('valid new-photo EXIF cannot overwrite settled edit fields, including an empty location', async () => {
  const { buildJpeg } = require('./helpers/exif-jpeg');
  const exif = buildJpeg({ dateTimeOriginal: '2020:01:02 12:30:00', gps: { latRef: 'N', lat: [[8, 1], [0, 1], [0, 1]], lonRef: 'E', lon: [[9, 1], [0, 1], [0, 1]] } });
  const c = createPage('album-edit', { exif }); await c.page.onLoad({ albumId: '7' });
  c.page.data.form.location = '';
  const photo = { id: 'picked', path: 'wxfile://new.jpg', width: 4, height: 3, status: 'local' };
  c.page.updatePhotos(c.page.data.photos.concat(photo));
  await c.page.fillFromPhotos([photo]); await c.page.uploadPhotos();
  assert.equal(c.page.data.form.eventDate, '2026-05-02'); assert.equal(c.page.data.form.location, '');
  const metadata = JSON.parse(c.uploads[0].formData.metadata);
  assert.equal(metadata.takenAt, '2020-01-02'); assert.equal(metadata.location, 'Photo city，Example country');
});

test('reordering during upload keeps server IDs attached to the picked photo and publishes final order', async () => {
  const c = createPage('album-edit', { waitUpload: true }); await c.page.onLoad({});
  c.page.data.form.title = 'Example'; c.page.data.form.eventDate = '2026-05-02';
  c.page.updatePhotos(['first', 'second'].map((id) => ({ id, path: 'wxfile://' + id + '.jpg', width: 4, height: 3, status: 'local' })));
  const uploading = c.page.uploadPhotos(); await settle();
  await c.page.reorderPhotos({ detail: { from: 1, to: 0 } });
  c.finish(c.uploads[0], JSON.stringify({ id: 'first-server', url: '/uploads/first.jpg' })); await settle();
  assert.equal(c.page.data.photos[1].serverId, 'first-server');
  assert.equal(c.uploads[1].filePath, 'wxfile://second.jpg.small');
  c.finish(c.uploads[1], JSON.stringify({ id: 'second-server', url: '/uploads/second.jpg' })); await uploading;
  await c.page.saveAlbum();
  assert.deepEqual(c.calls.find((call) => call.url.endsWith('/publish')).data.imageOrder, ['second-server', 'first-server']);
});

test('edit removes existing photos locally, removes unsaved images through edit API, and keeps the last', async () => {
  const c = createPage('album-edit'); await c.page.onLoad({ albumId: '7' });
  await c.page.removePhoto({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(c.calls.some((call) => call.method === 'DELETE'), false);
  c.page.updatePhotos(c.page.data.photos.concat({ id: 'added', draftImageId: 'new/id', path: 'example', url: 'example', status: 'uploaded' }));
  await c.page.removePhoto({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(c.calls.some((call) => new URL(call.url).pathname === '/api/albums/7/edit/photos/new%2Fid'), true);
  await c.page.removePhoto({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(c.page.data.photos.length, 1); assert.equal(c.notices.at(-1), '相册至少保留 1 张照片');
});

test('successful edit marks detail changed and refreshes albums and Home; returning reloads detail', async () => {
  let lists = 0; let homes = 0; let details = 0;
  const c = createPage('album-edit'); await c.page.onLoad({ albumId: '7' });
  const detail = { route: 'pages/album-detail/index', data: { albumId: 7 } };
  global.getCurrentPages = () => [{ route: 'pages/albums/index', loadAlbums: () => lists++ }, { route: 'pages/index/index', loadHome: () => homes++ }, detail, c.page];
  await c.page.saveAlbum(); assert.equal(detail.albumChanged, true); assert.equal(lists, 1); assert.equal(homes, 1);
  await c.page.onUnload(); assert.equal(c.calls.some((call) => call.method === 'DELETE'), false);
  const d = createPage('album-detail'); d.page.albumChanged = true; d.page.loadAlbumDetail = () => { details++; return Promise.resolve(); };
  await d.page.onShow(); await d.page.onShow(); assert.equal(details, 1);
});

test('account changes clear the edit form, ignore late uploads and never cancel the new member draft', async () => {
  const c = createPage('album-edit', { waitUpload: true }); await c.page.onLoad({ albumId: '7' });
  c.page.updatePhotos(c.page.data.photos.concat({ id: 'picked', path: 'wxfile://new.jpg', status: 'local' }));
  const uploading = c.page.uploadPhotos(); await settle(); c.setToken('different-example-member');
  assert.deepEqual(c.page.data.photos, []); assert.deepEqual(c.page.data.gridItems, []); assert.equal(c.page.data.draftLocked, true);
  c.finish(c.uploads[0], JSON.stringify({ id: 'late', url: '/uploads/late.jpg' })); await uploading; await c.page.onUnload();
  assert.equal(c.calls.some((call) => call.method === 'DELETE'), false);
});

test('album services use every edit path, shared mobile upload and order/publish envelopes', async () => {
  const c = createPage('album-edit');
  const album = require('../services/album'); const draft = require('../services/draft');
  const payload = { title: 'Example', photos: [{ photoId: 11 }] };
  await album.startAlbumEdit(7); await album.uploadAlbumEditPhoto(7, 'wxfile://new.jpg', { takenAt: '2026-05-02' });
  await album.removeAlbumEditPhoto(7, 'opaque/id'); await album.cancelAlbumEdit(7); await album.saveAlbum(7, payload); await album.deleteAlbum(7);
  await draft.reorderDraftImages('album', ['b', 'a']); await draft.publishDraft('album', { title: 'Example' }, { imageOrder: ['b', 'a'] });
  assert.deepEqual(c.calls.map((call) => [new URL(call.url).pathname, call.method]), [
    ['/api/albums/7/edit', 'POST'], ['/api/albums/7/edit/photos/opaque%2Fid', 'DELETE'], ['/api/albums/7/edit', 'DELETE'],
    ['/api/albums/7', 'PUT'], ['/api/albums/7', 'DELETE'], ['/api/drafts/album/images/order', 'PUT'], ['/api/drafts/album/publish', 'POST']
  ]);
  assert.equal(c.uploads[0].name, 'file'); assert.equal(new URL(c.uploads[0].url).pathname, '/api/albums/7/edit/photos');
  assert.deepEqual(JSON.parse(c.uploads[0].formData.metadata), { takenAt: '2026-05-02' });
  assert.deepEqual(c.calls[3].data, payload); assert.deepEqual(c.calls[5].data, { ids: ['b', 'a'] }); assert.deepEqual(c.calls[6].data.imageOrder, ['b', 'a']);
});
