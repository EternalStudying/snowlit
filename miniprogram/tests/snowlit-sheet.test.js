const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function assertExists(file) {
  assert.equal(fs.existsSync(path.join(__dirname, '..', file)), true, `${file} should exist`);
}

function runRegistrationTest() {
  const appJson = JSON.parse(read('app.json'));

  assert.equal(appJson.usingComponents['snowlit-option-sheet'], 'components/snowlit-option-sheet/index');
  assert.equal(appJson.usingComponents['snowlit-date-sheet'], 'components/snowlit-date-sheet/index');
  assert.equal(appJson.usingComponents['snowlit-time-sheet'], 'components/snowlit-time-sheet/index');
}

function runComponentFilesTest() {
  assertExists('components/snowlit-sheet.wxss');
  ['snowlit-option-sheet', 'snowlit-date-sheet', 'snowlit-time-sheet'].forEach((name) => {
    ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
      assertExists(`components/${name}/index.${ext}`);
    });
  });
}

function runComponentMarkupTest() {
  const optionWxml = read('components/snowlit-option-sheet/index.wxml');
  const dateWxml = read('components/snowlit-date-sheet/index.wxml');
  const timeWxml = read('components/snowlit-time-sheet/index.wxml');
  const optionWxss = read('components/snowlit-option-sheet/index.wxss');
  const dateWxss = read('components/snowlit-date-sheet/index.wxss');
  const timeWxss = read('components/snowlit-time-sheet/index.wxss');
  const commonWxss = read('components/snowlit-sheet.wxss');

  assert.match(optionWxml, /class="snowlit-sheet-mask/);
  assert.match(optionWxml, /wx:for="\{\{options\}\}"/);
  assert.match(optionWxml, /bindtap="handleOptionTap"/);
  assert.match(dateWxml, /<picker-view/);
  assert.match(dateWxml, /bindchange="handleChange"/);
  assert.match(dateWxml, /bindtap="handleConfirm"/);
  assert.match(timeWxml, /<picker-view/);
  assert.match(timeWxml, /bindchange="handleChange"/);
  assert.match(timeWxml, /bindtap="handleConfirm"/);
  assert.match(optionWxss, /@import "\.\.\/snowlit-sheet\.wxss";/);
  assert.match(dateWxss, /@import "\.\.\/snowlit-sheet\.wxss";/);
  assert.match(timeWxss, /@import "\.\.\/snowlit-sheet\.wxss";/);
  assert.match(commonWxss, /position:\s*fixed;/);
  assert.match(commonWxss, /bottom:\s*0;/);
  assert.match(commonWxss, /transform:\s*translateY\(100%\);/);
  assert.match(commonWxss, /snowlit-sheet-mask--visible/);
}

function runNoNativePickerTest() {
  const pages = JSON.parse(read('app.json')).pages;

  pages.forEach((page) => {
    const wxml = read(`${page}.wxml`);
    assert.equal(/<picker(\s|>)/.test(wxml), false, `${page} should use Snowlit sheet instead of native picker`);
  });
}

function runWishEditUsageTest() {
  const wxml = read('pages/wish-edit/index.wxml');
  const js = read('pages/wish-edit/index.js');

  assert.match(wxml, /bindtap="openCategorySheet"/);
  assert.match(wxml, /bindtap="openDateSheet"/);
  assert.match(wxml, /<snowlit-option-sheet/);
  assert.match(wxml, /<snowlit-date-sheet/);
  assert.match(js, /openCategorySheet/);
  assert.match(js, /selectCategoryFromSheet/);
  assert.match(js, /openDateSheet/);
  assert.match(js, /confirmDateFromSheet/);
}

function runDiaryEditUsageTest() {
  const wxml = read('pages/diary-edit/index.wxml');
  const js = read('pages/diary-edit/index.js');

  assert.match(wxml, /bindtap="openDiaryDateSheet"/);
  assert.match(wxml, /<snowlit-date-sheet/);
  assert.match(js, /openDiaryDateSheet/);
  assert.match(js, /confirmDiaryDateFromSheet/);
}

function runStoryEditUsageTest() {
  const wxml = read('pages/story-edit/index.wxml');
  const js = read('pages/story-edit/index.js');

  assert.match(wxml, /bindtap="openStoryDateSheet"/);
  assert.match(wxml, /bindtap="openStoryTimeSheet"/);
  assert.match(wxml, /<snowlit-date-sheet/);
  assert.match(wxml, /<snowlit-time-sheet/);
  assert.match(js, /openStoryDateSheet/);
  assert.match(js, /confirmStoryDateFromSheet/);
  assert.match(js, /openStoryTimeSheet/);
  assert.match(js, /confirmStoryTimeFromSheet/);
}

function runAlbumEditUsageTest() {
  const wxml = read('pages/album-edit/index.wxml');
  const js = read('pages/album-edit/index.js');

  assert.match(wxml, /bindtap="openVisibilitySheet"/);
  assert.match(wxml, /bindtap="openDateSheet"/);
  assert.match(wxml, /<snowlit-option-sheet/);
  assert.match(wxml, /<snowlit-date-sheet/);
  assert.match(js, /openVisibilitySheet/);
  assert.match(js, /selectVisibilityFromSheet/);
  assert.match(js, /openDateSheet/);
  assert.match(js, /confirmDateFromSheet/);
}

runRegistrationTest();
runComponentFilesTest();
runComponentMarkupTest();
runNoNativePickerTest();
runWishEditUsageTest();
runDiaryEditUsageTest();
runStoryEditUsageTest();
runAlbumEditUsageTest();

console.log('snowlit sheet tests passed');
