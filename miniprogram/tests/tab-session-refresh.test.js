const assert = require('node:assert/strict');
const path = require('node:path');
const { test, afterEach } = require('node:test');

function assignPath(target, key, value) {
  const parts = key.split('.');
  const last = parts.pop();
  const parent = parts.reduce((current, part) => current[part], target);
  parent[last] = value;
}

function createPage(name, token = '') {
  const root = path.resolve(__dirname, '..') + path.sep;
  Object.keys(require.cache).forEach((file) => {
    if (file.startsWith(root) && !file.includes(`${path.sep}tests${path.sep}`)) {
      delete require.cache[file];
    }
  });

  let definition;
  const storage = new Map([['snowlit_token', token]]);
  const requests = [];
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => [];
  global.wx = {
    getStorageSync: (key) => storage.get(key) || '',
    request(options) { requests.push(options); }
  };
  require(`../pages/${name}/index.js`);
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) {
      Object.entries(patch).forEach(([key, value]) => assignPath(this.data, key, value));
    }
  };
  return { page, requests, storage };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

function respond(requests, label, canManage = false) {
  requests.forEach((request) => {
    const url = new URL(request.url);
    let data = {};
    if (url.pathname === '/api/albums') {
      data = { items: [{ id: label, title: label, photoCount: 1 }] };
    } else if (url.pathname === '/api/home') {
      data = { dailyNote: { sentence: label } };
    } else if (url.pathname === '/api/wishes/summary') {
      data = { wantGoCount: 2, wantDoCount: 1, completedCount: 0 };
    } else if (url.pathname === '/api/update-notice') {
      data = { notice: { title: label } };
    } else if (url.pathname === '/api/wishes') {
      data = {
        items: [{ id: label, title: label }],
        total: 1,
        page: Number(url.searchParams.get('page')),
        hasMore: true,
        canManage
      };
    } else if (url.pathname === '/api/story/moments') {
      data = { items: [] };
    } else {
      assert.fail(`Unexpected request: ${url.pathname}`);
    }
    request.success({ statusCode: 200, data });
  });
}

afterEach(() => {
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
});

test('cached guest home reloads private sections after login and on later tab visits', async () => {
  const { page, requests, storage } = createPage('index');
  page.onLoad?.();
  page.onShow();
  assert.equal(requests.length, 1, 'first display should fetch public moments once');
  respond(requests.splice(0), 'public');
  await settle();
  assert.equal(page.data.albumsMessage, '登录后查看相册');
  assert.equal(page.data.wishesMessage, '登录后查看清单');

  storage.set('snowlit_token', 'session-a');
  page.onShow();
  assert.equal(requests.filter((request) => new URL(request.url).pathname === '/api/albums').length, 1);
  respond(requests.splice(0), 'account-a');
  await settle();
  assert.equal(page.data.albums[0].title, 'account-a');
  assert.equal(page.data.albumsMessage, '');
  assert.equal(page.data.wishesMessage, '');
  assert.equal(page.data.wishes[0].count, 2);

  page.onShow();
  respond(requests.splice(0), 'updated');
  await settle();
  assert.equal(page.data.albums[0].title, 'updated');
});

test('home clears private content on logout and ignores prior session responses', async () => {
  const { page, requests, storage } = createPage('index', 'session-a');
  page.onLoad?.();
  page.onShow();
  respond(requests.splice(0), 'account-a');
  await settle();
  assert.equal(page.data.greetingSubtitle, 'account-a');

  page.onShow();
  const staleRequests = requests.splice(0);
  storage.delete('snowlit_token');
  page.onShow();
  assert.deepEqual(page.data.albums, []);
  assert.deepEqual(page.data.wishes, []);
  assert.equal(page.data.updateNotice, null);
  assert.equal(page.data.albumsMessage, '登录后查看相册');
  respond(staleRequests, 'stale-account-a');
  respond(requests.splice(0), 'public');
  await settle();
  assert.deepEqual(page.data.albums, []);
  assert.equal(page.data.updateNotice, null);
  assert.notEqual(page.data.greetingSubtitle, 'stale-account-a');

  storage.set('snowlit_token', 'session-b');
  page.onShow();
  respond(requests.splice(0), 'account-b');
  await settle();
  assert.equal(page.data.albums[0].title, 'account-b');
});

