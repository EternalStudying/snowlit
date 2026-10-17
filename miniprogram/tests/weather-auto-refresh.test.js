const assert = require('node:assert/strict');
const path = require('node:path');
const { test, afterEach } = require('node:test');

const INTERVAL = 20 * 60 * 1000;
const CONSENT_KEY = 'snowlit_weather_auto_consent_v1';
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalNow = Date.now;

function createHome({ token = 'session-a', consent = false, permission, confirm = true, locationDenied = false, deferWeather = false } = {}) {
  const root = path.resolve(__dirname, '..') + path.sep;
  Object.keys(require.cache).forEach((file) => {
    if (file.startsWith(root) && !file.includes(`${path.sep}tests${path.sep}`)) delete require.cache[file];
  });
  const storage = new Map([['snowlit_token', token], [CONSENT_KEY, consent]]);
  const timers = new Map();
  const dialogs = [];
  const locations = [];
  const requests = [];
  const settings = { confirm, permission, locationDenied };
  let now = 1000000;
  let nextTimer = 1;
  let definition;
  Date.now = () => now;
  global.setTimeout = (callback, delay) => {
    const id = nextTimer++;
    timers.set(id, { callback, due: now + delay });
    return id;
  };
  global.clearTimeout = (id) => timers.delete(id);
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => [];
  global.wx = {
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    showModal: (options) => { dialogs.push(options); options.success({ confirm: settings.confirm }); },
    getSetting: (options) => options.success({ authSetting: { 'scope.userLocation': settings.permission } }),
    openSetting: (options) => { settings.permission = true; options.success({ authSetting: { 'scope.userLocation': true } }); },
    getLocation(options) {
      locations.push(options);
      if (settings.locationDenied) options.fail({ errMsg: 'getLocation:fail auth deny' });
      else options.success({ latitude: 12.0603, longitude: 18.7969 });
    },
    request(options) {
      requests.push(options);
      const pathname = new URL(options.url).pathname;
      if (pathname === '/api/weather/atmosphere/browser') {
        if (!deferWeather) options.success({ statusCode: 200, data: {
          city: 'Example City', country: 'Example Country', district: '', province: '',
          temperature: 18, rawWeather: '晴', weatherState: 'clear', weatherVariant: 'clear'
        } });
      } else if (pathname === '/api/home/location') {
        options.success({ statusCode: 204 });
      } else if (pathname === '/api/home') {
        options.success({ statusCode: 200, data: { personStatuses: [{ city: 'Example City', weather: '晴', temperature: 18 }] } });
      } else if (pathname === '/api/story/moments' || pathname === '/api/albums') {
        options.success({ statusCode: 200, data: { items: [] } });
      } else {
        options.success({ statusCode: 200, data: {} });
      }
    }
  };
  require('../pages/index/index.js');
  const page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
  return {
    page, storage, timers, dialogs, locations, requests, settings,
    advance(ms) {
      now += ms;
      [...timers].forEach(([id, timer]) => {
        if (timer.due <= now) { timers.delete(id); timer.callback(); }
      });
    }
  };
}

async function settle() { await new Promise((resolve) => setImmediate(resolve)); }

afterEach(() => {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
  Date.now = originalNow;
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
});

test('the first foreground home update obtains consent, persists only a boolean and repeats after twenty minutes', async () => {
  const { page, dialogs, locations, timers, storage, advance } = createHome();
  page.onShow();
  await settle();
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0].content, /20 分钟/);
  assert.match(dialogs[0].content, /离开首页或切到后台即暂停/);
  assert.equal(locations.length, 1);
  assert.equal(locations[0].type, 'wgs84');
  assert.equal(storage.get(CONSENT_KEY), true);
  assert.deepEqual([...storage.keys()].sort(), [CONSENT_KEY, 'snowlit_token'].sort());
  assert.equal(timers.size, 1);
  advance(INTERVAL - 1);
  await settle();
  assert.equal(locations.length, 1);
  advance(1);
  await settle();
  assert.equal(locations.length, 2);
  assert.equal(dialogs.length, 1, 'stored consent prevents repeated prompts');
  assert.equal(timers.size, 1);
  page.onUnload();
  assert.equal(timers.size, 0);
});

