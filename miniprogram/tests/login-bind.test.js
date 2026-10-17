const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../constants/config');

function clearModules() {
  [
    '../pages/login/index',
    '../services/auth',
    '../utils/request',
    '../utils/auth',
    '../utils/storage',
    '../utils/notify',
    '../utils/dialog'
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
}

function createWxMock() {
  const storage = new Map();
  const requests = [];
  const toasts = [];
  const loginCalls = [];
  let requestResponse = {
    statusCode: 200,
    data: {
      token: 'jwt-token',
      user: { id: 1, username: 'demo', displayName: 'Demo User' }
    }
  };

  return {
    requests,
    toasts,
    loginCalls,
    setRequestResponse(response) {
      requestResponse = response;
    },
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
      request(options) {
        requests.push(options);
        options.success(requestResponse);
      },
      login(options) {
        loginCalls.push(options);
        options.success({ code: 'fresh-wx-code' });
      },
      showToast(options) {
        toasts.push(options);
      },
      switchTab() {},
      redirectTo() {}
    }
  };
}

function loadLoginPage(authMock) {
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
  require.cache[require.resolve('../services/auth')] = {
    id: require.resolve('../services/auth'),
    filename: require.resolve('../services/auth'),
    loaded: true,
    exports: authMock
  };
  require('../pages/login/index');
  return page;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function runAuthServiceBindRequestTest() {
  const mock = createWxMock();
  global.wx = mock.wx;
  global.getCurrentPages = () => [];
  clearModules();

  const { wechatBindLogin } = require('../services/auth');
  const result = await wechatBindLogin({
    code: 'fresh-wx-code',
    username: 'demo',
    password: 'demo123456'
  });
  const call = mock.requests[mock.requests.length - 1];

  assert.equal(result.token, 'jwt-token');
  assert.equal(call.url, `${config.apiBaseUrl}/api/auth/wechat-bind-login`);
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.data, {
    code: 'fresh-wx-code',
    username: 'demo',
    password: 'demo123456'
  });
  assert.equal(call.header.Authorization, undefined);
}

async function runUnboundWechatShowsBindFormTest() {
  const mock = createWxMock();
  global.wx = mock.wx;
  global.getCurrentPages = () => [];

  const page = loadLoginPage({
    wechatLogin() {
      return Promise.reject({
        code: 'WECHAT_ACCOUNT_NOT_BOUND',
        message: '微信账号未绑定'
      });
    },
    wechatBindLogin() {
      return Promise.resolve({ token: 'jwt-token', user: { id: 1, username: 'demo' } });
    }
  });

  page.setData({ privacyAgreed: true });
  page.handleWechatLogin();
  await flushPromises();

  assert.equal(page.data.loggingIn, false);
  assert.equal(page.data.showBindForm, true);
  assert.equal(page.data.bindMessage, '微信账号未绑定，请输入 Snowlit 账号密码完成绑定');
  assert.equal(mock.toasts.length, 0);
}

async function runBindSubmitUsesFreshWechatCodeTest() {
  const mock = createWxMock();
  const bindCalls = [];
  global.wx = mock.wx;
  global.getCurrentPages = () => [];

  const page = loadLoginPage({
    wechatLogin() {
      return Promise.reject({
        code: 'WECHAT_ACCOUNT_NOT_BOUND',
        message: '微信账号未绑定'
      });
    },
    wechatBindLogin(payload) {
      bindCalls.push(payload);
      return Promise.resolve({ token: 'jwt-token', user: { id: 1, username: 'demo' } });
    }
  });

  page.setData({
    showBindForm: true,
    privacyAgreed: true,
    bindUsername: ' demo ',
    bindPassword: 'demo123456'
  });
  page.handleBindSubmit();
  await flushPromises();

  assert.equal(mock.loginCalls.length, 1);
  assert.deepEqual(bindCalls, [{
    code: 'fresh-wx-code',
    username: 'demo',
    password: 'demo123456'
  }]);
}

