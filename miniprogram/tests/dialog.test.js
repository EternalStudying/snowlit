const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dialog = require('../utils/dialog');

function withGlobals(globals, run) {
  const previousWx = global.wx;
  const previousPages = global.getCurrentPages;
  global.wx = globals.wx;
  global.getCurrentPages = globals.getCurrentPages;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      global.wx = previousWx;
      global.getCurrentPages = previousPages;
    });
}

function createDialogRecorder(result) {
  const calls = [];
  return {
    calls,
    component: {
      open(options) {
        calls.push(options);
        return Promise.resolve(result || { confirm: true, cancel: false });
      }
    }
  };
}

async function runComponentDispatchTest() {
  const recorder = createDialogRecorder({ confirm: true, cancel: false });
  let fallbackCalled = false;

  await withGlobals({
    wx: {
      showModal() {
        fallbackCalled = true;
      }
    },
    getCurrentPages() {
      return [
        {
          selectComponent(selector) {
            assert.equal(selector, '#snowlit-dialog');
            return recorder.component;
          }
        }
      ];
    }
  }, async () => {
    const result = await dialog.showConfirm({
      title: '退出登录',
      content: '退出后需要重新微信登录才能查看私密内容。',
      confirmText: '退出'
    });

    assert.equal(fallbackCalled, false);
    assert.deepEqual(recorder.calls[0], {
      title: '退出登录',
      content: '退出后需要重新微信登录才能查看私密内容。',
      confirmText: '退出',
      cancelText: '取消',
      showCancel: true,
      closeOnMask: false
    });
    assert.deepEqual(result, { confirm: true, cancel: false });
  });
}

async function runFallbackTest() {
  const calls = [];

  await withGlobals({
    wx: {
      showModal(options) {
        calls.push(options);
        options.success({ confirm: false, cancel: true });
      }
    },
    getCurrentPages() {
      return [];
    }
  }, async () => {
    const result = await dialog.showAlert({
      title: '隐私说明',
      content: '小程序端不保存微信敏感凭据。'
    });

    assert.equal(calls[0].showCancel, false);
    assert.equal(calls[0].confirmText, '知道了');
    assert.deepEqual(result, { confirm: false, cancel: true });
  });
}

function runNormalizeTest() {
  assert.deepEqual(dialog.normalizeDialogOptions('更新公告'), {
    title: '提示',
    content: '更新公告',
    confirmText: '知道了',
    cancelText: '取消',
    showCancel: false,
    closeOnMask: false
  });

  assert.deepEqual(dialog.normalizeDialogOptions({
    title: '更新位置',
    content: '将获取你当前的位置。',
    confirmText: '更新',
    showCancel: true,
    closeOnMask: true
  }), {
    title: '更新位置',
    content: '将获取你当前的位置。',
    confirmText: '更新',
    cancelText: '取消',
    showCancel: true,
    closeOnMask: true
  });
}

function runMountingTest() {
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.equal(appJson.usingComponents['snowlit-dialog'], 'components/snowlit-dialog/index');

  appJson.pages.forEach((page) => {
    const wxml = fs.readFileSync(path.join(__dirname, `../${page}.wxml`), 'utf8');
    assert.equal(wxml.includes('<snowlit-dialog id="snowlit-dialog" />'), true, `${page} should mount snowlit-dialog`);
  });

  const componentWxml = fs.readFileSync(path.join(__dirname, '../components/snowlit-dialog/index.wxml'), 'utf8');
  const componentWxss = fs.readFileSync(path.join(__dirname, '../components/snowlit-dialog/index.wxss'), 'utf8');
  assert.equal(componentWxml.includes('snowlit-dialog-card'), true);
  assert.equal(componentWxml.includes('bindtap="handleConfirm"'), true);
  assert.equal(componentWxss.includes('border-radius: 18rpx;'), true);
  assert.equal(componentWxss.includes('snowlit-dialog-mask--visible'), true);
  assert.equal(componentWxss.includes('white-space: pre-line;'), true);
}

function runPageUsageTest() {
  const pageFiles = fs.readdirSync(path.join(__dirname, '../pages'))
    .map((page) => path.join(__dirname, '../pages', page, 'index.js'))
    .filter((file) => fs.existsSync(file));

  pageFiles.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(source.includes('wx.showModal'), false, `${file} should use utils/dialog`);
  });
}

async function run() {
  await runComponentDispatchTest();
  await runFallbackTest();
  runNormalizeTest();
  runMountingTest();
  runPageUsageTest();
  console.log('dialog tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
