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

  assert.equal(ROUTES.ALBUM_EDIT, 'pages/album-edit/index');
  assert.equal(appJson.pages.includes('pages/album-edit/index'), true);
}

function runFileTest() {
  ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
    const file = path.join(__dirname, `../pages/album-edit/index.${ext}`);
    assert.equal(fs.existsSync(file), true, `index.${ext} should exist`);
  });
  assert.equal(fs.existsSync(path.join(__dirname, '../assets/icons/albums/pin.svg')), true);
}

function runStructureTest() {
  const wxml = read('pages/album-edit/index.wxml');
  const js = read('pages/album-edit/index.js');
  const presenter = read('pages/album-edit/album-edit-presenter.js');
  const albumsJs = read('pages/albums/index.js');

  assert.equal(js.includes("require('../../services/draft')"), true);
  assert.match(js, /removeDraftImage/);
  assert.match(js, /createDraftAutosave/);
  assert.match(js, /loadDraft/);
  assert.match(js, /uploadDraftImage/);
  assert.match(js, /publishDraft/);
  assert.match(js, /loadDraft/);
  assert.match(js, /album-edit-presenter/);
  assert.equal(wxml.includes('snowlit-page-heading'), false);
  assert.equal(wxml.includes('snowlit-subpage-heading'), false);
  assert.equal(wxml.includes('SNOWLIT'), false);
  assert.match(wxml, /class="album-edit-page"/);
  assert.match(wxml, /class="album-edit-top"/);
  assert.match(wxml, /class="album-edit-section album-edit-basic"/);
  assert.match(wxml, />基本信息</);
  assert.match(wxml, /class="basic-card"/);
  assert.match(wxml, />标题</);
  assert.match(wxml, /class="required-star"/);
  assert.match(wxml, /placeholder="给相册起个名字"/);
  assert.match(wxml, />可见范围</);
  assert.match(wxml, /bindtap="openVisibilitySheet"/);
  assert.match(wxml, /class="visibility-pill"/);
  assert.match(wxml, /\{\{form\.visibilityText\}\}/);
  assert.match(presenter, /label:\s*'公开'/);
  assert.match(presenter, /label:\s*'私密'/);
  assert.doesNotMatch(wxml, /visibility-switch/);
  assert.match(wxml, />私密密码</);
  assert.match(wxml, /wx:if="\{\{form\.visibility === 'private'\}\}"/);
  assert.match(wxml, />置顶</);
  assert.match(wxml, /class="pin-switch/);
  assert.match(wxml, />日期</);
  assert.match(wxml, /\{\{form\.eventDateText\}\}/);
  assert.match(wxml, />地点</);
  assert.match(wxml, /placeholder="写下拍摄地点"/);
  assert.match(wxml, />描述</);
  assert.match(wxml, /class="details-textarea"/);
  assert.match(wxml, /placeholder="把这组照片的故事轻轻写下"/);
  assert.match(wxml, />照片</);
  assert.match(wxml, />最多 \{\{maxAlbumPhotos\}\} 张</);
  assert.match(wxml, /bindtap="choosePhotos"/);
  assert.match(wxml, />添加照片</);
  assert.match(wxml, /class="album-edit-footer"/);
  assert.match(wxml, />取消</);
  assert.match(wxml, /保存相册/);
  assert.match(wxml, /<snowlit-date-sheet/);
  assert.match(wxml, /<snowlit-option-sheet/);
  assert.match(wxml, /snowlit-privacy/);
  assert.match(wxml, /snowlit-toast/);
  assert.match(js, /openVisibilitySheet/);
  assert.match(js, /selectVisibilityFromSheet/);
  assert.match(js, /openDateSheet/);
  assert.match(js, /confirmDateFromSheet/);
  assert.match(js, /choosePhotos/);
  assert.match(js, /uploadPhotos/);






  assert.match(js, /refreshAlbumPages/);
  assert.doesNotMatch(js, /ALBUM_DRAFT_EXISTS|cleanupDraft|handleDraftExists|resetUploadedPhotoState/);

  assert.doesNotMatch(js, /保存接口下一步接入/);
  assert.match(albumsJs, /ROUTES\.ALBUM_EDIT/);
  assert.doesNotMatch(albumsJs, /相册新增下一步接入/);
}

function runProportionTest() {
  const css = read('pages/album-edit/index.wxss');

  assert.match(rule(css, '.album-edit-page'), /background:\s*#f3f6fa;/);
  assert.match(rule(css, '.album-edit-page'), /padding:\s*0 34rpx/);
  assert.match(rule(css, '.album-edit-basic'), /padding-top:\s*183rpx;/);
  assert.match(rule(css, '.section-label'), /font-size:\s*24rpx;/);
  assert.match(rule(css, '.basic-card'), /border:\s*1rpx solid #dce2ea;/);
  assert.match(rule(css, '.basic-card'), /border-radius:\s*8rpx;/);
  assert.match(rule(css, '.basic-row'), /min-height:\s*84rpx;/);
  assert.match(rule(css, '.basic-label'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.basic-input'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.visibility-pill'), /font-size:\s*29rpx;/);
  assert.doesNotMatch(css, /\.visibility-switch/);
  assert.doesNotMatch(css, /\.visibility-option/);
  assert.match(rule(css, '.pin-switch'), /width:\s*94rpx;/);
  assert.match(rule(css, '.details-panel'), /min-height:\s*210rpx;/);
  assert.match(rule(css, '.details-textarea'), /font-size:\s*29rpx;/);
  assert.match(read('components/snowlit-sortable-grid/index.wxml'), /grid-template-columns: repeat/);
  assert.match(rule(css, '.photo-add'), /aspect-ratio:\s*1 \/ 1;/);
  assert.match(rule(read('components/snowlit-sortable-grid/index.wxss'), '.sortable-item'), /aspect-ratio:\s*1 \/ 1;/);
  assert.match(rule(css, '.album-edit-footer'), /position:\s*fixed;/);
  assert.match(rule(css, '.cancel-button'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.save-button'), /font-size:\s*29rpx;/);
}

runRouteTest();
runFileTest();
runStructureTest();
runProportionTest();

console.log('album-edit page tests passed');
