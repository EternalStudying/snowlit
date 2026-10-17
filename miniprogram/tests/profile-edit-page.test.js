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

  assert.equal(ROUTES.PROFILE_EDIT, 'pages/profile-edit/index');
  assert.equal(appJson.pages.includes('pages/profile-edit/index'), true);
}

function runFileTest() {
  ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
    const file = path.join(__dirname, `../pages/profile-edit/index.${ext}`);
    assert.equal(fs.existsSync(file), true, `profile-edit index.${ext} should exist`);
  });
}

function runEntryTest() {
  const profileJs = read('pages/profile/index.js');

  assert.match(profileJs, /ROUTES\.PROFILE_EDIT/);
  assert.match(profileJs, /wx\.navigateTo/);
  assert.doesNotMatch(profileJs, /资料编辑稍后接入/);
}

function runStructureTest() {
  const wxml = read('pages/profile-edit/index.wxml');
  const js = read('pages/profile-edit/index.js');

  assert.equal(wxml.includes('资料编辑'), false);
  assert.equal(wxml.includes('snowlit-page-heading'), false);
  assert.equal(wxml.includes('snowlit-subpage-heading'), false);
  assert.match(wxml, /class="profile-edit-page"/);
  assert.match(wxml, /class="profile-edit-top"/);
  assert.match(wxml, /class="back-button" bindtap="goBack"/);
  assert.match(wxml, /class="profile-preview"/);
  assert.match(wxml, /class="profile-avatar"/);
  assert.match(wxml, /\{\{user\.initial\}\}/);
  assert.match(wxml, /class="profile-name"/);
  assert.match(wxml, /\{\{form\.displayName\}\}/);
  assert.match(wxml, /class="profile-username"/);
  assert.match(wxml, /@\{\{user\.username\}\}/);
  assert.match(wxml, /class="role-badge"/);
  assert.match(wxml, /\{\{user\.coupleRoleLabel\}\}/);
  assert.match(wxml, />PROFILE</);
  assert.match(wxml, />昵称</);
  assert.match(wxml, /maxlength="20"/);
  assert.match(wxml, /\{\{form\.displayName\.length\}\}\/20/);
  assert.match(wxml, />心情</);
  assert.match(wxml, /\{\{form\.mood\.length\}\}\/20/);
  assert.match(wxml, />简介</);
  assert.match(wxml, /class="form-textarea"/);
  assert.match(wxml, /maxlength="80"/);
  assert.match(wxml, /\{\{form\.bio\.length\}\}\/80/);
  assert.match(wxml, />账号</);
  assert.match(wxml, /class="form-input form-input--readonly"/);
  assert.match(wxml, />保存资料</);
  assert.match(wxml, />取消</);
  assert.match(wxml, /snowlit-toast/);
  assert.match(wxml, /snowlit-dialog/);

  assert.match(js, /getStoredUser/);
  assert.match(js, /setStoredUser/);
  assert.match(js, /updateProfile/);
  assert.match(js, /mapCurrentUser/);
  assert.doesNotMatch(js, /profileRoleLabel/);
  assert.doesNotMatch(js, /男朋友|女朋友/);
  assert.match(js, /handleDisplayNameInput/);
  assert.match(js, /handleMoodInput/);
  assert.match(js, /handleBioInput/);
  assert.match(js, /saveProfile/);
  assert.match(js, /资料已保存/);
  assert.doesNotMatch(js, /资料保存接口稍后接入/);
}

function runProportionTest() {
  const css = read('pages/profile-edit/index.wxss');

  assert.match(rule(css, '.profile-edit-page'), /background:\s*#fbfbfb;/);
  assert.match(rule(css, '.profile-edit-page'), /padding:\s*0 34rpx/);
  assert.match(rule(css, '.profile-edit-top'), /width:\s*120rpx;/);
  assert.match(rule(css, '.profile-edit-top'), /height:\s*146rpx;/);
  assert.match(rule(css, '.back-button'), /top:\s*94rpx;/);
  assert.match(rule(css, '.profile-preview'), /padding-top:\s*183rpx;/);
  assert.match(rule(css, '.profile-preview'), /grid-template-columns:\s*182rpx minmax\(0, 1fr\);/);
  assert.match(rule(css, '.profile-avatar'), /width:\s*162rpx;/);
  assert.match(rule(css, '.profile-avatar'), /height:\s*162rpx;/);
  assert.match(rule(css, '.profile-name'), /font-size:\s*42rpx;/);
  assert.match(rule(css, '.profile-username'), /font-size:\s*26rpx;/);
  assert.match(rule(css, '.role-badge'), /min-width:\s*178rpx;/);
  assert.match(rule(css, '.role-badge'), /border-radius:\s*999rpx;/);
  assert.match(rule(css, '.role-badge'), /letter-spacing:\s*5rpx;/);
  assert.match(rule(css, '.section-label'), /font-size:\s*20rpx;/);
  assert.match(rule(css, '.profile-form-card'), /border:\s*1rpx solid #dedede;/);
  assert.match(rule(css, '.profile-form-card'), /border-radius:\s*8rpx;/);
  assert.match(rule(css, '.form-row'), /grid-template-columns:\s*126rpx minmax\(0, 1fr\) 84rpx;/);
  assert.match(rule(css, '.form-row'), /min-height:\s*120rpx;/);
  assert.match(rule(css, '.form-row--bio'), /min-height:\s*284rpx;/);
  assert.match(rule(css, '.form-label'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.form-input'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.form-textarea'), /min-height:\s*214rpx;/);
  assert.match(rule(css, '.profile-edit-footer'), /position:\s*fixed;/);
  assert.match(rule(css, '.save-button'), /height:\s*80rpx;/);
  assert.match(rule(css, '.save-button'), /font-size:\s*29rpx;/);
  assert.match(rule(css, '.cancel-button'), /font-size:\s*29rpx;/);
}

runRouteTest();
runFileTest();
runEntryTest();
runStructureTest();
runProportionTest();

console.log('profile-edit page tests passed');
