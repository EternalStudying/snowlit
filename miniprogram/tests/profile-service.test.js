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
      data: {
        id: 2,
        username: 'member_b',
        displayName: '伴侣 B',
        mood: '想见你',
        bio: '把每一天都写进 Snowlit。'
      }
    });
  },
  showToast() {}
};

const { setToken } = require('../utils/auth');
const { updateProfile } = require('../services/profile');

async function runUpdateProfileTest() {
  setToken('jwt-token');

  const result = await updateProfile({
    displayName: '伴侣 B',
    mood: '想见你',
    bio: '把每一天都写进 Snowlit。'
  });
  const call = calls[calls.length - 1];

  assert.equal(result.displayName, '伴侣 B');
  assert.equal(call.url, `${config.apiBaseUrl}/api/auth/me/profile`);
  assert.equal(call.method, 'PATCH');
  assert.deepEqual(call.data, {
    displayName: '伴侣 B',
    mood: '想见你',
    bio: '把每一天都写进 Snowlit。'
  });
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

runUpdateProfileTest()
  .then(() => {
    console.log('profile-service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
