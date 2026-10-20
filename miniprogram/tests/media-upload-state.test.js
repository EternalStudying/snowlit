const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

function createPage(pagePath, options = {}) {
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(`${root}${path.sep}`) && key !== __filename) {
      delete require.cache[key];
    }
  });
  let definition;
  let page;
  const picks = [];
  const uploads = [];
  const requests = [];
  const toasts = [];
  global.Page = (value) => { definition = value; };
  global.Component = (value) => { definition = value; };
  global.getCurrentPages = () => [page];
  global.wx = {
    getStorageSync: () => 'test-token',
    showToast: ({ title }) => toasts.push(title),
    chooseMedia: (value) => picks.push(value),
    compressImage: ({ src, success }) => success({ tempFilePath: src.replace('.jpg', '.compressed.jpg') }),
    uploadFile: (value) => {
      uploads.push(value);
      return { onProgressUpdate() {} };
    },
    request: (value) => {
      requests.push(value);
      if (value.url.endsWith('/api/albums') && value.method === 'POST') {
        value.success({ statusCode: 200, data: { album: { id: 23 } } });
      }
    }
  };
  require(path.join(root, pagePath));
  page = {
    ...definition,
    ...(definition.methods || {}),
    data: JSON.parse(JSON.stringify(definition.data)),
    selectComponent(selector) {
      if (selector === '#snowlit-privacy') {
        return { authorize: () => options.privacy || Promise.resolve(true) };
      }
      return null;
    },
    setData(patch) {
      Object.keys(patch).forEach((key) => {
        const keys = key.split('.');
        let target = this.data;
        keys.slice(0, -1).forEach((part) => { target = target[part]; });
        target[keys[keys.length - 1]] = patch[key];
      });
    }
  };
  return { page, picks, uploads, requests, toasts };
}

async function flush() {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

function image(name) {
  return { id: name, path: `wxfile://tmp/${name}`, status: 'local', width: 2, height: 2 };
}

test('album keeps the selected upload batch stable while its first photo is uploading', async () => {
  const { page, uploads, picks } = createPage('pages/album-edit/index.js');
  page.data.form.title = 'Upload test';
  page.confirmDateFromSheet({ detail: { value: '2026-05-20' } });
  page.updatePhotos([image('a.jpg'), image('b.jpg')]);
  page.saveAlbum();
  await flush();
  assert.equal(uploads.length, 1);
  page.removePhoto({ currentTarget: { dataset: { index: 0 } } });
  page.choosePhotos();
  await flush();
  assert.deepEqual(page.data.photos.map((item) => item.id), ['a.jpg', 'b.jpg']);
  assert.equal(picks.length, 0);
  uploads[0].success({ statusCode: 200, data: JSON.stringify({ previewUrl: 'https://media.test/a.jpg' }) });
  await flush();
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].filePath, 'wxfile://tmp/a.compressed.jpg');
  assert.equal(uploads[1].filePath, 'wxfile://tmp/b.compressed.jpg');
  assert.equal(page.data.photos[0].url, 'https://media.test/a.jpg');
});

test('story keeps the selected upload batch stable while its first image is uploading', async () => {
  const { page, uploads, picks } = createPage('pages/story-edit/index.js');
  Object.assign(page.data.form, { title: 'Upload test', locationName: 'Test', longitude: '14', latitude: '2' });
  page.updateImages([image('a.jpg'), image('b.jpg')]);
  page.submitMoment();
  await flush();
  assert.equal(uploads.length, 1);
  page.removeImage({ currentTarget: { dataset: { index: 0 } } });
  page.chooseImages();
  await flush();
  assert.deepEqual(page.data.images.map((item) => item.id), ['a.jpg', 'b.jpg']);
  assert.equal(picks.length, 0);
  uploads[0].success({ statusCode: 200, data: JSON.stringify({ url: 'https://media.test/a.jpg' }) });
  await flush();
  assert.equal(uploads.length, 2);
  assert.equal(uploads[1].filePath, 'wxfile://tmp/b.jpg');
  assert.equal(page.data.images[0].url, 'https://media.test/a.jpg');
});

test('diary does not overlap two selection batches while inserting uploaded images', async () => {
  const { page, picks, uploads } = createPage('pages/diary-edit/index.js');
  page.chooseImages();
  await flush();
  picks[0].success({ tempFiles: [{ tempFilePath: 'wxfile://tmp/a.jpg' }] });
  await flush();
  assert.equal(uploads.length, 1);
  page.chooseImages();
  await flush();
  assert.equal(picks.length, 1);
});

for (const [pagePath, method] of [
  ['pages/diary-edit/index.js', 'chooseImages'],
  ['pages/album-edit/index.js', 'choosePhotos'],
  ['pages/story-edit/index.js', 'chooseImages'],
  ['pages/feedback/index.js', 'chooseScreenshot'],
  ['components/wish-completion-sheet/index.js', 'chooseImage']
]) {
  test(`${pagePath} reports picker failures and keeps cancellation quiet`, async () => {
    const { page, picks, toasts } = createPage(pagePath);
    page[method]();
    await flush();
    assert.equal(picks.length, 1);
    assert.equal(typeof picks[0].fail, 'function');
    picks[0].fail({ errMsg: 'chooseMedia:fail cancel' });
    assert.deepEqual(toasts, []);
    picks[0].fail({ errMsg: 'chooseMedia:fail auth denied' });
    assert.equal(toasts.length, 1);
    assert.match(toasts[0], /选择.*失败/);
  });
}

for (const [pagePath, method, listKey] of [
  ['pages/diary-edit/index.js', 'chooseImages', 'images'],
  ['pages/album-edit/index.js', 'choosePhotos', 'photos'],
  ['pages/story-edit/index.js', 'chooseImages', 'images'],
  ['pages/feedback/index.js', 'chooseScreenshot', 'screenshots']
]) {
  test(`${pagePath} ignores a picker result that returns after submission started`, async () => {
    const { page, picks } = createPage(pagePath);
    page[method]();
    await flush();
    page.data.submitting = true;
    picks[0].success({ tempFiles: [{ tempFilePath: 'wxfile://tmp/late.jpg' }] });
    await flush();
    assert.deepEqual(page.data[listKey], []);
  });
}

