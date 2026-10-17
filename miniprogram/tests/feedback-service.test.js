const assert = require('node:assert/strict');
const { config } = require('../constants/config');

const storage = {};
const calls = [];
const uploadCalls = [];

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
      data: { id: 5, ok: true }
    });
  },
  uploadFile(options) {
    uploadCalls.push(options);
    options.success({
      statusCode: 200,
      data: JSON.stringify({
        id: 9,
        url: 'https://snowlit.example.com/media/feedback/one.webp'
      })
    });
    return {};
  },
  showToast() {}
};

const { setToken } = require('../utils/auth');
const { createFeedback, uploadFeedbackImage } = require('../services/feedback');

async function runUploadFeedbackImageTest() {
  setToken('jwt-token');
  const result = await uploadFeedbackImage('tmp/feedback.jpg');
  const call = uploadCalls[uploadCalls.length - 1];

  assert.deepEqual(result, {
    id: 9,
    url: 'https://snowlit.example.com/media/feedback/one.webp'
  });
  assert.equal(call.url, `${config.uploadBaseUrl}/api/feedback/screenshots`);
  assert.equal(call.filePath, 'tmp/feedback.jpg');
  assert.equal(call.name, 'file');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runCreateFeedbackTest() {
  const payload = {
    type: 'bug',
    title: '图片上传失败',
    content: '反馈图片没有传上去。',
    contact: '',
    imageUrls: ['https://snowlit.example.com/media/feedback/one.webp'],
    pageUrl: '/pages/feedback/index',
    userAgent: 'iOS / WeChat'
  };

  await createFeedback(payload);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/feedback`);
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.data, payload);
  assert.equal(call.data[`screen${'shotUrls'}`], undefined);
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

runUploadFeedbackImageTest()
  .then(runCreateFeedbackTest)
  .then(() => {
    delete global.wx;
    console.log('feedback-service tests passed');
  })
  .catch((error) => {
    delete global.wx;
    console.error(error);
    process.exit(1);
  });
