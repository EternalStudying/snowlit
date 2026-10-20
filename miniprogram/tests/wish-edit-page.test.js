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

  assert.equal(ROUTES.WISH_EDIT, 'pages/wish-edit/index');
  assert.equal(appJson.pages.includes('pages/wish-edit/index'), true);
  assert.equal(appJson.usingComponents['wish-completion-sheet'], 'components/wish-completion-sheet/index');
}

function runFileTest() {
  ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
    const file = path.join(__dirname, `../pages/wish-edit/index.${ext}`);
    assert.equal(fs.existsSync(file), true, `index.${ext} should exist`);
  });
}

function runStructureTest() {
  const wxml = read('pages/wish-edit/index.wxml');
  const js = read('pages/wish-edit/index.js');

  assert.equal(wxml.includes('snowlit-page-heading'), false);
  assert.equal(wxml.includes('snowlit-subpage-heading'), false);
  assert.equal(wxml.includes('SNOWLIT'), false);
  assert.match(wxml, /class="wish-edit-page"/);
  assert.match(wxml, /class="wish-edit-top"/);
  assert.match(wxml, /class="wish-edit-section wish-edit-basic"/);
  assert.match(wxml, />基本信息</);
  assert.match(wxml, /class="basic-card"/);
  assert.ok(
    wxml.indexOf('>标题</') < wxml.indexOf('>类型</'),
    'title row should appear before category row'
  );
  assert.match(wxml, />类型</);
  assert.match(wxml, /\{\{form\.categoryText\}\}/);
  assert.match(wxml, />标题</);
  assert.match(wxml, /class="required-star"/);
  assert.match(wxml, /placeholder="想写下一个小愿望"/);
  assert.match(wxml, />预计时间</);
  assert.match(wxml, /\{\{form\.expectedDateText\}\}/);
  assert.match(wxml, />预计地点</);
  assert.match(wxml, /placeholder="想写下预计去哪里"/);
  assert.match(wxml, />描述</);
  assert.match(wxml, /class="details-textarea"/);
  assert.match(wxml, /placeholder="把想法轻轻写下"/);
  assert.match(wxml, />备注</);
  assert.match(wxml, /class="note-textarea"/);
  assert.match(wxml, /placeholder="写一点只有你们懂的小备注"/);
  assert.match(wxml, /class="wish-edit-footer"/);
  assert.match(wxml, />取消</);
  assert.match(wxml, /\{\{editing \? '保存修改' : '保存清单'\}\}/);
  assert.match(wxml, /snowlit-toast/);
  assert.equal(wxml.includes('STATUS'), false);
  assert.equal(wxml.includes('添加图片'), false);
  assert.equal(wxml.includes('chooseMedia'), false);
  assert.match(js, /createWish/);
  assert.match(js, /updateWish/);
  assert.match(js, /getWishDetail/);
  assert.match(js, /buildWishCreatePayload/);
  assert.match(js, /createWishFormFromDetail/);
  assert.match(js, /小愿望已经贴到清单上啦/);
  assert.match(js, /小愿望已经认真改好啦/);

  const detailWxml = read('pages/wish-detail/index.wxml');
  const detailJs = read('pages/wish-detail/index.js');
  const detailCss = read('pages/wish-detail/index.wxss');
  assert.match(detailWxml, /class="detail-actions"/);
  assert.match(detailWxml, /wx:if="\{\{wish\.canEdit\}\}"/);
  assert.match(detailWxml, /bindtap="editWish"/);
  assert.match(detailWxml, /bindtap="deleteWish"/);
  assert.match(detailWxml, /bindtap="toggleWishStatus"/);
  assert.match(detailWxml, /wish-completion-sheet/);
  assert.match(detailWxml, /bindconfirm="confirmCompleteWish"/);
  assert.match(detailWxml, /bindcancel="closeCompletionSheet"/);
  assert.match(detailWxml, /\{\{statusSubmitting \? '处理中...' : wish\.statusActionText\}\}/);
  assert.match(detailJs, /deleteWish/);
  assert.match(detailJs, /completeWish/);
  assert.match(detailJs, /reopenWish/);
  assert.match(detailJs, /openCompletionSheet/);
  assert.match(detailJs, /confirmCompleteWish/);
  assert.match(detailJs, /showConfirm/);
  assert.match(detailJs, /ROUTES\.WISH_EDIT/);
  assert.match(rule(detailCss, '.detail-actions'), /grid-template-columns:\s*1fr 1fr 1\.4fr;/);
  assert.match(rule(detailCss, '.detail-action--delete'), /color:\s*#a05a5a;/);
  assert.match(rule(detailCss, '.detail-action--primary'), /background:\s*#1d2433;/);

  const wishesWxml = read('pages/wishes/index.wxml');
  const wishesJs = read('pages/wishes/index.js');
  const wishesCss = read('pages/wishes/index.wxss');
  assert.match(wishesWxml, /class="wish-add"/);
  assert.match(wishesWxml, /wx:if="\{\{canManage\}\}"/);
  assert.match(wishesWxml, /bindtap="goCreate"/);
  const pendingWishesWxml = wishesWxml.split('<view class="done-section">')[0];
  assert.equal(pendingWishesWxml.includes('class="wish-photo-wrap"'), false);
  assert.equal(pendingWishesWxml.includes('class="wish-photo"'), false);
  assert.equal(pendingWishesWxml.includes('src="{{item.image}}"'), false);
  assert.match(pendingWishesWxml, /class="wish-check \{\{item\.checkClass\}\}"/);
  assert.match(pendingWishesWxml, /catchtap="completeWish"/);
  assert.match(pendingWishesWxml, /wish-row \{\{item\.stateClass\}\}/);
  assert.match(pendingWishesWxml, /wish-check \{\{item\.checkClass\}\}/);
  assert.match(wishesJs, /ROUTES\.WISH_EDIT/);
  assert.match(wishesJs, /completeWish/);
  assert.match(wishesJs, /reopenWish/);
  assert.match(wishesJs, /openCompletionSheet/);
  assert.match(wishesJs, /confirmCompleteWish/);
  assert.match(wishesJs, /setTimeout/);
  assert.match(wishesJs, /WISH_TRANSITION_MS/);
  assert.match(wishesJs, /markWishLeaving/);
  assert.match(rule(wishesCss, '.wish-add'), /bottom:\s*calc\(142rpx \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(rule(wishesCss, '.wish-row'), /grid-template-columns:\s*34rpx minmax\(0, 1fr\) auto 30rpx;/);
  assert.match(rule(wishesCss, '.wish-row'), /transition:\s*opacity 220ms ease, transform 220ms ease;/);
  assert.match(rule(wishesCss, '.wish-check'), /border:\s*3rpx solid #1d2433;/);
  assert.match(rule(wishesCss, '.wish-check'), /transition:\s*background 180ms ease, border-color 180ms ease;/);
  assert.match(rule(wishesCss, '.wish-check--done'), /background:\s*#1d2433;/);
  assert.match(rule(wishesCss, '.wish-row--leaving'), /opacity:\s*0;/);
  assert.match(rule(wishesCss, '.wish-date'), /text-align:\s*right;/);
  assert.match(rule(wishesCss, '.done-photo-wrap'), /width:\s*264rpx;/);
  assert.match(rule(wishesCss, '.done-photo-wrap'), /height:\s*165rpx;/);
  assert.match(rule(wishesCss, '.done-row'), /transition:\s*opacity 220ms ease, transform 220ms ease;/);
  assert.match(rule(wishesCss, '.done-row--leaving'), /opacity:\s*0;/);
  assert.match(wishesWxml, /catchtap="reopenWish"/);
  assert.match(wishesWxml, /wish-completion-sheet/);
  assert.match(wishesWxml, /bindconfirm="confirmCompleteWish"/);
  assert.match(wishesWxml, /bindcancel="closeCompletionSheet"/);

  const completionWxml = read('components/wish-completion-sheet/index.wxml');
  const completionJs = read('components/wish-completion-sheet/index.js');
  const completionCss = read('components/wish-completion-sheet/index.wxss');
  assert.match(completionWxml, /完成照片/);
  assert.match(completionWxml, /添加图片/);
  assert.match(completionWxml, /确认完成/);
  assert.match(completionJs, /pickImages\(/);
  assert.match(completionJs, /triggerEvent\('confirm'/);
  assert.match(rule(completionCss, '.completion-photo-box'), /border:\s*1rpx dashed #dce2ea;/);
}

function runProportionTest() {
  const css = read('pages/wish-edit/index.wxss');

  assert.match(rule(css, '.wish-edit-page'), /background:\s*#f3f6fa;/);
  assert.match(rule(css, '.wish-edit-page'), /padding:\s*0 34rpx/);
  assert.match(rule(css, '.wish-edit-basic'), /padding-top:\s*183rpx;/);
  assert.match(rule(css, '.section-label'), /font-size:\s*24rpx;/);
  assert.match(rule(css, '.basic-card'), /border:\s*1rpx solid #dce2ea;/);
  assert.match(rule(css, '.basic-card'), /border-radius:\s*8rpx;/);
  assert.match(rule(css, '.basic-row'), /min-height:\s*84rpx;/);
  assert.match(rule(css, '.basic-label'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.basic-input'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.category-pill'), /display:\s*flex;/);
  assert.match(rule(css, '.category-pill'), /align-items:\s*center;/);
  assert.match(rule(css, '.category-pill'), /justify-content:\s*center;/);
  assert.match(rule(css, '.category-pill'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.details-panel'), /min-height:\s*336rpx;/);
  assert.match(rule(css, '.details-textarea'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.wish-edit-footer'), /position:\s*fixed;/);
  assert.match(rule(css, '.cancel-button'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.save-button'), /font-size:\s*29rpx;/);
}

runRouteTest();
runFileTest();
runStructureTest();
runProportionTest();

console.log('wish-edit page tests passed');
