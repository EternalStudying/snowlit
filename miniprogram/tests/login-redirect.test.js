const assert = require('node:assert/strict');

function clearModules() {
  [
    '../pages/login/index',
    '../utils/auth',
    '../utils/storage',
    '../constants/routes'
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
}

function createWxMock() {
  const storage = new Map();
  const redirects = [];
  const tabSwitches = [];

  return {
    storage,
    redirects,
    tabSwitches,
    wx: {
      getStorageSync(key) {
        return storage.has(key) ? storage.get(key) : '';
      },
      setStorageSync(key, value) {
        storage.set(key, value);
      },
      removeStorageSync(key) {
        storage.delete(key);
      },
      getStorageInfoSync() {
        return { keys: Array.from(storage.keys()) };
      },
      redirectTo(options) {
        redirects.push(options);
      },
      switchTab(options) {
        tabSwitches.push(options);
      }
    }
  };
}

function loadLoginPage() {
  let page = null;
  global.Page = (definition) => {
    page = {
      data: { ...(definition.data || {}) },
      setData(patch) {
        this.data = { ...this.data, ...patch };
      },
      ...definition
    };
  };
  clearModules();
  require('../pages/login/index');
  return page;
}

function cleanup() {
  delete global.wx;
  delete global.Page;
  clearModules();
}

function runTabRedirectTest() {
  const mock = createWxMock();
  global.wx = mock.wx;
  const { STORAGE_KEYS } = require('../utils/auth');
  mock.storage.set(STORAGE_KEYS.LOGIN_REDIRECT, '/pages/diary/index');

  const page = loadLoginPage();
  page.navigateAfterLogin();

  assert.equal(mock.tabSwitches.length, 1);
  assert.equal(mock.tabSwitches[0].url, '/pages/diary/index');
  assert.equal(typeof mock.tabSwitches[0].fail, 'function');
  assert.equal(mock.redirects.length, 0);
  assert.equal(mock.storage.has(STORAGE_KEYS.LOGIN_REDIRECT), false);
}

function runDetailRedirectTest() {
  const mock = createWxMock();
  global.wx = mock.wx;
  const { STORAGE_KEYS } = require('../utils/auth');
  mock.storage.set(STORAGE_KEYS.LOGIN_REDIRECT, '/pages/story-detail/index?id=12');

  const page = loadLoginPage();
  page.navigateAfterLogin();

  assert.equal(mock.redirects.length, 1);
  assert.equal(mock.redirects[0].url, '/pages/story-detail/index?id=12');
  assert.equal(typeof mock.redirects[0].fail, 'function');
  assert.equal(mock.tabSwitches.length, 0);
  assert.equal(mock.storage.has(STORAGE_KEYS.LOGIN_REDIRECT), false);
}

try {
  runTabRedirectTest();
  runDetailRedirectTest();
  console.log('login redirect tests passed');
} finally {
  cleanup();
}
