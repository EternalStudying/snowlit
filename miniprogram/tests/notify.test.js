const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const notify = require('../utils/notify');

function createToastRecorder() {
  const calls = [];
  return {
    calls,
    component: {
      show(options) {
        calls.push(options);
      },
      hide() {
        calls.push({ hidden: true });
      }
    }
  };
}

function withGlobals(globals, run) {
  const previousWx = global.wx;
  const previousPages = global.getCurrentPages;
  global.wx = globals.wx;
  global.getCurrentPages = globals.getCurrentPages;
  try {
    run();
  } finally {
    global.wx = previousWx;
    global.getCurrentPages = previousPages;
  }
}

function runComponentDispatchTest() {
  const recorder = createToastRecorder();
  let fallbackCalled = false;

  withGlobals({
    wx: {
      showToast() {
        fallbackCalled = true;
      }
    },
    getCurrentPages() {
      return [
        {
          selectComponent(selector) {
            assert.equal(selector, '#snowlit-toast');
            return recorder.component;
          }
        }
      ];
    }
  }, () => {
    const result = notify.showSuccess('小纸条送到啦');
    assert.equal(fallbackCalled, false);
    assert.deepEqual(recorder.calls[0], {
      type: 'success',
      title: '小纸条送到啦',
      message: '',
      placement: 'bottom',
      duration: 2200
    });
    assert.deepEqual(result, recorder.calls[0]);
  });
}

function runFallbackTest() {
  const calls = [];

  withGlobals({
    wx: {
      showToast(options) {
        calls.push(options);
      }
    },
    getCurrentPages() {
      return [];
    }
  }, () => {
    const result = notify.showError({ title: '登录失败', duration: 1800 });
    assert.deepEqual(calls[0], {
      title: '登录失败',
      icon: 'none',
      duration: 1800,
      mask: false
    });
    assert.equal(result.type, 'error');
  });
}

function runLegacyOptionsTest() {
  assert.deepEqual(notify.normalizeToastOptions({
    title: '加载中',
    icon: 'loading',
    position: 'middle',
    duration: 0
  }), {
    type: 'loading',
    title: '加载中',
    message: '',
    placement: 'middle',
    duration: 0
  });

  assert.deepEqual(notify.normalizeToastOptions({
    message: '请填写标题',
    icon: 'none'
  }), {
    type: 'info',
    title: '请填写标题',
    message: '',
    placement: 'bottom',
    duration: 2200
  });
}

function runMountingTest() {
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.equal(appJson.usingComponents['snowlit-toast'], 'components/snowlit-toast/index');

  appJson.pages.forEach((page) => {
    const wxml = fs.readFileSync(path.join(__dirname, `../${page}.wxml`), 'utf8');
    assert.equal(wxml.includes('<snowlit-toast id="snowlit-toast" />'), true, `${page} should mount snowlit-toast`);
  });

  const componentWxml = fs.readFileSync(path.join(__dirname, '../components/snowlit-toast/index.wxml'), 'utf8');
  const componentWxss = fs.readFileSync(path.join(__dirname, '../components/snowlit-toast/index.wxss'), 'utf8');
  const componentJs = fs.readFileSync(path.join(__dirname, '../components/snowlit-toast/index.js'), 'utf8');
  assert.equal(componentWxml.includes('snowlit-toast-card--{{type}}'), true);
  assert.equal(componentWxss.includes('border-radius: 16rpx;'), true);
  assert.match(componentWxss, /\.snowlit-toast-host\s*\{[\s\S]*opacity:\s*0;[\s\S]*transition:\s*opacity 520ms ease;/);
  assert.match(componentWxss, /\.snowlit-toast-host--visible\s*\{[\s\S]*opacity:\s*1;/);
  assert.equal(componentWxss.includes('translateY('), false);
  assert.equal(componentJs.includes('}, 560);'), true);
  assert.equal(componentWxss.includes('@keyframes snowlit-toast-spin'), true);
}

function runPageUsageTest() {
  const pageFiles = fs.readdirSync(path.join(__dirname, '../pages'))
    .map((page) => path.join(__dirname, '../pages', page, 'index.js'))
    .filter((file) => fs.existsSync(file));

  pageFiles.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(source.includes('wx.showToast'), false, `${file} should use utils/notify`);
  });
}

runComponentDispatchTest();
runFallbackTest();
runLegacyOptionsTest();
runMountingTest();
runPageUsageTest();

console.log('notify tests passed');
