const assert = require('node:assert/strict');
const { config } = require('../constants/config');

const storage = {};
const calls = [];
const uploadCalls = [];
let uploadResponse = {
  id: 10,
  albumId: 7,
  previewUrl: 'https://cdn.example.com/album/preview.jpg',
  originalUrl: 'https://cdn.example.com/album/original.jpg'
};

global.wx = {
  getStorageSync(key) {
    return storage[key] === undefined ? '' : storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  removeStorageSync(key) {
    delete storage[key];
  },
  getStorageInfoSync() {
    return { keys: Object.keys(storage) };
  },
  request(options) {
    calls.push(options);
    if (options.url.indexOf('/drafts/current') >= 0) {
      options.success({
        statusCode: 200,
        data: {
          draft: {
            album: {
              id: 7,
              title: '未完成相册'
            },
            photos: []
          }
        }
      });
      return;
    }
    options.success({
      statusCode: 200,
      data: options.url.indexOf('/view') >= 0
        ? { albumId: 2, viewCount: 9, counted: true }
        : { albumId: 2, likeCount: 5, likedToday: true }
    });
  },
  uploadFile(options) {
    uploadCalls.push(options);
    options.success({
      statusCode: 200,
      data: JSON.stringify(uploadResponse)
    });
    return {
      onProgressUpdate(handler) {
        handler({ progress: 66 });
      }
    };
  },
  showToast() {}
};

const { saveAlbumPrivateToken, setToken } = require('../utils/auth');
const {
  cancelAlbumDraft,
  createAlbumDraft,
  getCurrentAlbumDraft,
  likeAlbum,
  publishAlbumDraft,
  recordAlbumView,
  uploadAlbumDraftPhoto
} = require('../services/album');

async function runRecordAlbumViewTest() {
  setToken('jwt-token');
  saveAlbumPrivateToken(2, {
    token: 'private-token',
    expiresAt: '2099-01-01T00:00:00'
  });

  const result = await recordAlbumView(2);
  const call = calls[calls.length - 1];

  assert.deepEqual(result, { albumId: 2, viewCount: 9, counted: true });
  assert.equal(call.url, `${config.apiBaseUrl}/api/albums/2/view`);
  assert.equal(call.method, 'POST');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
  assert.equal(call.header['X-Album-Access-Token'], 'private-token');
}

async function runLikeAlbumTest() {
  const result = await likeAlbum(2);
  const call = calls[calls.length - 1];

  assert.deepEqual(result, { albumId: 2, likeCount: 5, likedToday: true });
  assert.equal(call.url, `${config.apiBaseUrl}/api/albums/2/like`);
  assert.equal(call.method, 'POST');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runCreateDraftTest() {
  await createAlbumDraft({
    title: '集市相册',
    description: '今天路过集市',
    eventDate: '2026-05-28',
    location: '示例城市',
    visibility: 'private',
    privatePassword: '5201314',
    pinned: true
  });
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/albums`);
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.data, {
    title: '集市相册',
    description: '今天路过集市',
    eventDate: '2026-05-28',
    location: '示例城市',
    visibility: 'private',
    privatePassword: '5201314',
    pinned: true
  });
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runGetCurrentDraftTest() {
  const result = await getCurrentAlbumDraft();
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/albums/drafts/current`);
  assert.equal(call.method, 'GET');
  assert.equal(result.draft.album.id, 7);
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runUploadDraftPhotoTest() {
  const progressEvents = [];
  const result = await uploadAlbumDraftPhoto(
    7,
    'wxfile://tmp.jpg',
    {
      caption: '集市',
      takenAt: '2026-05-28',
      location: '示例城市',
      width: 900,
      height: 1200,
      sortOrder: 1
    },
    (progress) => progressEvents.push(progress.progress)
  );
  const call = uploadCalls[uploadCalls.length - 1];

  assert.equal(result.previewUrl, 'https://cdn.example.com/album/preview.jpg');
  assert.equal(result.originalUrl, 'https://cdn.example.com/album/original.jpg');
  assert.equal(result.url, 'https://cdn.example.com/album/preview.jpg');
  assert.equal(call.url, `${config.uploadBaseUrl}/api/albums/7/photos/mobile`);
  assert.equal(call.name, 'file');
  assert.equal(call.filePath, 'wxfile://tmp.jpg');
  assert.deepEqual(JSON.parse(call.formData.metadata), {
    caption: '集市',
    takenAt: '2026-05-28',
    location: '示例城市',
    width: 900,
    height: 1200,
    sortOrder: 1
  });
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
  assert.deepEqual(progressEvents, [66]);
}

async function runPublishDraftTest() {
  await publishAlbumDraft(7);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/albums/7/publish`);
  assert.equal(call.method, 'POST');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runRelativeUploadMediaTest() {
  const previousMediaBaseUrl = config.mediaBaseUrl;
  const previousUploadResponse = uploadResponse;
  try {
    for (const mediaBaseUrl of ['', 'https://media.example.com/']) {
      config.mediaBaseUrl = mediaBaseUrl;
      const base = (config.mediaBaseUrl || config.apiBaseUrl).replace(/\/$/, '');
      uploadResponse = {
        id: 11,
        albumId: 7,
        previewUrl: '/uploads/album/preview.jpg',
        originalUrl: '/uploads/album/original.jpg'
      };
      const result = await uploadAlbumDraftPhoto(7, 'wxfile://tmp.jpg', {});
      assert.equal(result.url, `${base}/uploads/album/preview.jpg`);
      assert.equal(result.previewUrl, `${base}/uploads/album/preview.jpg`);
      assert.equal(result.originalUrl, `${base}/uploads/album/original.jpg`);
    }

    uploadResponse = { previewUrl: '', originalUrl: '' };
    const empty = await uploadAlbumDraftPhoto(7, 'wxfile://tmp.jpg', {});
    assert.equal(empty.url, '');
    assert.equal(empty.previewUrl, '');
    assert.equal(empty.originalUrl, '');

    uploadResponse = previousUploadResponse;
    await runUploadDraftPhotoTest();
  } finally {
    config.mediaBaseUrl = previousMediaBaseUrl;
    uploadResponse = previousUploadResponse;
  }
}

async function runCancelDraftTest() {
  await cancelAlbumDraft(7);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/albums/7/draft`);
  assert.equal(call.method, 'DELETE');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function run() {
  await runRecordAlbumViewTest();
  await runLikeAlbumTest();
  await runCreateDraftTest();
  await runGetCurrentDraftTest();
  await runUploadDraftPhotoTest();
  await runRelativeUploadMediaTest();
  await runPublishDraftTest();
  await runCancelDraftTest();
  console.log('album-service tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
