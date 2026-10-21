const assert = require('node:assert/strict');
const path = require('node:path');
const { test, afterEach } = require('node:test');
const root = path.resolve(__dirname, '..');
const opened = [];
afterEach(() => opened.splice(0).forEach((page) => { if (page.autosave) page.autosave.stop(); }));

async function settle() { for (let i = 0; i < 45; i += 1) await Promise.resolve(); }
function assign(target, key, value) {
  const parts = key.split('.');
  parts.slice(0, -1).forEach((part) => { target = target[part]; });
  target[parts.at(-1)] = value;
}
const routes = { album: 'album-edit', diary: 'diary-edit', moment: 'story-edit' };
const inputs = { album: 'choosePhotos', diary: 'chooseImages', moment: 'chooseImages' };
const submits = { album: 'saveAlbum', diary: 'saveDiary', moment: 'submitMoment' };
const lists = { album: 'photos', diary: 'images', moment: 'images' };
const fields = {
  album: { title: 'Saved album', eventDate: '2026-05-20', location: 'Example place', visibility: 'private', pinned: true },
  diary: { contentMarkdown: '# Saved diary\n\nSaved body', date: '2026-05-20', moodKey: 'calm', visibility: 'private', weatherSnapshot: { weather: '晴', temperature: 18 } },
  moment: { title: 'Saved moment', content: 'Saved body', eventTime: '2026-05-20T12:30:00', locationName: 'Example place', longitude: 12, latitude: 3, category: 'travel' }
};
function createPage(kind, settings = {}) {
  Object.keys(require.cache).forEach((key) => { if (key.startsWith(`${root}${path.sep}`) && !key.includes(`${path.sep}tests${path.sep}`)) delete require.cache[key]; });
  let definition;
  let page;
  const storage = new Map([['snowlit_token', 'member-a']]);
  const calls = [];
  const uploads = [];
  const dialogs = [];
  const picks = [];
  const toasts = [];
  const finish = (call, data = {}, statusCode = 200) => call.success({ statusCode, data });
  const draft = settings.draft ? { kind, fields: fields[kind], images: Array.from({ length: settings.imageCount || 1 }, (_, index) => ({ id: index ? `saved-image-${index}` : 'saved-image', url: index ? `/uploads/saved-${index}.jpg` : '/uploads/saved.jpg', width: 4, height: 3, takenAt: '2026-05-19', location: 'Photo place' })), updatedAt: '2026-05-20T21:14:00', createdAt: '2026-05-20T20:00:00' } : null;
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => [page];
  global.wx = {
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    showToast: (value) => toasts.push(value.title),
    navigateBack() {}, switchTab() {}, redirectTo() {}, navigateTo() {},
    chooseMedia: (options) => {
      picks.push(options);
      options.success({ tempFiles: Array.from({ length: settings.fullBatch ? options.count : 1 }, (_, index) => ({ tempFilePath: settings.fullBatch ? `wxfile://picked-${picks.length}-${index}.jpg` : 'wxfile://picked.jpg', width: 4, height: 3 })) });
    },
    getFileSystemManager: () => ({ readFile: ({ fail }) => fail({}) }),
    compressImage: ({ src, success }) => success({ tempFilePath: `${src}.compressed` }),
    request(call) {
      calls.push(call);
      const url = new URL(call.url).pathname;
      if (url.startsWith('/api/drafts/')) {
        if (call.method === 'GET') finish(call, { draft });
        else if (call.method === 'PUT' && !settings.waitSave) finish(call, { ...draft, fields: call.data.fields, updatedAt: '2026-05-20T21:15:00' });
        else if (url.endsWith('/publish') && !settings.waitPublish) finish(call, settings.publishError ? { code: 'EXAMPLE_PUBLISH_CONFLICT', message: 'Example conflict' } : { id: 25 }, settings.publishError ? 409 : 200);
        else if (call.method === 'DELETE' && !settings.waitDelete) finish(call, settings.deleteError ? { code: 'EXAMPLE_DELETE_FAILED', message: 'Example remove failure' } : null, settings.deleteError ? 502 : 204);
      } else if (url.startsWith('/api/diary/') && call.method === 'GET') {
        finish(call, { id: 7, title: 'Existing diary', entryDate: '2026-05-20', contentMarkdown: '# Existing diary\n\nBody', moodKey: 'happy', visibility: 'shared' });
      } else if (url.startsWith('/api/story/moments/') && call.method === 'GET') finish(call, { id: 7, ...fields.moment, images: [] });
      else finish(call, { id: 7 });
    },
    uploadFile(call) {
      uploads.push(call);
      if (!settings.waitUpload) finish(call, JSON.stringify({ id: `image-${uploads.length}`, url: `/uploads/picked-${uploads.length}.jpg` }));
      return { onProgressUpdate(callback) { callback({ progress: 53 }); } };
    }
  };
  require(path.join(root, `pages/${routes[kind]}/index.js`));
  page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) { Object.keys(patch).forEach((key) => assign(this.data, key, patch[key])); },
    selectComponent(selector) {
      if (selector === '#snowlit-privacy') return { authorize: () => Promise.resolve(true) };
      if (selector === '#snowlit-toast') return { show: (value) => toasts.push(value.title) };
      if (selector === '#snowlit-dialog') return { open: (options) => new Promise((resolve) => {
        dialogs.push({ options, resolve });
        if (!settings.waitDialog) resolve({ confirm: settings.confirm !== false });
      }) };
      return null;
    }
  };
  opened.push(page);
  return { page, calls, uploads, dialogs, picks, toasts, finish, setToken: require('../utils/auth').setToken,
    saves: () => calls.filter((call) => call.method === 'PUT' && call.url.includes('/api/drafts/')),
    publishes: () => calls.filter((call) => call.url.endsWith('/publish')) };
}
function fillValid(c, kind) {
  const page = c.page;
  if (kind === 'album') Object.assign(page.data.form, { title: 'Latest album', eventDate: '2026-05-21', privatePassword: 'example-password' });
  if (kind === 'diary') Object.assign(page.data.form, { title: 'Latest diary', content: 'Latest body', date: '2026-05-21' });
  if (kind === 'moment') Object.assign(page.data.form, { title: 'Latest moment', content: 'Latest body', locationName: 'Example', longitude: '12', latitude: '3' });
  page.changed();
}

