const assert = require('node:assert/strict');

function createWxMock() {
  const storage = new Map();
  const navigations = [];
  const reLaunches = [];
  const toasts = [];
  let requestHandler = null;
  let uploadHandler = null;

  return {
    storage,
    navigations,
    reLaunches,
    toasts,
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
      navigateTo(options) {
        navigations.push(options);
      },
      reLaunch(options) {
        reLaunches.push(options);
      },
      showToast(options) {
        toasts.push(options);
      },
      request(options) {
        requestHandler(options);
      },
      setRequestHandler(handler) {
        requestHandler = handler;
      },
      uploadFile(options) {
        uploadHandler(options);
        return {};
      },
      setUploadHandler(handler) {
        uploadHandler = handler;
      }
    }
  };
}

function createPage(dialogCalls, result) {
  return {
    route: 'pages/index/index',
    options: { from: 'profile' },
    selectComponent(selector) {
      if (selector !== '#snowlit-dialog') {
        return null;
      }
      return {
        open(options) {
          dialogCalls.push(options);
          return Promise.resolve(result || { confirm: true, cancel: false });
        }
      };
    }
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function runUnauthorizedPromptTest() {
  const mock = createWxMock();
  const dialogCalls = [];
  global.wx = mock.wx;
  global.getCurrentPages = () => [createPage(dialogCalls)];

  const { STORAGE_KEYS } = require('../utils/auth');
  const { handleUnauthorized } = require('../utils/request');

  mock.storage.set(STORAGE_KEYS.TOKEN, 'expired-token');
  mock.storage.set(STORAGE_KEYS.USER, { id: 1 });
  mock.storage.set(`${STORAGE_KEYS.ALBUM_PRIVATE_TOKEN_PREFIX}12`, { token: 'private' });

  const first = handleUnauthorized({});
  const second = handleUnauthorized({});

  await Promise.all([first, second]);
  await flushPromises();

  assert.equal(dialogCalls.length, 1);
  assert.deepEqual(dialogCalls[0], {
    title: '登录已过期',
    content: '需要重新登录后继续查看',
    confirmText: '去登录',
    cancelText: '取消',
    showCancel: false,
    closeOnMask: false
  });
  assert.equal(mock.storage.has(STORAGE_KEYS.TOKEN), false);
  assert.equal(mock.storage.has(STORAGE_KEYS.USER), false);
  assert.equal(mock.storage.has(`${STORAGE_KEYS.ALBUM_PRIVATE_TOKEN_PREFIX}12`), false);
  assert.deepEqual(mock.storage.get(STORAGE_KEYS.LOGIN_REDIRECT), '/pages/index/index?from=profile');
  assert.deepEqual(mock.navigations, []);
  assert.deepEqual(mock.reLaunches, [{ url: '/pages/login/index' }]);
}

async function runUnauthorizedRequestTest() {
  const mock = createWxMock();
  const dialogCalls = [];
  global.wx = mock.wx;
  global.getCurrentPages = () => [createPage(dialogCalls)];

  const { request } = require('../utils/request');

  mock.wx.setRequestHandler((options) => {
    options.success({
      statusCode: 401,
      data: {
        code: 'TOKEN_EXPIRED',
        message: '登录已过期'
      }
    });
  });

  await assert.rejects(() => request({ url: '/api/home' }), {
    name: 'SnowlitApiError',
    statusCode: 401
  });
  await flushPromises();

  assert.equal(dialogCalls.length, 1);
  assert.equal(mock.toasts.length, 0);
  assert.deepEqual(mock.navigations, []);
  assert.deepEqual(mock.reLaunches, [{ url: '/pages/login/index' }]);
}

async function runRedirectDisabledTest() {
  const mock = createWxMock();
  const dialogCalls = [];
  global.wx = mock.wx;
  global.getCurrentPages = () => [createPage(dialogCalls)];

  const { handleUnauthorized } = require('../utils/request');

  await handleUnauthorized({ redirectOnUnauthorized: false });

  assert.equal(dialogCalls.length, 0);
  assert.equal(mock.navigations.length, 0);
  assert.equal(mock.reLaunches.length, 0);
}

async function runUnauthorizedUploadTest() {
  const mock = createWxMock();
  const dialogCalls = [];
  global.wx = mock.wx;
  global.getCurrentPages = () => [createPage(dialogCalls)];

  const { uploadFile } = require('../utils/upload');

  mock.wx.setUploadHandler((options) => {
    options.success({
      statusCode: 401,
      data: JSON.stringify({
        code: 'TOKEN_EXPIRED',
        message: '登录已过期'
      })
    });
  });

  await assert.rejects(() => uploadFile({
    url: '/api/feedback/screenshots',
    filePath: 'tmp.jpg'
  }), {
    name: 'SnowlitApiError',
    statusCode: 401
  });
  await flushPromises();

  assert.equal(dialogCalls.length, 1);
  assert.equal(mock.toasts.length, 0);
  assert.deepEqual(mock.navigations, []);
  assert.deepEqual(mock.reLaunches, [{ url: '/pages/login/index' }]);
}

async function runStatusMessageMappingTest() {
  const cases = [
    {
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED', message: '标题不能为空' },
      expected: '标题不能为空'
    },
    {
      statusCode: 403,
      data: { code: 'FORBIDDEN', message: 'raw forbidden' },
      expected: '当前账号没有操作权限'
    },
    {
      statusCode: 404,
      data: { code: 'NOT_FOUND', message: 'raw not found' },
      expected: '内容不存在或已删除'
    },
    {
      statusCode: 500,
      data: { code: 'INTERNAL_ERROR', message: 'raw server error' },
      expected: '服务繁忙，请稍后重试'
    }
  ];

  for (const item of cases) {
    const mock = createWxMock();
    global.wx = mock.wx;
    global.getCurrentPages = () => [];
    const { request } = require('../utils/request');

    mock.wx.setRequestHandler((options) => {
      options.success({
        statusCode: item.statusCode,
        data: item.data
      });
    });

    await assert.rejects(() => request({ url: '/api/probe', silent: true }), {
      name: 'SnowlitApiError',
      statusCode: item.statusCode,
      message: item.expected
    });
  }
}

async function runSkipAuthUnauthorizedKeepsBackendMessageTest() {
  const mock = createWxMock();
  global.wx = mock.wx;
  global.getCurrentPages = () => [createPage([])];
  const { request } = require('../utils/request');

  mock.wx.setRequestHandler((options) => {
    options.success({
      statusCode: 401,
      data: {
        code: 'ACCOUNT_PASSWORD_INVALID',
        message: '账号或密码不正确'
      }
    });
  });

  await assert.rejects(() => request({
    url: '/api/auth/wechat-bind-login',
    method: 'POST',
    data: { code: 'wx-code', username: 'demo', password: 'wrong' },
    skipAuth: true,
    silent: true
  }), {
    name: 'SnowlitApiError',
    statusCode: 401,
    code: 'ACCOUNT_PASSWORD_INVALID',
    message: '账号或密码不正确'
  });
  await flushPromises();

  assert.deepEqual(mock.reLaunches, []);
  assert.deepEqual(mock.navigations, []);
}

async function run() {
  await runUnauthorizedPromptTest();
  await runUnauthorizedRequestTest();
  await runRedirectDisabledTest();
  await runUnauthorizedUploadTest();
  await runStatusMessageMappingTest();
  await runSkipAuthUnauthorizedKeepsBackendMessageTest();
  delete global.wx;
  delete global.getCurrentPages;
  console.log('request auth tests passed');
}

run().catch((error) => {
  delete global.wx;
  delete global.getCurrentPages;
  console.error(error);
  process.exit(1);
});
