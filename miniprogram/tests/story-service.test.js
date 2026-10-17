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
      data: { ok: true }
    });
  },
  showToast() {}
};

const { setToken } = require('../utils/auth');
const {
  deleteMoment,
  updateMoment
} = require('../services/story');

async function runUpdateMomentTest() {
  setToken('jwt-token');
  const payload = {
    title: '改过的点滴',
    content: '晚风很好',
    eventTime: '2026-05-01T20:00:00',
    endTime: null,
    locationName: '海边',
    address: '示例城市示例街区',
    longitude: 18.6759,
    latitude: 4.8741,
    category: 'travel',
    images: ['https://snowlit.example.com/media/story/one.webp']
  };

  await updateMoment(12, payload);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/story/moments/12`);
  assert.equal(call.method, 'PUT');
  assert.deepEqual(call.data, payload);
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runDeleteMomentTest() {
  await deleteMoment(12);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/story/moments/12`);
  assert.equal(call.method, 'DELETE');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function run() {
  await runUpdateMomentTest();
  await runDeleteMomentTest();
  console.log('story-service tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
