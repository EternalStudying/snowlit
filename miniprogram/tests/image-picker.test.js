const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const { appendPickedImages, collectUploadedUrls, readPickedPath } = require('../utils/image-list');

function loadPicker({ agreed = true } = {}) {
  ['utils/image-picker.js', 'utils/privacy.js', 'utils/notify.js'].forEach((file) => {
    delete require.cache[require.resolve(path.join(root, file))];
  });
  const picks = [];
  const toasts = [];
  const prompts = [];
  global.getCurrentPages = () => [{
    selectComponent(selector) {
      if (selector === '#snowlit-privacy') {
        return {
          authorize: (options) => {
            prompts.push(options);
            return Promise.resolve(agreed);
          }
        };
      }
      return null;
    }
  }];
  global.wx = {
    showToast: ({ title }) => toasts.push(title),
    chooseMedia: (options) => picks.push(options)
  };
  const { pickImages } = require('../utils/image-picker');
  return { pickImages, picks, toasts, prompts };
}

async function flush() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

test('pickImages asks for privacy consent first, then opens a compressed image picker', async () => {
  const { pickImages, picks, prompts } = loadPicker();
  const result = pickImages({ count: 2, title: '选择图片', message: 'why' });
  await flush();
  assert.deepEqual(prompts, [{ title: '选择图片', message: 'why' }]);
  assert.equal(picks.length, 1);
  assert.equal(picks[0].count, 2);
  assert.deepEqual(picks[0].mediaType, ['image']);
  assert.deepEqual(picks[0].sizeType, ['compressed']);
  picks[0].success({ tempFiles: [{ tempFilePath: 'wxfile://a.jpg' }] });
  assert.deepEqual(await result, [{ tempFilePath: 'wxfile://a.jpg' }]);
});

test('pickImages resolves empty and says why when consent is declined', async () => {
  const { pickImages, picks, toasts } = loadPicker({ agreed: false });
  assert.deepEqual(await pickImages({ count: 1, title: 't', message: 'm', noun: '截图' }), []);
  assert.equal(picks.length, 0);
  assert.deepEqual(toasts, ['同意隐私指引后才能选择截图']);
});

test('pickImages drops a result that returns after the caller became busy', async () => {
  const { pickImages, picks } = loadPicker();
  let busy = false;
  const result = pickImages({ count: 1, title: 't', message: 'm', isBlocked: () => busy });
  await flush();
  busy = true;
  picks[0].success({ tempFiles: [{ tempFilePath: 'wxfile://late.jpg' }] });
  assert.deepEqual(await result, []);
});

test('pickImages does not open the picker when the caller became busy during consent', async () => {
  const { pickImages, picks } = loadPicker();
  assert.deepEqual(await pickImages({ count: 1, title: 't', message: 'm', isBlocked: () => true }), []);
  assert.equal(picks.length, 0);
});

test('pickImages stays quiet on cancel and reports other failures', async () => {
  const { pickImages, picks, toasts } = loadPicker();
  const cancelled = pickImages({ count: 1, title: 't', message: 'm', noun: '照片' });
  await flush();
  picks[0].fail({ errMsg: 'chooseMedia:fail cancel' });
  assert.deepEqual(await cancelled, []);
  assert.deepEqual(toasts, []);

  const failed = pickImages({ count: 1, title: 't', message: 'm', noun: '照片' });
  await flush();
  picks[1].fail({ errMsg: 'chooseMedia:fail auth deny' });
  assert.deepEqual(await failed, []);
  assert.deepEqual(toasts, ['选择照片失败，请检查权限后重试']);
});

test('appendPickedImages fills free slots, skips files without a path and reports the overflow', () => {
  const toItem = (filePath, file) => ({ path: filePath, width: file.width || 0 });
  const result = appendPickedImages(
    [{ path: 'old.jpg' }],
    [{ tempFilePath: 'a.jpg', width: 9 }, {}, { path: 'b.jpg' }, 'c.jpg'],
    3,
    toItem
  );
  assert.deepEqual(result.images, [{ path: 'old.jpg' }, { path: 'a.jpg', width: 9 }, { path: 'b.jpg', width: 0 }]);
  assert.equal(result.reachedLimit, true);

  const fits = appendPickedImages([], [{ tempFilePath: 'a.jpg' }], 3, toItem);
  assert.equal(fits.reachedLimit, false);
});

test('collectUploadedUrls keeps uploaded images only, trimmed and in order', () => {
  assert.deepEqual(collectUploadedUrls([
    { status: 'uploaded', url: 'https://media.test/one.webp' },
    { status: 'failed', url: 'https://media.test/two.webp' },
    { status: 'local', url: '' },
    { status: 'uploaded', url: '  https://media.test/three.webp  ' }
  ]), ['https://media.test/one.webp', 'https://media.test/three.webp']);
});

test('readPickedPath accepts WeChat temp files, plain paths and nothing', () => {
  assert.equal(readPickedPath({ tempFilePath: ' wxfile://a.jpg ' }), 'wxfile://a.jpg');
  assert.equal(readPickedPath({ path: 'b.jpg' }), 'b.jpg');
  assert.equal(readPickedPath('c.jpg'), 'c.jpg');
  assert.equal(readPickedPath(undefined), '');
});
