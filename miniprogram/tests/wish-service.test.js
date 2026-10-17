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
      data: { id: 8, title: '春天一起赏樱' }
    });
  },
  uploadFile(options) {
    calls.push(options);
    options.success({
      statusCode: 200,
      data: JSON.stringify({ id: 9, title: '春天一起赏樱', completed: true })
    });
    return {};
  },
  showToast() {}
};

const { setToken } = require('../utils/auth');
const { completeWish, createWish, deleteWish, reopenWish, updateWish } = require('../services/wish');

async function runCreateWishTest() {
  setToken('jwt-token');
  const payload = {
    title: '春天一起赏樱',
    category: 'want_go',
    description: '去很漂亮的地方',
    locationName: '示例城市植物园',
    expectedCompletedAt: '2026-06-14T00:00:00',
    note: '带一瓶水'
  };

  await createWish(payload);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/wishes`);
  assert.equal(call.method, 'POST');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
  assert.match(call.header['Content-Type'], /^multipart\/form-data; boundary=snowlit-wish-/);
  assert.match(call.data, /name="payload"/);
  assert.match(call.data, /Content-Type: application\/json/);
  assert.match(call.data, /"title":"春天一起赏樱"/);
  assert.match(call.data, /"category":"want_go"/);
  assert.match(call.data, /"locationName":"示例城市植物园"/);
  assert.match(call.data, /"note":"带一瓶水"/);
  assert.equal(call.data.includes('name="image"'), false);
}

async function runCompleteWishTest() {
  calls.length = 0;

  await completeWish(9, 'tmp/done.jpg');
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.uploadBaseUrl}/api/wishes/9/complete`);
  assert.equal(call.filePath, 'tmp/done.jpg');
  assert.equal(call.name, 'image');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');

  calls.length = 0;
  await assert.rejects(() => completeWish(9, ''), /请先添加完成图片/);
  assert.equal(calls.length, 0);
}

async function runReopenWishTest() {
  calls.length = 0;

  await reopenWish(9);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/wishes/9/reopen`);
  assert.equal(call.method, 'POST');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runUpdateWishTest() {
  calls.length = 0;

  const payload = {
    title: '春天一起赏樱',
    category: 'want_go',
    description: '去很漂亮的地方',
    locationName: '示例城市植物园',
    expectedCompletedAt: '2026-06-14T00:00:00',
    note: '带一瓶水'
  };

  await updateWish(9, payload);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/wishes/9`);
  assert.equal(call.method, 'PUT');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
  assert.equal(call.header['Content-Type'], 'application/json');
  assert.deepEqual(call.data, payload);
}

async function runDeleteWishTest() {
  calls.length = 0;

  await deleteWish(9);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/wishes/9`);
  assert.equal(call.method, 'DELETE');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

runCreateWishTest()
  .then(runCompleteWishTest)
  .then(runReopenWishTest)
  .then(runUpdateWishTest)
  .then(runDeleteWishTest)
  .then(() => {
    delete global.wx;
    console.log('wish-service tests passed');
  })
  .catch((error) => {
    delete global.wx;
    console.error(error);
    process.exit(1);
  });
