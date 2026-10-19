const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadPrivacyFresh() {
  const modulePath = path.join(__dirname, '../utils/privacy.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

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

async function runComponentDispatchTest() {
  const calls = [];

  await withGlobals({
    wx: {},
    getCurrentPages() {
      return [
        {
          selectComponent(selector) {
            assert.equal(selector, '#snowlit-privacy');
            return {
              authorize(options) {
                calls.push(options);
                return Promise.resolve(true);
              }
            };
          }
        }
      ];
    }
  }, async () => {
    const { authorizePrivacy } = loadPrivacyFresh();
    const result = await authorizePrivacy({
      title: '使用位置',
      message: '用于更新首页天气'
    });
    assert.equal(result, true);
    assert.deepEqual(calls[0], {
      title: '使用位置',
      message: '用于更新首页天气'
    });
  });
}

async function runNoAuthorizationNeededTest() {
  await withGlobals({
    wx: {
      getPrivacySetting(options) {
        options.success({
          needAuthorization: false,
          privacyContractName: 'Snowlit 用户隐私保护指引'
        });
      }
    },
    getCurrentPages() {
      return [
        {
          selectComponent() {
            return null;
          }
        }
      ];
    }
  }, async () => {
    const { authorizePrivacy } = loadPrivacyFresh();
    const result = await authorizePrivacy();
    assert.equal(result, true);
  });
}

function runMountingTest() {
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.equal(appJson.usingComponents['snowlit-privacy'], 'components/snowlit-privacy/index');

  [
    'pages/index/index',
    'pages/story-edit/index',
    'pages/diary-edit/index',
    'pages/album-edit/index',
    'pages/wishes/index',
    'pages/wish-detail/index',
    'pages/feedback/index'
  ].forEach((page) => {
    const wxml = fs.readFileSync(path.join(__dirname, `../${page}.wxml`), 'utf8');
    assert.equal(wxml.includes('<snowlit-privacy id="snowlit-privacy" />'), true, `${page} should mount snowlit-privacy`);
  });

  const componentWxml = fs.readFileSync(path.join(__dirname, '../components/snowlit-privacy/index.wxml'), 'utf8');
  assert.equal(componentWxml.includes('open-type="agreePrivacyAuthorization"'), true);
  assert.equal(componentWxml.includes('bindagreeprivacyauthorization="handleAgree"'), true);
}

function runPageUsageTest() {
  const indexJs = fs.readFileSync(path.join(__dirname, '../pages/index/index.js'), 'utf8');
  const storyEditJs = fs.readFileSync(path.join(__dirname, '../pages/story-edit/index.js'), 'utf8');
  const diaryEditJs = fs.readFileSync(path.join(__dirname, '../pages/diary-edit/index.js'), 'utf8');
  const albumEditJs = fs.readFileSync(path.join(__dirname, '../pages/album-edit/index.js'), 'utf8');
  const feedbackJs = fs.readFileSync(path.join(__dirname, '../pages/feedback/index.js'), 'utf8');
  const wishCompletionJs = fs.readFileSync(path.join(__dirname, '../components/wish-completion-sheet/index.js'), 'utf8');

  assert.equal(indexJs.includes("require('../../utils/privacy')"), true);
  assert.match(indexJs, /authorizePrivacy\([\s\S]*updateCurrentLocation/);
  const pickerJs = fs.readFileSync(path.join(__dirname, '../utils/image-picker.js'), 'utf8');
  assert.match(pickerJs, /authorizePrivacy\([\s\S]*wx\.chooseMedia/);
  [storyEditJs, diaryEditJs, albumEditJs, wishCompletionJs, feedbackJs].forEach((source) => {
    assert.equal(source.includes('wx.chooseMedia'), false);
    assert.match(source, /pickImages\(/);
  });
}

Promise.resolve()
  .then(runComponentDispatchTest)
  .then(runNoAuthorizationNeededTest)
  .then(runMountingTest)
  .then(runPageUsageTest)
  .then(() => {
    console.log('privacy tests passed');
  });
