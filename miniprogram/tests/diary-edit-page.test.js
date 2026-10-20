const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROUTES } = require('../constants/routes');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${selector} should exist`);
  return match[0];
}

function runRouteTest() {
  const appJson = JSON.parse(read('app.json'));

  assert.equal(ROUTES.DIARY_EDIT, 'pages/diary-edit/index');
  assert.equal(appJson.pages.includes('pages/diary-edit/index'), true);
}

function runFileTest() {
  ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
    const file = path.join(__dirname, `../pages/diary-edit/index.${ext}`);
    assert.equal(fs.existsSync(file), true, `index.${ext} should exist`);
  });
}

function runStructureTest() {
  const wxml = read('pages/diary-edit/index.wxml');
  const js = read('pages/diary-edit/index.js');

  assert.equal(wxml.includes('snowlit-page-heading'), false);
  assert.equal(wxml.includes('snowlit-subpage-heading'), false);
  assert.equal(wxml.includes('SNOWLIT'), false);
  assert.equal(wxml.includes('sampleImage'), false);
  assert.match(wxml, /class="diary-edit-page"/);
  assert.match(wxml, /class="diary-edit-top"/);
  assert.match(wxml, /class="diary-edit-section diary-edit-basic"/);
  assert.match(wxml, />基本信息</);
  assert.match(wxml, />标题</);
  assert.match(wxml, /class="basic-input"/);
  assert.match(wxml, /bindinput="handleTitleInput"/);
  assert.match(wxml, />日期</);
  assert.match(wxml, /wx:if="\{\{isEditing\}\}"/);
  assert.match(wxml, />心情</);
  assert.match(wxml, />可见范围</);
  assert.match(wxml, /class="visibility-switch"/);
  assert.match(wxml, />\s*共享\s*</);
  assert.match(wxml, />\s*私密\s*</);
  assert.match(wxml, />正文</);
  assert.match(wxml, /data-action="heading"/);
  assert.match(wxml, /data-action="bold"/);
  assert.match(wxml, /data-action="quote"/);
  assert.match(wxml, /data-action="list"/);
  assert.match(wxml, /data-action="image"/);
  assert.match(wxml, /<view class="toolbar" wx:if="{{mode === 'edit'}}">/);
  assert.match(wxml, /class="words-textarea"/);
  assert.equal(wxml.includes('class="inline-photo-list"'), false);
  assert.equal(wxml.includes('class="inline-photo"'), false);
  assert.equal(wxml.includes('inline-photo-status'), false);
  assert.match(wxml, /previewBlocks/);
  assert.match(wxml, /previewEmpty/);
  assert.match(wxml, /class="preview-empty"/);
  assert.match(wxml, /<rich-text nodes="\{\{item\.nodes\}\}"/);
  assert.match(wxml, /item\.type === 'quote'/);
  assert.match(wxml, /item\.type === 'list'/);
  assert.match(wxml, /item\.type === 'code'/);
  assert.match(wxml, /item\.type === 'hr'/);
  assert.match(wxml, /item\.type === 'table'/);
  assert.match(wxml, /class="preview-image/);
  assert.match(wxml, />\s*编辑\s*</);
  assert.match(wxml, />\s*预览\s*</);
  assert.match(wxml, /class="diary-edit-footer"/);
  assert.match(wxml, /loading="{{submitting}}"/);
  assert.match(wxml, /disabled="{{submitting \|\| loadingDiary}}"/);
  assert.match(wxml, />取消</);
  assert.match(wxml, /\{\{isEditing \? '保存修改' : '保存日记'\}\}/);
  assert.match(wxml, /snowlit-privacy/);
  assert.match(js, /createDiary/);
  assert.match(js, /updateDiary/);
  assert.match(js, /getDiaryDetail/);
  assert.match(js, /uploadDiaryImage/);
  assert.match(js, /buildDiaryCreatePayload/);
  assert.match(js, /buildDiaryUpdatePayload/);
  assert.match(js, /mapDiaryEditForm/);
  assert.match(js, /handleTitleInput/);
  assert.match(js, /insertDiaryImageMarkdown/);
  assert.match(js, /previewEmpty/);
  assert.match(js, /日记已经悄悄收好啦/);
  assert.match(js, /日记已经认真改好啦/);
  assert.equal(js.includes('保存接口下一步接入'), false);
  assert.equal(js.includes('图片上传下一步接入'), false);
}

function runProportionTest() {
  const css = read('pages/diary-edit/index.wxss');

  assert.match(rule(css, '.diary-edit-page'), /background:\s*#f3f6fa;/);
  assert.match(rule(css, '.diary-edit-page'), /padding:\s*0 34rpx/);
  assert.match(rule(css, '.diary-edit-basic'), /padding-top:\s*183rpx;/);
  assert.match(rule(css, '.basic-card'), /border:\s*1rpx solid #dce2ea;/);
  assert.match(rule(css, '.basic-row'), /min-height:\s*84rpx;/);
  assert.match(rule(css, '.basic-input'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.words-panel'), /min-height:\s*670rpx;/);
  assert.match(rule(css, '.toolbar'), /height:\s*84rpx;/);
  assert.match(rule(css, '.preview-body--empty'), /align-items:\s*center;/);
  assert.match(rule(css, '.preview-empty'), /text-align:\s*center;/);
  assert.match(rule(css, '.preview-empty'), /white-space:\s*nowrap;/);
  assert.match(rule(css, '.preview-quote'), /border-left:\s*5rpx solid/);
  assert.match(rule(css, '.preview-list-item'), /display:\s*flex;/);
  assert.match(rule(css, '.preview-code'), /white-space:\s*pre-wrap;/);
  assert.match(rule(css, '.preview-hr'), /border-top:\s*1rpx dashed/);
  assert.match(rule(css, '.preview-table-row'), /display:\s*flex;/);
  assert.match(rule(css, '.preview-image'), /width:\s*50%;/);
  assert.match(rule(css, '.mode-tabs'), /grid-template-columns:\s*1fr 1fr;/);
  assert.match(rule(css, '.diary-edit-footer'), /position:\s*fixed;/);
  assert.match(rule(css, '.save-button'), /background:\s*#1d2433;/);
  assert.match(rule(css, '.basic-label'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.basic-value'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.mood-pill'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.visibility-option'), /display:\s*flex;/);
  assert.match(rule(css, '.visibility-option'), /align-items:\s*center;/);
  assert.match(rule(css, '.visibility-option'), /justify-content:\s*center;/);
  assert.match(rule(css, '.visibility-option'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.words-textarea'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.mode-tab'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.cancel-button'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.save-button'), /font-size:\s*29rpx;/);
}

runRouteTest();
runFileTest();
runStructureTest();
runProportionTest();

console.log('diary-edit page tests passed');