for (const kind of Object.keys(routes)) {
  test(`${kind}: a retained draft locks the form until Continue restores its fields and images`, async () => {
    const c = createPage(kind, { draft: true, waitDialog: true });
    const load = c.page.onLoad({}); await settle();
    assert.equal(c.page.data.draftLocked, true);
    assert.equal(c.dialogs.length, 1);
    assert.equal(c.dialogs[0].options.title, '继续上次的草稿？');
    assert.equal(c.dialogs[0].options.confirmText, '继续编辑');
    assert.equal(c.dialogs[0].options.cancelText, '放弃草稿');
    assert.match(c.dialogs[0].options.content, /5月20日 21:14/);
    if (kind === 'diary') c.page.handleTitleInput({ detail: { value: 'Blocked' } });
    else c.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Blocked' } });
    assert.equal(c.page.data.form.title, '');
    c.dialogs[0].resolve({ confirm: true }); await load;
    assert.equal(c.page.data.draftLocked, false);
    assert.equal(c.page.data.form.title, `Saved ${kind === 'diary' ? 'diary' : kind}`);
    assert.equal(c.page.data[lists[kind]][0].serverId, 'saved-image');
    assert.match(c.page.data[lists[kind]][0].path, /^http:\/\/localhost:8080\/uploads\/saved.jpg$/);
    assert.equal(c.uploads.length, 0, 'resumed photos must never upload again');
    if (kind === 'album') assert.equal(c.page.data.form.privatePassword, '');
    if (kind === 'diary') assert.deepEqual(c.page.data.form.weatherSnapshot, fields.diary.weatherSnapshot);
  });

  test(`${kind}: Discard removes the existing draft and opens an empty form`, async () => {
    const c = createPage(kind, { draft: true, confirm: false });
    await c.page.onLoad({});
    assert.equal(c.calls.filter((call) => call.method === 'DELETE' && new URL(call.url).pathname === `/api/drafts/${kind}`).length, 1);
    assert.equal(c.page.data.form.title, '');
    assert.deepEqual(c.page.data[lists[kind]], []);
    assert.equal(c.page.data.draftLocked, false);
  });

  test(`${kind}: picking uploads immediately; hide flushes fields and publish uses the newest form`, async () => {
    const c = createPage(kind);
    await c.page.onLoad({});
    await c.page[inputs[kind]](); await settle();
    assert.equal(c.uploads.length, 1);
    assert.equal(new URL(c.uploads[0].url).pathname, `/api/drafts/${kind}/images`);
    assert.equal(c.page.data[lists[kind]][0].serverId, 'image-1');
    assert.equal(c.page.data[lists[kind]][0].status, 'uploaded');
    assert.equal(c.publishes().length, 0);
    if (kind === 'album') assert.equal(c.uploads[0].filePath, 'wxfile://picked.jpg.compressed');
    if (kind === 'diary') {
      assert.match(c.page.data.form.content, /!\[图片]\(\/uploads\/picked-1.jpg\)/);
      assert.match(c.page.data.previewBlocks.find((block) => block.type === 'image').url, /^http:\/\/localhost:8080\/uploads\//);
    }
    fillValid(c, kind); await c.page.onHide();
    assert.equal(c.saves().length, 1);
    assert.equal(c.saves()[0].data.fields.privatePassword, undefined);
    fillValid(c, kind);
    c.page.data.form.title += ' newest';
    await c.page[submits[kind]](); await settle();
    assert.equal(c.publishes().length, 1);
    const latest = c.publishes()[0].data;
    if (kind === 'diary') assert.match(latest.fields.contentMarkdown, /^# Latest diary newest\n\nLatest body$/);
    else assert.match(latest.fields.title, / newest$/);
    assert.equal(latest.fields.images, undefined);
    if (kind === 'album') assert.equal(latest.privatePassword, '');
    const savedCount = c.saves().length;
    await c.page.onHide(); await c.page.onUnload();
    assert.equal(c.saves().length, savedCount, 'success must not be followed by a recreating PUT');
  });

  test(`${kind}: unload issues a dirty save before stopping the helper`, async () => {
    const c = createPage(kind); await c.page.onLoad({}); fillValid(c, kind);
    await c.page.onUnload();
    assert.equal(c.saves().length, 1);
  });

  test(`${kind}: a token change immediately clears state and ignores a late upload`, async () => {
    const c = createPage(kind, { waitUpload: true }); await c.page.onLoad({});
    const pick = c.page[inputs[kind]](); await settle(); assert.equal(c.uploads.length, 1);
    c.setToken('member-b');
    assert.equal(c.page.data.form.title, '');
    assert.deepEqual(c.page.data[lists[kind]], []);
    assert.equal(c.page.data.draftLocked, true);
    c.finish(c.uploads[0], JSON.stringify({ id: 'late-image', url: '/uploads/late.jpg' }));
    await pick; await settle();
    assert.deepEqual(c.page.data[lists[kind]], []);
    assert.equal(c.saves().length, 0);
  });
}

for (const kind of ['diary', 'moment']) {
  test(`${kind}: editing existing records never touches the drafts API`, async () => {
    const c = createPage(kind);
    await c.page.onLoad(kind === 'diary' ? { diaryId: '7' } : { momentId: '7' });
    await c.page[inputs[kind]](); await settle();
    await c.page.onHide(); await c.page[submits[kind]](); await c.page.onUnload();
    assert.equal(c.calls.some((call) => call.url.includes('/api/drafts/')), false);
    assert.equal(c.uploads.some((call) => call.url.includes('/api/drafts/')), false);
    assert.equal(c.calls.some((call) => call.method === 'PUT' && call.url.endsWith('/7')), true);
    assert.equal(new URL(c.uploads[0].url).pathname, kind === 'diary' ? '/api/diary/images' : '/api/story/moments/images');
  });
}

test('album: private password is excluded from autosave and must be entered again before publish', async () => {
  const c = createPage('album', { draft: true }); await c.page.onLoad({});
  await c.page.saveAlbum(); assert.equal(c.publishes().length, 0);
  assert.equal(c.page.data.message, '请输入私密相册密码');
  c.page.handleInput({ currentTarget: { dataset: { field: 'privatePassword' } }, detail: { value: 'new-example-password' } });
  c.page.handleInput({ currentTarget: { dataset: { field: 'description' } }, detail: { value: 'New description' } });
  await c.page.onHide();
  assert.equal(c.saves()[0].data.fields.privatePassword, undefined);
  await c.page.saveAlbum();
  assert.equal(c.publishes()[0].data.privatePassword, 'new-example-password');
  assert.equal(c.publishes()[0].data.fields.privatePassword, undefined);
});

test('album: publish serializes an earlier field save and cannot leave a delayed recreating save', async () => {
  const c = createPage('album', { draft: true, waitSave: true }); await c.page.onLoad({});
  c.page.data.form.privatePassword = 'example-password';
  c.page.changed(); const hidden = c.page.onHide(); await settle(); assert.equal(c.saves().length, 1);
  c.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Newest title' } });
  const publishing = c.page.saveAlbum(); await settle(); assert.equal(c.publishes().length, 0);
  c.finish(c.saves()[0], { updatedAt: '2026-05-20T21:16:00' }); await settle(); assert.equal(c.saves().length, 2);
  assert.equal(c.saves()[1].data.fields.title, 'Newest title'); assert.equal(c.publishes().length, 0);
  c.finish(c.saves()[1], { updatedAt: '2026-05-20T21:17:00' }); await hidden; await publishing;
  assert.equal(c.publishes().length, 1);
  assert.equal(c.publishes()[0].data.fields.title, 'Newest title');
  await c.page.onHide(); assert.equal(c.saves().length, 2);
});

test('a session change while the resume dialog is open does not restore the previous member draft', async () => {
  const c = createPage('album', { draft: true, waitDialog: true });
  const loading = c.page.onLoad({}); await settle(); c.setToken('member-b');
  c.dialogs[0].resolve({ confirm: true }); await loading;
  assert.equal(c.page.data.form.title, ''); assert.deepEqual(c.page.data.photos, []);
  assert.equal(c.page.data.draftLocked, true);
});

for (const kind of ['album', 'moment']) {
  test(`${kind}: removing a resumed server image uses only its opaque draft image id`, async () => {
    const c = createPage(kind, { draft: true }); await c.page.onLoad({});
    await c.page[kind === 'album' ? 'removePhoto' : 'removeImage']({ currentTarget: { dataset: { index: 0 } } });
    assert.deepEqual(c.page.data[lists[kind]], []);
    assert.equal(c.calls.some((call) => call.method === 'DELETE' && call.url.endsWith(`/api/drafts/${kind}/images/saved-image`)), true);
  });
}

for (const kind of Object.keys(routes)) {
  test(`${kind}: a failed publish retains form and uploaded images, and later edits still autosave`, async () => {
    const c = createPage(kind, { publishError: true }); await c.page.onLoad({});
    await c.page[inputs[kind]](); await settle(); fillValid(c, kind);
    await c.page[submits[kind]]();
    assert.equal(c.page.data.message, 'Example conflict');
    assert.equal(c.page.data[lists[kind]].length, 1);
    assert.equal(c.page.data[lists[kind]][0].status, 'uploaded');
    assert.equal(c.calls.some((call) => call.method === 'DELETE'), false, 'failure never discards the draft');
    c.page.changed(); const before = c.saves().length; await c.page.onHide(); assert.equal(c.saves().length, before + 1);
  });
}

test('a token change during a paused publish still drops all former-member state immediately', async () => {
  const c = createPage('album', { draft: true, waitPublish: true }); await c.page.onLoad({});
  c.page.data.form.privatePassword = 'example-password';
  const publishing = c.page.saveAlbum(); await settle(); assert.equal(c.publishes().length, 1);
  c.setToken('member-b');
  assert.deepEqual(c.page.data.photos, []); assert.equal(c.page.data.form.title, ''); assert.equal(c.page.data.draftLocked, true);
  c.finish(c.publishes()[0], { id: 25 }); await publishing;
  assert.equal(c.page.data.form.title, '');
});

for (const kind of Object.keys(routes)) {
  test(`${kind}: pressing publish waits for the upload already in flight`, async () => {
    const c = createPage(kind, { waitUpload: true }); await c.page.onLoad({});
    const picking = c.page[inputs[kind]](); await settle(); fillValid(c, kind);
    const publishing = c.page[submits[kind]]();
    if (kind === 'diary') assert.equal(c.page.saveDiary(), publishing, 'repeated presses share the queued publish');
    await settle(); assert.equal(c.publishes().length, 0);
    c.finish(c.uploads[0], JSON.stringify({ id: 'ready-image', url: '/uploads/ready.jpg' }));
    await picking; await publishing; await settle();
    assert.equal(c.publishes().length, 1);
    assert.equal(c.uploads.length, 1, 'the same selected file must not upload again');
    if (kind === 'diary') assert.match(c.publishes()[0].data.fields.contentMarkdown, /!\[图片]\(\/uploads\/ready.jpg\)/);
  });
}

test('album: a shared draft with more than nine photos resumes every image without re-upload', async () => {
  const c = createPage('album', { draft: true, imageCount: 12 }); await c.page.onLoad({});
  assert.equal(c.page.data.photos.length, 12);
  assert.equal(c.page.data.photos[11].serverId, 'saved-image-11');
  assert.equal(c.page.data.canAddPhoto, true);
  assert.equal(c.page.data.maxAlbumPhotos, 50);
  assert.equal(c.uploads.length, 0);
});

test('album: repeated native batches never request more than nine and stop at fifty total', async () => {
  const c = createPage('album', { fullBatch: true }); await c.page.onLoad({});
  for (let batch = 0; batch < 6; batch += 1) await c.page.choosePhotos();
  assert.deepEqual(c.picks.map((pick) => pick.count), [9, 9, 9, 9, 9, 5]);
  assert.equal(c.page.data.photos.length, 50);
  assert.equal(c.uploads.length, 50);
  assert.equal(c.page.data.canAddPhoto, false);
  await c.page.choosePhotos(); assert.equal(c.picks.length, 6);
  assert.equal(c.toasts.at(-1), '最多 50 张');
});

test('album: legacy over-cap drafts preserve all photos, refuse additions and allow removal', async () => {
  const c = createPage('album', { draft: true, imageCount: 56 }); await c.page.onLoad({});
  assert.equal(c.page.data.photos.length, 56);
  assert.equal(c.page.data.canAddPhoto, false);
  await c.page.choosePhotos(); assert.equal(c.picks.length, 0);
  assert.equal(c.page.data.photos.length, 56);
  await c.page.removePhoto({ currentTarget: { dataset: { index: 55 } } });
  assert.equal(c.page.data.photos.length, 55);
  assert.equal(c.page.data.photos[54].serverId, 'saved-image-54');
  assert.equal(c.page.data.canAddPhoto, false);
  assert.equal(c.calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/images/saved-image-55')), true);
});

test('diary: explicit removal uses its opaque id and removes every matching Markdown reference', async () => {
  const c = createPage('diary', { draft: true }); await c.page.onLoad({});
  c.page.updateContent('Keep this\n\n![One](/uploads/saved.jpg)\n\n![Two](/uploads/saved.jpg "Caption")\n\n![Other](/uploads/other.jpg)', 0);
  await c.page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  assert.deepEqual(c.page.data.images, []);
  assert.equal(c.calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/api/drafts/diary/images/saved-image')), true);
  assert.equal(c.page.data.form.content.includes('/uploads/saved.jpg'), false);
  assert.match(c.page.data.form.content, /Keep this/);
  assert.match(c.page.data.form.content, /!\[Other]\(\/uploads\/other.jpg\)/);
  await c.page.onHide(); assert.equal(c.saves().at(-1).data.fields.contentMarkdown.includes('/uploads/saved.jpg'), false);
});

test('diary: failed image removal preserves both attachment and Markdown', async () => {
  const c = createPage('diary', { draft: true, deleteError: true }); await c.page.onLoad({});
  c.page.updateContent('Body\n\n![Photo](/uploads/saved.jpg)', 0);
  const before = c.page.data.form.content;
  await c.page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(c.page.data.images.length, 1);
  assert.equal(c.page.data.form.content, before);
  assert.equal(c.page.data.message, '服务繁忙，请稍后重试', 'shared request policy masks upstream 5xx details');
  assert.equal(c.page.data.removingImage, false);
});

test('diary: typing Markdown never silently deletes an attachment, and edit mode has no draft removal', async () => {
  const c = createPage('diary', { draft: true }); await c.page.onLoad({});
  c.page.updateContent('Temporarily editing the Markdown', 0);
  assert.equal(c.page.data.images.length, 1);
  assert.equal(c.calls.some((call) => call.method === 'DELETE'), false);
  c.page.data.isEditing = true;
  await c.page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(c.calls.some((call) => call.method === 'DELETE'), false);
});

test('album: upload failure resumes the same autosave instance while an earlier save is in flight', async () => {
  const c = createPage('album', { waitSave: true, waitUpload: true }); await c.page.onLoad({});
  fillValid(c, 'album');
  const autosave = c.page.autosave;
  const hiding = c.page.onHide(); await settle(); assert.equal(c.saves().length, 1);
  const picking = c.page.choosePhotos(); await settle();
  const publishing = c.page.saveAlbum(); await settle();
  c.uploads[0].fail({ errMsg: 'offline' }); await picking; await publishing;
  assert.equal(c.page.autosave, autosave);
  assert.equal(c.saves().length, 1, 'a replacement helper must not overlap the old save');
  c.finish(c.saves()[0], { updatedAt: '2026-05-20T21:18:00' }); await settle(); assert.equal(c.saves().length, 2);
  c.finish(c.saves()[1], { updatedAt: '2026-05-20T21:19:00' }); await hiding;
  assert.equal(c.page.data.photos[0].status, 'failed');
});

for (const kind of Object.keys(routes)) {
  test(`${kind}: pending image deletion cannot race another deletion or publish`, async () => {
    const c = createPage(kind, { draft: true, waitDelete: true }); await c.page.onLoad({});
    fillValid(c, kind);
    const remove = c.page[kind === 'album' ? 'removePhoto' : 'removeImage']({ currentTarget: { dataset: { index: 0 } } });
    assert.equal(c.page.data.removingImage, true);
    c.page[kind === 'album' ? 'removePhoto' : 'removeImage']({ currentTarget: { dataset: { index: 0 } } });
    await c.page[submits[kind]]();
    assert.equal(c.publishes().length, 0);
    const deletions = c.calls.filter((call) => call.method === 'DELETE'); assert.equal(deletions.length, 1);
    c.finish(deletions[0], null, 204); await remove; assert.equal(c.page.data.removingImage, false);
  });
}

test('diary exit: successful pending removal is reflected in the unload flush without touching unloaded UI', async () => {
  const c = createPage('diary', { draft: true, waitDelete: true }); await c.page.onLoad({});
  c.page.updateContent('Keep text\n\n![Photo](/uploads/saved.jpg)\n<img src="/uploads/saved.jpg">', 0);
  const remove = c.page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  const originalSetData = c.page.setData;
  let unloadedWrites = 0;
  c.page.setData = function (patch) { if (this.disposed) unloadedWrites += 1; originalSetData.call(this, patch); };
  const unloading = c.page.onUnload(); await settle();
  assert.equal(c.saves().length, 1, 'dirty fields flush immediately, before deletion finishes');
  const deletion = c.calls.find((call) => call.method === 'DELETE');
  c.finish(deletion, null, 204); await remove; await unloading;
  assert.equal(c.saves().at(-1).data.fields.contentMarkdown.includes('/uploads/saved.jpg'), false, 'a resumed draft must not reference the removed object');
  assert.match(c.saves().at(-1).data.fields.contentMarkdown, /Keep text/);
  assert.equal(unloadedWrites, 0);
});

test('diary exit: failed pending removal keeps image references in the unload flush', async () => {
  const c = createPage('diary', { draft: true, waitDelete: true }); await c.page.onLoad({});
  c.page.updateContent('Keep text\n\n![Photo](/uploads/saved.jpg)', 0);
  const before = c.page.data.form.content;
  const remove = c.page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  const originalSetData = c.page.setData;
  let unloadedWrites = 0;
  c.page.setData = function (patch) { if (this.disposed) unloadedWrites += 1; originalSetData.call(this, patch); };
  const unloading = c.page.onUnload(); await settle();
  c.finish(c.calls.find((call) => call.method === 'DELETE'), { code: 'EXAMPLE_DELETE_FAILED', message: 'Remove failed' }, 502);
  await remove; await unloading;
  assert.match(c.saves().at(-1).data.fields.contentMarkdown, /!\[Photo]\(\/uploads\/saved.jpg\)/);
  assert.equal(c.page.data.form.content, before);
  assert.equal(c.page.data.images.length, 1);
  assert.equal(unloadedWrites, 0);
});

test('diary exit: a member change during pending removal never flushes into the new session', async () => {
  const c = createPage('diary', { draft: true, waitDelete: true }); await c.page.onLoad({});
  c.page.updateContent('Old member text\n\n![Photo](/uploads/saved.jpg)', 0);
  const remove = c.page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  const originalSetData = c.page.setData;
  let unloadedWrites = 0;
  c.page.setData = function (patch) { if (this.disposed) unloadedWrites += 1; originalSetData.call(this, patch); };
  const unloading = c.page.onUnload(); await settle();
  c.setToken('member-b');
  c.finish(c.calls.find((call) => call.method === 'DELETE'), null, 204); await remove; await unloading;
  assert.equal(c.saves().some((call) => call.header.Authorization === 'Bearer member-b'), false);
  assert.equal(unloadedWrites, 0);
});

test('diary exit: pending removal and an earlier field save serialize the final cleaned snapshot', async () => {
  const c = createPage('diary', { draft: true, waitDelete: true, waitSave: true }); await c.page.onLoad({});
  c.page.updateContent('Keep text\n\n![Photo](/uploads/saved.jpg)', 0);
  const hiding = c.page.onHide(); await settle(); assert.equal(c.saves().length, 1);
  const remove = c.page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  const originalSetData = c.page.setData;
  let unloadedWrites = 0;
  c.page.setData = function (patch) { if (this.disposed) unloadedWrites += 1; originalSetData.call(this, patch); };
  const unloading = c.page.onUnload();
  c.finish(c.calls.find((call) => call.method === 'DELETE'), null, 204); await remove; await settle();
  assert.equal(c.saves().length, 1, 'the old field save remains the only request in flight');
  c.finish(c.saves()[0], { updatedAt: '2026-05-20T21:20:00' }); await settle();
  assert.equal(c.saves().length, 2);
  assert.equal(c.saves()[1].data.fields.contentMarkdown.includes('/uploads/saved.jpg'), false);
  c.finish(c.saves()[1], { updatedAt: '2026-05-20T21:21:00' }); await hiding; await unloading;
  assert.equal(unloadedWrites, 0);
});

for (const kind of Object.keys(routes)) {
  test(`${kind} exit: photos still queued when the page closes keep uploading into the draft`, async () => {
    const c = createPage(kind, { fullBatch: true, waitUpload: true });
    await c.page.onLoad({});
    c.page[inputs[kind]](); await settle();
    assert.equal(c.uploads.length, 1, 'uploads run one at a time');
    const unload = c.page.onUnload();
    c.finish(c.uploads[0], JSON.stringify({ id: 'image-1', url: '/uploads/picked-1.jpg' })); await settle();
    assert.equal(c.uploads.length, 2, 'the next queued photo still uploads after the page closed');
    c.setToken('member-b'); await settle();
    c.finish(c.uploads[1], JSON.stringify({ id: 'image-2', url: '/uploads/picked-2.jpg' })); await settle();
    assert.equal(c.uploads.length, 2, 'a member change stops the remaining uploads');
    await Promise.race([unload, settle()]);
  });
}

test('diary exit: an upload that finishes after the page closed is saved into the draft text', async () => {
  const c = createPage('diary', { waitUpload: true });
  await c.page.onLoad({});
  c.page.chooseImages(); await settle();
  const unload = c.page.onUnload(); await settle();
  c.finish(c.uploads[0], JSON.stringify({ id: 'image-1', url: '/uploads/late-photo.jpg' }));
  await unload;
  const last = c.saves().at(-1);
  assert.ok(last, 'the page saved its fields on exit');
  assert.match(last.data.fields.contentMarkdown, /\/uploads\/late-photo\.jpg/);
});
