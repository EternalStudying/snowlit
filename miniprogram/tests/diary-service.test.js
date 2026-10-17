const assert = require('node:assert/strict');
const { config } = require('../constants/config');

const storage = {};
const calls = [];
const uploadCalls = [];
const uploadProgressHandlers = [];

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
  uploadFile(options) {
    uploadCalls.push(options);
    options.success({
      statusCode: 200,
      data: JSON.stringify({
        uploadId: 7,
        url: 'https://snowlit.example.com/media/diary/one.webp'
      })
    });
    return {
      onProgressUpdate(handler) {
        uploadProgressHandlers.push(handler);
      }
    };
  },
  showToast() {}
};

const { setToken } = require('../utils/auth');
const {
  createDiary,
  deleteDiary,
  getDiaryDetail,
  getDiaryMonth,
  getDiaryMonths,
  updateDiary,
  uploadDiaryImage
} = require('../services/diary');

async function runMonthsServiceTest() {
  setToken('jwt-token');
  await getDiaryMonths();
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/diary/months`);
  assert.equal(call.method, 'GET');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runMonthServiceTest() {
  await getDiaryMonth('2026-05');
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/diary?month=2026-05`);
  assert.equal(call.method, 'GET');
}

async function runDetailServiceTest() {
  await getDiaryDetail(12);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/diary/12`);
  assert.equal(call.method, 'GET');
}

async function runCreateServiceTest() {
  const payload = {
    contentMarkdown: '# 今天的光\n\n正文',
    date: '2026-05-28',
    moodKey: 'happy',
    visibility: 'shared'
  };

  await createDiary(payload);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/diary`);
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.data, payload);
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runUpdateServiceTest() {
  const payload = {
    contentMarkdown: '# 改过标题\n\n正文',
    moodKey: 'sweet',
    visibility: 'private'
  };

  await updateDiary(12, payload);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/diary/12`);
  assert.equal(call.method, 'PUT');
  assert.deepEqual(call.data, payload);
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runDeleteServiceTest() {
  await deleteDiary(12);
  const call = calls[calls.length - 1];

  assert.equal(call.url, `${config.apiBaseUrl}/api/diary/12`);
  assert.equal(call.method, 'DELETE');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
}

async function runUploadServiceTest() {
  const progressEvents = [];
  const result = await uploadDiaryImage('tmp/flower.jpg', (event) => {
    progressEvents.push(event);
  });
  const call = uploadCalls[uploadCalls.length - 1];

  assert.equal(call.url, `${config.uploadBaseUrl}/api/diary/images`);
  assert.equal(call.name, 'file');
  assert.equal(call.filePath, 'tmp/flower.jpg');
  assert.equal(call.header.Authorization, 'Bearer jwt-token');
  assert.deepEqual(result, {
    uploadId: 7,
    url: 'https://snowlit.example.com/media/diary/one.webp'
  });
  assert.equal(uploadProgressHandlers.length, 1);
  uploadProgressHandlers[0]({ progress: 66 });
  assert.deepEqual(progressEvents, [{ progress: 66 }]);
}

async function run() {
  await runMonthsServiceTest();
  await runMonthServiceTest();
  await runDetailServiceTest();
  await runCreateServiceTest();
  await runUpdateServiceTest();
  await runDeleteServiceTest();
  await runUploadServiceTest();
  console.log('diary-service tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