test('cached guest wishes reload all sections after login and refresh page one on return', async () => {
  const { page, requests, storage } = createPage('wishes');
  page.onLoad();
  page.onShow();
  assert.equal(requests.length, 0);
  assert.equal(page.data.pageState.wantGo.message, '登录后查看清单');

  storage.set('snowlit_token', 'session-a');
  page.onShow();
  assert.equal(requests.length, 3);
  respond(requests.splice(0), 'account-a', true);
  await settle();
  assert.equal(page.data.wantGoWishes[0].title, 'account-a');
  assert.equal(page.data.pageState.wantGo.message, '');
  assert.equal(page.data.canManage, true);

  page.loadMoreWantGo();
  respond(requests.splice(0), 'page-two', true);
  await settle();
  assert.equal(page.data.wantGoWishes.length, 2);
  page.onShow();
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => new URL(request.url).searchParams.get('page') === '1'));
  respond(requests.splice(0), 'updated', true);
  await settle();
  assert.equal(page.data.wantGoWishes.length, 1);
  assert.equal(page.data.wantGoWishes[0].title, 'updated');
});

test('wishes clear previous account content and permissions and reject its pending responses', async () => {
  const { page, requests, storage } = createPage('wishes', 'session-a');
  page.onLoad();
  page.onShow();
  assert.equal(requests.length, 3, 'first display should fetch each section once');
  respond(requests.splice(0), 'account-a', true);
  await settle();
  page.openCompletionSheet('old-wish', 'wantGo');
  page.onShow();
  const staleRequests = requests.splice(0);

  storage.delete('snowlit_token');
  page.onShow();
  assert.deepEqual(page.data.wantGoWishes, []);
  assert.deepEqual(page.data.wantDoWishes, []);
  assert.deepEqual(page.data.completedWishes, []);
  assert.deepEqual(page.data.counts, { wantGo: '0 条', wantDo: '0 条', done: '0 条' });
  assert.equal(page.data.canManage, false);
  assert.equal(page.data.completionSheetVisible, false);

  storage.set('snowlit_token', 'session-b');
  page.onShow();
  assert.equal(requests.length, 3, 'new session must not be blocked by prior loading flags');
  respond(requests.splice(0), 'account-b', false);
  await settle();
  respond(staleRequests, 'stale-account-a', true);
  await settle();
  assert.equal(page.data.wantGoWishes[0].title, 'account-b');
  assert.equal(page.data.canManage, false);
  assert.equal(page.data.pageState.wantGo.loading, false);
});


test('weather without a place survives a pending home response and is cleared on account change', async () => {
  const { page, requests, storage } = createPage('index', 'session-a');
  page.onShow();
  const initial = requests.splice(0);
  wx.getLocation = (options) => options.success({ latitude: 12, longitude: 18 });
  page.updateCurrentLocation();
  const weatherRequest = requests.shift();
  assert.equal(new URL(weatherRequest.url).pathname, '/api/weather/atmosphere/browser');
  weatherRequest.success({ statusCode: 200, data: {
    city: 'unknown', country: '', district: '', province: '', temperature: 18,
    rawWeather: '晴', weatherVariant: 'clear', weatherState: 'clear'
  } });
  await settle();
  assert.equal(requests.length, 0, 'a weather-only response must never save a false location');
  respond(initial, 'older-home');
  await settle();
  assert.equal(page.data.weather.temperatureText, '18°');
  assert.equal(page.data.weather.place, '位置待更新');
  storage.set('snowlit_token', 'session-b');
  page.onShow();
  respond(requests.splice(0), 'account-b');
  await settle();
  assert.equal(page.data.weather.temperatureText, '--°');
  assert.equal(page.transientWeather, null);
});

test('a location result obtained after logout never sends coordinates with a new session', async () => {
  const { page, requests, storage } = createPage('index', 'session-a');
  page.onShow();
  respond(requests.splice(0), 'account-a');
  await settle();
  let finishLocation;
  wx.getLocation = (options) => { finishLocation = options.success; };
  page.updateCurrentLocation();
  storage.set('snowlit_token', 'session-b');
  page.onShow();
  respond(requests.splice(0), 'account-b');
  await settle();
  finishLocation({ latitude: 12, longitude: 18 });
  await settle();
  assert.equal(requests.length, 0);
  assert.equal(page.data.locationUpdating, false);
});