test('hidden pages stop timers and refresh only when returning after the interval', async () => {
  const { page, timers, locations, advance } = createHome({ consent: true });
  page.onShow();
  await settle();
  assert.equal(locations.length, 1);
  page.onHide();
  assert.equal(timers.size, 0);
  advance(INTERVAL / 2);
  page.onShow();
  await settle();
  assert.equal(locations.length, 1);
  page.onHide();
  advance(INTERVAL);
  assert.equal(locations.length, 1, 'time spent hidden cannot start location requests');
  page.onShow();
  await settle();
  assert.equal(locations.length, 2);
  page.onUnload();
});

test('a guest does not locate, while login starts the first foreground update', async () => {
  const { page, storage, locations, timers } = createHome({ token: '', consent: true });
  page.onShow();
  await settle();
  assert.equal(locations.length, 0);
  assert.equal(timers.size, 0);
  storage.set('snowlit_token', 'session-a');
  page.onShow();
  await settle();
  assert.equal(locations.length, 1);
  page.onUnload();
});

test('cancelled consent is not automatically repeated during this runtime and manual retry can enable it', async () => {
  const { page, settings, dialogs, locations, storage, timers, advance } = createHome({ confirm: false });
  page.onShow();
  await settle();
  page.onHide();
  advance(INTERVAL * 2);
  page.onShow();
  await settle();
  assert.equal(dialogs.length, 1);
  assert.equal(locations.length, 0);
  assert.equal(timers.size, 0);
  assert.equal(storage.get(CONSENT_KEY), false);
  settings.confirm = true;
  await page.handleLocationTap();
  assert.equal(dialogs.length, 2);
  assert.equal(locations.length, 1);
  assert.equal(storage.get(CONSENT_KEY), true);
  assert.equal(timers.size, 1);
  page.onUnload();
});

test('a denied system permission stops automatic requests; explicit settings recovery can resume them', async () => {
  const { page, dialogs, locations, settings, timers, advance } = createHome({ consent: true, permission: false });
  page.onShow();
  await settle();
  assert.equal(locations.length, 0);
  assert.equal(dialogs.length, 0);
  assert.equal(timers.size, 0);
  advance(INTERVAL * 2);
  page.onHide();
  page.onShow();
  await settle();
  assert.equal(locations.length, 0);
  await page.handleLocationTap();
  assert.equal(dialogs[0].title, '开启位置权限');
  assert.equal(settings.permission, true);
  assert.equal(locations.length, 1);
  assert.equal(timers.size, 1);
  page.onUnload();
});

test('a native authorization denial suppresses repeat automatic requests without a foreground loop', async () => {
  const { page, locations, timers, advance } = createHome({ consent: true, locationDenied: true });
  page.onShow();
  await settle();
  assert.equal(locations.length, 1);
  assert.equal(timers.size, 0);
  advance(INTERVAL * 2);
  page.onHide();
  page.onShow();
  await settle();
  assert.equal(locations.length, 1);
  assert.equal(page.data.locationUpdating, false);
});

test('a weather response arriving after the page hides cannot save a location or restart its timer', async () => {
  const { page, requests, timers } = createHome({ consent: true, deferWeather: true });
  page.onShow();
  await settle();
  const weather = requests.find((request) => new URL(request.url).pathname === '/api/weather/atmosphere/browser');
  assert.ok(weather);
  page.onHide();
  weather.success({ statusCode: 200, data: {
    city: 'Example City', country: 'Example Country', temperature: 18,
    rawWeather: '晴', weatherState: 'clear', weatherVariant: 'clear'
  } });
  await settle();
  assert.equal(requests.filter((request) => new URL(request.url).pathname === '/api/home/location').length, 0);
  assert.equal(timers.size, 0);
  assert.equal(page.data.locationUpdating, false);
});
