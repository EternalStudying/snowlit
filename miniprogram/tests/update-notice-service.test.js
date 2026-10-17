const assert = require('node:assert/strict');
const { config } = require('../constants/config');

const storage = {};
const calls = [];

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
    options.success({
      statusCode: 200,
      data: { shouldShow: true, notice: { title: '小程序更新公告' } }
    });
  },
  showToast() {}
};

const { setToken } = require('../utils/auth');
const { getUpdateNotice, muteUpdateNoticeToday } = require('../services/update-notice');

async function runGetUpdateNoticeTest() {
  setToken('jwt-token');

  const result = await getUpdateNotice();
  const call = calls[calls.length - 1];

  assert.equal(result.notice.title, '小程序更新公告');
  assert.equal(call.url, `${config.apiBaseUrl}/api/update-notice?client=miniprogram`);
  assert.equal(call.method, 'GET');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runMuteUpdateNoticeTodayTest() {
  await muteUpdateNoticeToday();
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/update-notice/mute-today?client=miniprogram`);
  assert.equal(call.method, 'POST');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

runGetUpdateNoticeTest()
  .then(runMuteUpdateNoticeTodayTest)
  .then(() => {
    delete global.wx;
    console.log('update-notice-service tests passed');
  })
  .catch((error) => {
    delete global.wx;
    console.error(error);
    process.exit(1);
  });