async function runAgreementRequiredBeforeWechatLoginTest() {
  const mock = createWxMock();
  global.wx = mock.wx;
  global.getCurrentPages = () => [];

  const page = loadLoginPage({
    wechatLogin() {
      return Promise.resolve({ token: 'jwt-token', user: { id: 1, username: 'demo' } });
    },
    wechatBindLogin() {
      return Promise.resolve({ token: 'jwt-token', user: { id: 1, username: 'demo' } });
    }
  });

  assert.equal(page.data.privacyAgreed, false);
  page.handleWechatLogin();
  assert.equal(mock.loginCalls.length, 0);
  assert.equal(mock.toasts[0].title, '请先阅读并同意用户服务协议和隐私政策');

  page.handleAgreementChange({ detail: { value: ['agree'] } });
  page.handleWechatLogin();
  await flushPromises();
  assert.equal(mock.loginCalls.length, 1);
}

async function runAgreementRequiredBeforeBindSubmitTest() {
  const mock = createWxMock();
  global.wx = mock.wx;
  global.getCurrentPages = () => [];

  const page = loadLoginPage({
    wechatLogin() {
      return Promise.reject({
        code: 'WECHAT_ACCOUNT_NOT_BOUND',
        message: '微信账号未绑定'
      });
    },
    wechatBindLogin() {
      return Promise.resolve({ token: 'jwt-token', user: { id: 1, username: 'demo' } });
    }
  });

  page.setData({
    showBindForm: true,
    bindUsername: 'demo',
    bindPassword: 'demo123456'
  });
  page.handleBindSubmit();
  assert.equal(mock.loginCalls.length, 0);
  assert.equal(mock.toasts[0].title, '请先阅读并同意用户服务协议和隐私政策');
}

function runLoginBindMarkupTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/login/index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../pages/login/index.js'), 'utf8');

  assert.match(wxml, /wx:if="\{\{showBindForm\}\}"/);
  assert.match(wxml, /bindinput="handleBindUsernameInput"/);
  assert.match(wxml, /password="\{\{true\}\}"/);
  assert.match(wxml, /bindtap="handleBindSubmit"/);
  assert.match(wxml, /checkbox-group/);
  assert.match(wxml, /checked="\{\{privacyAgreed\}\}"/);
  assert.match(wxml, /《用户服务协议》/);
  assert.match(wxml, /《隐私政策》/);
  assert.doesNotMatch(wxml, /登录即表示同意/);
  assert.doesNotMatch(wxml, /checked="\{\{true\}\}"/);
  assert.match(js, /WECHAT_ACCOUNT_NOT_BOUND/);
  assert.match(js, /wechatBindLogin/);
  assert.match(js, /handleAgreementChange/);
  assert.match(js, /请先阅读并同意用户服务协议和隐私政策/);
  assert.match(js, /确认你的微信身份与 Snowlit 账号的绑定关系/);
  assert.match(js, /首次同意自动定位说明并授权后，首页打开或登录后自动定位/);
  assert.match(js, /前台每 20 分钟更新，离开首页或切到后台暂停/);
  assert.doesNotMatch(js, /仅在你主动点击更新位置并授权后/);
  assert.match(js, /你主动选择或拍摄图片时/);
  assert.match(js, /账号名、昵称、心情、简介/);
  assert.match(js, /手机型号、系统版本、微信版本等基础信息/);
  assert.match(js, /联系方式/);
  assert.doesNotMatch(js, /wx\.getLocation|wx\.chooseMedia|wx\.getDeviceInfo|wx\.getAppBaseInfo/);
  assert.doesNotMatch(js, /openid|unionid|session_key|AppSecret|一次性登录 code/);
}

async function run() {
  await runAuthServiceBindRequestTest();
  await runUnboundWechatShowsBindFormTest();
  await runBindSubmitUsesFreshWechatCodeTest();
  await runAgreementRequiredBeforeWechatLoginTest();
  await runAgreementRequiredBeforeBindSubmitTest();
  runLoginBindMarkupTest();
  console.log('login bind tests passed');
}

run().catch((error) => {
  delete global.wx;
  delete global.Page;
  delete global.getCurrentPages;
  clearModules();
  console.error(error);
  process.exit(1);
});
