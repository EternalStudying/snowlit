const assert = require('node:assert/strict');

function clearDiaryEditModules() {
  [
    '../pages/diary-edit/index.js',
    '../pages/diary-edit/diary-edit-presenter.js',
    '../services/diary.js',
    '../utils/upload.js',
    '../utils/request.js',
    '../utils/notify.js',
    '../utils/privacy.js',
    '../utils/auth.js'
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
}

function assignPath(target, key, value) {
  const parts = key.split('.');
  let current = target;
  parts.slice(0, -1).forEach((part) => {
    current[part] = current[part] || {};
    current = current[part];
  });
  current[parts[parts.length - 1]] = value;
}

function createPage(uploadHandler) {
  clearDiaryEditModules();

  let pageDefinition;
  const storage = new Map([['snowlit_token', 'jwt-token']]);
  const toasts = [];

  global.Page = (definition) => {
    pageDefinition = definition;
  };
  global.getCurrentPages = () => [{
    selectComponent(selector) {
      if (selector === '#snowlit-privacy') {
        return { authorize: () => Promise.resolve(true) };
      }
      if (selector === '#snowlit-toast') {
        return { show: (options) => toasts.push(options.title) };
      }
      return null;
    }
  }];
  global.wx = {
    getStorageSync(key) {
      return storage.get(key) || '';
    },
    showToast(options) {
      toasts.push(options.title);
    },
    chooseMedia(options) {
      options.success({ tempFiles: [{ tempFilePath: 'wxfile://tmp/test.jpg' }] });
    },
    uploadFile(options) {
      uploadHandler(options);
      return {
        onProgressUpdate(handler) {
          handler({ progress: 100 });
        }
      };
    }
  };

  require('../pages/diary-edit/index.js');

  return {
    page: {
      ...pageDefinition,
      data: JSON.parse(JSON.stringify(pageDefinition.data)),
      setData(patch) {
        Object.keys(patch).forEach((key) => assignPath(this.data, key, patch[key]));
      }
    },
    toasts
  };
}

async function waitForUploadCompletion(page) {
  const deadline = Date.now() + 2000;
  while (!page.data.message && !page.data.images.some((image) => image.status === 'uploaded')) {
    assert.ok(Date.now() < deadline, 'upload did not reach a success or error state within 2 seconds');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function runSuccessfulUploadTest() {
  const { page, toasts } = createPage((options) => {
    setTimeout(() => {
      options.success({
        statusCode: 200,
        data: JSON.stringify({ uploadId: 1, url: 'http://cdn.example.com/one.jpg' })
      });
    }, 0);
  });

  page.chooseImages();
  await waitForUploadCompletion(page);

  assert.equal(page.data.message, '');
  assert.equal(page.data.images.length, 1);
  assert.equal(page.data.images[0].status, 'uploaded');
  assert.match(page.data.form.content, /!\[图片]\(http:\/\/cdn\.example\.com\/one\.jpg\)/);
  assert.deepEqual(toasts, []);
}

async function runUploadErrorMessageTest() {
  const { page } = createPage((options) => {
    setTimeout(() => {
      options.success({
        statusCode: 400,
        data: JSON.stringify({
          code: 'DIARY_IMAGE_TYPE_INVALID',
          message: '只支持 jpg、png、webp、gif 图片'
        })
      });
    }, 0);
  });

  page.chooseImages();
  await waitForUploadCompletion(page);

  assert.equal(page.data.message, '只支持 jpg、png、webp、gif 图片');
  assert.equal(page.data.images.length, 0);
}

async function run() {
  await runSuccessfulUploadTest();
  await runUploadErrorMessageTest();
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
  console.log('diary-edit upload tests passed');
}

run().catch((error) => {
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
  console.error(error);
  process.exit(1);
});
