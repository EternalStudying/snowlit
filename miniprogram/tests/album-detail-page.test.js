const assert = require('node:assert/strict');

function clearAlbumDetailModules() {
  [
    '../pages/album-detail/index.js',
    '../pages/albums/album-presenter.js',
    '../services/album.js',
    '../utils/request.js',
    '../utils/notify.js',
    '../utils/auth.js'
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
}

function assignPath(target, key, value) {
  const parts = key.split('.');
  let current = target;
  parts.slice(0, -1).forEach((part) => {
    current[part] = current[part] || {};
    current = current[part];
  });
  current[parts[parts.length - 1]] = value;
}

function createAlbumDetailPage(respondToLike) {
  clearAlbumDetailModules();

  let pageDefinition;
  const storage = new Map([['snowlit_token', 'jwt-token']]);
  const toasts = [];
  const likeCalls = [];

  global.Page = (definition) => {
    pageDefinition = definition;
  };
  global.getCurrentPages = () => [{
    selectComponent(selector) {
      if (selector === '#snowlit-toast') {
        return { show: (options) => toasts.push(options.title) };
      }
      return null;
    }
  }];
  global.wx = {
    getStorageSync(key) {
      return storage.get(key) || '';
    },
    request(options) {
      if (options.url.indexOf('/like') >= 0) {
        likeCalls.push(options);
        respondToLike(options, likeCalls.length);
      }
    },
    showToast(options) {
      toasts.push(options.title);
    }
  };

  require('../pages/album-detail/index.js');

  return {
    page: {
      ...pageDefinition,
      data: JSON.parse(JSON.stringify(pageDefinition.data)),
      setData(patch) {
        Object.keys(patch).forEach((key) => assignPath(this.data, key, patch[key]));
      }
    },
    likeCalls,
    toasts
  };
}

function createAlbum(likedToday) {
  const { mapAlbumDetail } = require('../pages/albums/album-presenter');
  return mapAlbumDetail({
    album: {
      id: 2,
      title: '日常相册',
      photoCount: 1,
      viewCount: 3,
      likeCount: likedToday ? 6 : 5,
      likedToday,
      visibility: 'public',
      locked: false
    },
    photos: []
  });
}

function waitTick() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

async function runLikeUpdatesSelectedStateTest() {
  const { page, likeCalls, toasts } = createAlbumDetailPage((options) => {
    setTimeout(() => {
      options.success({
        statusCode: 200,
        data: { albumId: 2, likeCount: 6, likedToday: true }
      });
    }, 0);
  });

  page.setData({ albumId: 2, album: createAlbum(false) });
  page.handleStatTap({ currentTarget: { dataset: { type: 'likes' } } });
  await waitTick();

  assert.equal(likeCalls.length, 1);
  assert.equal(page.data.actionLoading, false);
  assert.equal(page.data.album.stats[2].value, '6');
  assert.equal(page.data.album.stats[2].active, true);
  assert.equal(page.data.album.likedToday, true);
  assert.deepEqual(toasts, ['已喜欢']);
}

async function runUnlikeUpdatesSelectedStateTest() {
  const { page, toasts } = createAlbumDetailPage((options) => {
    setTimeout(() => {
      options.success({
        statusCode: 200,
        data: { albumId: 2, likeCount: 5, likedToday: false }
      });
    }, 0);
  });

  page.setData({ albumId: 2, album: createAlbum(true) });
  page.submitLike();
  await waitTick();

  assert.equal(page.data.album.stats[2].value, '5');
  assert.equal(page.data.album.stats[2].active, false);
  assert.equal(page.data.album.likedToday, false);
  assert.deepEqual(toasts, ['已取消喜欢']);
}

async function runLikeLoadingGuardTest() {
  let pendingLike;
  const { page, likeCalls } = createAlbumDetailPage((options) => {
    pendingLike = options;
  });

  page.setData({ albumId: 2, album: createAlbum(false) });
  page.submitLike();
  page.submitLike();

  assert.equal(likeCalls.length, 1);
  assert.equal(page.data.actionLoading, true);

  pendingLike.success({
    statusCode: 200,
    data: { albumId: 2, likeCount: 6, likedToday: true }
  });
  await waitTick();

  assert.equal(page.data.actionLoading, false);
  assert.equal(page.data.album.stats[2].active, true);
}

async function run() {
  await runLikeUpdatesSelectedStateTest();
  await runUnlikeUpdatesSelectedStateTest();
  await runLikeLoadingGuardTest();
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
  console.log('album-detail page tests passed');
}

run().catch((error) => {
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
  console.error(error);
  process.exit(1);
});
