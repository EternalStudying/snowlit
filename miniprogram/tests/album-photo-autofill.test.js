const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { buildJpeg } = require('./helpers/exif-jpeg');

const root = path.resolve(__dirname, '..');
const northEast = { latRef: 'N', lat: [[48, 1], [51, 1], [30, 1]], lonRef: 'E', lon: [[2, 1], [17, 1], [40, 1]] };

function createAlbumPage({ files = {}, place = { city: 'Example City', country: 'Example Country' }, placeFails = false, compressFails = false, deferFileReads = false, deferPlaceLookup = false } = {}) {
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(`${root}${path.sep}`) && !key.includes(`${path.sep}tests${path.sep}`)) {
      delete require.cache[key];
    }
  });
  let definition;
  let page;
  const picks = [];
  const prompts = [];
  const toasts = [];
  const requests = [];
  const uploads = [];
  const pendingReads = [];
  const pendingPlaces = [];
  const finishPlace = (options) => {
    if (placeFails) options.fail({ errMsg: 'request:fail' });
    else options.success({ statusCode: 200, data: { ...place, district: '', province: '', temperature: 18 } });
  };
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => [page];
  global.wx = {
    getStorageSync: (key) => (key === 'snowlit_token' ? 'test-token' : ''),
    showToast: ({ title }) => toasts.push(title),
    chooseMedia: (options) => picks.push(options),
    getFileSystemManager: () => ({
      readFile: ({ filePath, success, fail }) => {
        const finish = () => (files[filePath] ? success({ data: files[filePath] }) : fail({ errMsg: 'readFile:fail' }));
        if (deferFileReads) pendingReads.push(finish);
        else finish();
      }
    }),
    compressImage: ({ src, success, fail }) => (compressFails ? fail({ errMsg: 'compressImage:fail' }) : success({ tempFilePath: `${src}.small` })),
    request: (options) => {
      requests.push(options);
      const pathname = new URL(options.url).pathname;
      if (pathname === '/api/weather/atmosphere/browser') {
        if (deferPlaceLookup) pendingPlaces.push(() => finishPlace(options));
        else finishPlace(options);
      } else if (pathname === '/api/albums' && options.method === 'POST') {
        options.success({ statusCode: 200, data: { album: { id: 41 } } });
      } else {
        options.success({ statusCode: 200, data: {} });
      }
    },
    uploadFile: (options) => {
      uploads.push(options);
      return { onProgressUpdate() {} };
    },
    navigateBack() {},
    switchTab() {}
  };
  require(path.join(root, 'pages/album-edit/index.js'));
  page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    selectComponent(selector) {
      if (selector === '#snowlit-privacy') {
        return { authorize: (options) => { prompts.push(options); return Promise.resolve(true); } };
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
  return { page, picks, prompts, toasts, requests, uploads, pendingReads, pendingPlaces };
}

async function flush() {
  for (let index = 0; index < 30; index += 1) {
    await Promise.resolve();
  }
}

async function pick(context, paths) {
  context.page.choosePhotos();
  await flush();
  context.picks[context.picks.length - 1].success({ tempFiles: paths.map((tempFilePath) => ({ tempFilePath, width: 4, height: 3 })) });
  await flush();
}

const photos = {
  'wxfile://late.jpg': buildJpeg({ dateTimeOriginal: '2026:05:28 21:14:03' }),
  'wxfile://early.jpg': buildJpeg({ dateTimeOriginal: '2026:05:20 09:00:00', gps: northEast }),
  'wxfile://plain.jpg': buildJpeg({})
};

function albumCreates(context) {
  return context.requests.filter((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/albums');
}

function albumPublishes(context) {
  return context.requests.filter((request) => new URL(request.url).pathname.endsWith('/publish'));
}

test('fills the album date with the earliest shot and the place of the first photo with GPS', async () => {
  const context = createAlbumPage({ files: photos });
  await pick(context, ['wxfile://late.jpg', 'wxfile://early.jpg']);

  assert.deepEqual(context.picks[0].sizeType, ['original']);
  assert.match(context.prompts[0].message, /拍摄时间和地点/);
  assert.equal(context.page.data.form.eventDate, '2026-05-20');
  assert.equal(context.page.data.form.location, 'Example City，Example Country');
  assert.deepEqual(context.page.data.photos.map((item) => item.takenAt), ['2026-05-28', '2026-05-20']);
  const lookup = new URL(context.requests.find((item) => item.url.includes('/api/weather/')).url);
  assert.ok(Math.abs(Number(lookup.searchParams.get('latitude')) - (48 + 51 / 60 + 30 / 3600)) < 1e-9);
  assert.deepEqual(context.toasts, []);
});

test('never replaces a date or place the person set', async () => {
  const context = createAlbumPage({ files: photos });
  context.page.confirmDateFromSheet({ detail: { value: '2026-01-01' } });
  context.page.handleInput({ currentTarget: { dataset: { field: 'location' } }, detail: { value: '我写的地点' } });
  await pick(context, ['wxfile://early.jpg']);

  assert.equal(context.page.data.form.eventDate, '2026-01-01');
  assert.equal(context.page.data.form.location, '我写的地点');
  assert.equal(context.requests.some((item) => item.url.includes('/api/weather/')), false);
  assert.equal(context.page.data.photos[0].takenAt, '2026-05-20');
});

test('photos added later do not change fields already filled from photos', async () => {
  const context = createAlbumPage({ files: photos });
  await pick(context, ['wxfile://late.jpg']);
  assert.equal(context.page.data.form.eventDate, '2026-05-28');
  await pick(context, ['wxfile://early.jpg']);

  assert.equal(context.page.data.form.eventDate, '2026-05-28');
  assert.equal(context.page.data.form.location, 'Example City，Example Country', 'the place was still empty, so it fills');
});

test('a selection without shooting details leaves the form alone and says so once', async () => {
  const context = createAlbumPage({ files: photos });
  const before = { ...context.page.data.form };
  await pick(context, ['wxfile://plain.jpg', 'wxfile://missing.jpg']);

  assert.deepEqual(context.page.data.form, before);
  assert.deepEqual(context.toasts, ['照片里没有拍摄时间和地点，可以手动填写']);
});

test('a failed or empty place lookup leaves the place empty without an error toast', async () => {
  for (const options of [{ placeFails: true }, { place: { city: 'unknown', country: '' } }]) {
    const context = createAlbumPage({ files: photos, ...options });
    await pick(context, ['wxfile://early.jpg']);
    assert.equal(context.page.data.form.location, '');
    assert.equal(context.page.data.form.eventDate, '2026-05-20');
    assert.deepEqual(context.toasts, []);
  }
});

test('uploads the compressed copy with each photo\'s own shooting date', async () => {
  const context = createAlbumPage({ files: photos });
  await pick(context, ['wxfile://late.jpg', 'wxfile://plain.jpg']);
  context.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Trip' } });
  context.page.saveAlbum();
  await flush();

  assert.equal(context.uploads.length, 1);
  assert.equal(context.uploads[0].filePath, 'wxfile://late.jpg.small');
  assert.equal(JSON.parse(context.uploads[0].formData.metadata).takenAt, '2026-05-28');
  context.uploads[0].success({ statusCode: 200, data: JSON.stringify({ previewUrl: 'https://media.test/1.jpg' }) });
  await flush();
  assert.equal(context.uploads[1].filePath, 'wxfile://plain.jpg.small');
  assert.equal(JSON.parse(context.uploads[1].formData.metadata).takenAt, '2026-05-28', 'falls back to the album date');
});

test('a photo that cannot be compressed fails instead of uploading the original', async () => {
  const context = createAlbumPage({ files: photos, compressFails: true });
  await pick(context, ['wxfile://early.jpg']);
  context.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Trip' } });
  context.page.saveAlbum();
  await flush();

  assert.equal(context.uploads.length, 0);
  assert.equal(context.page.data.message, '照片处理失败，请重试');
  assert.equal(context.page.data.submitting, false);
  assert.equal(context.page.data.photos.length, 1, 'the selection is kept for a retry');
});

test('save requested during EXIF reading waits for the photo date and place and saves once', async () => {
  const context = createAlbumPage({ files: photos, deferFileReads: true, deferPlaceLookup: true });
  await pick(context, ['wxfile://early.jpg']);
  context.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Trip' } });
  context.page.saveAlbum();
  context.page.saveAlbum();
  await flush();

  assert.equal(albumCreates(context).length, 0, 'no draft is created before EXIF is ready');
  assert.equal(context.uploads.length, 0);
  assert.equal(albumPublishes(context).length, 0);
  assert.equal(context.page.data.metadataReading, true);
  assert.equal(context.pendingReads.length, 1);

  context.pendingReads.shift()();
  await flush();
  assert.equal(context.pendingPlaces.length, 1);
  assert.equal(context.page.data.metadataReading, true, 'place resolution is part of readiness');
  assert.equal(albumCreates(context).length, 0);
  assert.equal(context.uploads.length, 0);

  context.pendingPlaces.shift()();
  await flush();
  assert.equal(context.page.data.metadataReading, false);
  assert.equal(albumCreates(context).length, 1);
  assert.equal(albumCreates(context)[0].data.eventDate, '2026-05-20');
  assert.equal(albumCreates(context)[0].data.location, 'Example City，Example Country');
  assert.equal(context.uploads.length, 1);
  const metadata = JSON.parse(context.uploads[0].formData.metadata);
  assert.equal(metadata.takenAt, '2026-05-20');
  assert.equal(metadata.location, 'Example City，Example Country');
  context.uploads[0].success({ statusCode: 200, data: JSON.stringify({ previewUrl: 'https://media.test/1.jpg' }) });
  await flush();
  assert.equal(albumCreates(context).length, 1);
  assert.equal(albumPublishes(context).length, 1);
});

test('save requested after EXIF but before place resolution waits for the place', async () => {
  const context = createAlbumPage({ files: photos, deferPlaceLookup: true });
  await pick(context, ['wxfile://early.jpg']);
  context.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Trip' } });
  assert.equal(context.page.data.form.eventDate, '2026-05-20');
  context.page.saveAlbum();
  await flush();

  assert.equal(albumCreates(context).length, 0);
  assert.equal(context.uploads.length, 0);
  assert.equal(context.page.data.metadataReading, true);
  context.pendingPlaces.shift()();
  await flush();

  assert.equal(albumCreates(context).length, 1);
  assert.equal(albumCreates(context)[0].data.location, 'Example City，Example Country');
  assert.equal(JSON.parse(context.uploads[0].formData.metadata).location, 'Example City，Example Country');
});

test('a removed photo cannot fill fields or start a place lookup when its EXIF read finishes', async () => {
  const context = createAlbumPage({ files: photos, deferFileReads: true });
  await pick(context, ['wxfile://early.jpg']);
  context.page.removePhoto({ currentTarget: { dataset: { index: 0 } } });
  await pick(context, ['wxfile://plain.jpg']);
  assert.equal(context.pendingReads.length, 2);
  context.pendingReads.shift()();
  await flush();

  assert.equal(context.page.data.form.eventDate, '');
  assert.equal(context.page.data.form.location, '');
  assert.equal(context.requests.some((request) => request.url.includes('/api/weather/')), false);
  assert.deepEqual(context.page.data.photos.map((photo) => photo.path), ['wxfile://plain.jpg']);
  context.pendingReads.shift()();
  await flush();
  assert.equal(context.page.data.metadataReading, false);
  assert.equal(context.page.data.form.eventDate, '');
});

test('a removed GPS source cannot fill the place when its lookup finishes', async () => {
  const context = createAlbumPage({ files: photos, deferPlaceLookup: true });
  await pick(context, ['wxfile://early.jpg']);
  assert.equal(context.pendingPlaces.length, 1);
  context.page.removePhoto({ currentTarget: { dataset: { index: 0 } } });
  await pick(context, ['wxfile://plain.jpg']);
  context.pendingPlaces.shift()();
  await flush();

  assert.equal(context.page.data.form.location, '');
  assert.deepEqual(context.page.data.photos.map((photo) => photo.path), ['wxfile://plain.jpg']);
  assert.equal(context.page.data.metadataReading, false);
});

test('photos without a shooting date require a deliberate date choice and keep an unknown place empty', async () => {
  const context = createAlbumPage({ files: photos });
  await pick(context, ['wxfile://plain.jpg']);
  context.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Trip' } });
  context.page.saveAlbum();
  await flush();

  assert.equal(albumCreates(context).length, 0, 'missing shooting dates cannot silently become today');
  assert.equal(context.uploads.length, 0);
  assert.equal(context.page.data.form.eventDate, '');
  assert.equal(context.page.data.message, '请选择相册日期');

  context.page.confirmDateFromSheet({ detail: { value: '2026-02-03' } });
  context.page.saveAlbum();
  await flush();
  assert.equal(albumCreates(context).length, 1);
  assert.equal(albumCreates(context)[0].data.eventDate, '2026-02-03');
  assert.equal(albumCreates(context)[0].data.location, '');
  const metadata = JSON.parse(context.uploads[0].formData.metadata);
  assert.equal(metadata.takenAt, '2026-02-03');
  assert.equal(metadata.location, '');
});

test('a queued save preserves manual fields set while EXIF is still being read', async () => {
  const context = createAlbumPage({ files: photos, deferFileReads: true });
  await pick(context, ['wxfile://early.jpg']);
  context.page.handleInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: 'Trip' } });
  context.page.confirmDateFromSheet({ detail: { value: '2026-01-01' } });
  context.page.handleInput({ currentTarget: { dataset: { field: 'location' } }, detail: { value: 'Manual place' } });
  context.page.saveAlbum();
  await flush();
  assert.equal(albumCreates(context).length, 0);

  context.pendingReads.shift()();
  await flush();
  assert.equal(albumCreates(context).length, 1);
  assert.equal(albumCreates(context)[0].data.eventDate, '2026-01-01');
  assert.equal(albumCreates(context)[0].data.location, 'Manual place');
  assert.equal(context.requests.some((request) => request.url.includes('/api/weather/')), false);
  const metadata = JSON.parse(context.uploads[0].formData.metadata);
  assert.equal(metadata.takenAt, '2026-05-20', 'the photo retains its own shooting date');
  assert.equal(metadata.location, 'Manual place');
});
