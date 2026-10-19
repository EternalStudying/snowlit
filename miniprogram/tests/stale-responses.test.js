const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

function loadPage(pagePath) {
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(`${root}${path.sep}`) && key !== __filename) {
      delete require.cache[key];
    }
  });
  let definition;
  const storage = new Map([['snowlit_token', 'token-a']]);
  const requests = [];
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => [{}];
  global.wx = {
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    showToast() {},
    nextTick: (callback) => callback(),
    createMapContext: () => ({ includePoints() {}, getScale() {}, getCenterLocation() {} }),
    request: (options) => requests.push(options)
  };
  require(path.join(root, pagePath));
  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      Object.keys(patch).forEach((key) => {
        const keys = key.split('.');
        let target = this.data;
        keys.slice(0, -1).forEach((part) => { target = target[part]; });
        target[keys[keys.length - 1]] = patch[key];
      });
      if (typeof callback === 'function') {
        callback();
      }
    }
  };
  return { page, requests, storage };
}

async function flush() {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

function respond(request, data) {
  request.success({ statusCode: 200, data });
}

function moment(id, title) {
  return { id, title, eventTime: '2026-05-25T18:20:00', category: 'daily' };
}

test('a slow response for an older Story filter does not replace the newer filter', async () => {
  const { page, requests } = loadPage('pages/story/index.js');
  page.handleFilterTap({ currentTarget: { dataset: { value: 'daily' } } });
  page.handleFilterTap({ currentTarget: { dataset: { value: 'travel' } } });
  assert.equal(requests.length, 2);

  respond(requests[1], { items: [moment(2, 'travel only')], canManage: false });
  await flush();
  respond(requests[0], { items: [moment(1, 'daily only')], canManage: false });
  await flush();

  assert.equal(page.data.activeFilter, 'travel');
  assert.deepEqual(page.data.moments.map((item) => item.title), ['travel only']);
  assert.equal(page.data.loading, false);
});

test('an older Story request that fails late does not wipe the newer list', async () => {
  const { page, requests } = loadPage('pages/story/index.js');
  page.handleFilterTap({ currentTarget: { dataset: { value: 'daily' } } });
  page.handleFilterTap({ currentTarget: { dataset: { value: 'travel' } } });

  respond(requests[1], { items: [moment(2, 'travel only')], canManage: false });
  await flush();
  requests[0].fail({ errMsg: 'request:fail timeout' });
  await flush();

  assert.deepEqual(page.data.moments.map((item) => item.title), ['travel only']);
  assert.equal(page.data.message, '');
});

test('Wishes ignores a section response that arrives after the member changed', async () => {
  const { page, requests, storage } = loadPage('pages/wishes/index.js');
  page.onLoad();
  page.loadWishSection('wantGo', true);
  assert.equal(requests.length, 1);

  storage.set('snowlit_token', 'token-b');
  respond(requests[0], { items: [{ id: 1, title: 'old member wish', category: 'want_go' }], total: 1, page: 1, size: 10 });
  await flush();

  assert.deepEqual(page.data.wantGoWishes, []);
});

test('Home ignores an album response from the previous member', async () => {
  const { page, requests, storage } = loadPage('pages/index/index.js');
  page.loadAlbums();
  assert.equal(requests.length, 1);

  storage.set('snowlit_token', 'token-b');
  respond(requests[0], { items: [{ id: 7, title: 'old member album' }], total: 1 });
  await flush();

  assert.deepEqual(page.data.albums, []);
});
