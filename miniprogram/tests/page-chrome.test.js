const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readWxss(page) {
  return fs.readFileSync(path.join(__dirname, `../pages/${page}/index.wxss`), 'utf8');
}

function readWxml(page) {
  return fs.readFileSync(path.join(__dirname, `../pages/${page}/index.wxml`), 'utf8');
}

function readJson(page) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, `../pages/${page}/index.json`), 'utf8'));
}

function readJs(page) {
  return fs.readFileSync(path.join(__dirname, `../pages/${page}/index.js`), 'utf8');
}

function readAppWxss() {
  return fs.readFileSync(path.join(__dirname, '../app.wxss'), 'utf8');
}

function readAsset(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${selector} should exist`);
  return match[0];
}

function assertBackChrome(page, actionSelector) {
  const css = readWxss(page);
  const actionRule = rule(css, actionSelector);
  const backRule = rule(css, '.back-button');
  const iconRule = rule(css, '.back-icon');

  assert.match(actionRule, /width:\s*120rpx;/, `${page} top action width`);
  assert.match(actionRule, /height:\s*146rpx;/, `${page} top action height`);
  assert.match(backRule, /top:\s*94rpx;/, `${page} back top`);
  assert.match(backRule, /left:\s*38rpx;/, `${page} back left`);
  assert.match(backRule, /width:\s*44rpx;/, `${page} back width`);
  assert.match(backRule, /height:\s*44rpx;/, `${page} back height`);
  assert.match(iconRule, /top:\s*7rpx;/, `${page} icon top`);
  assert.match(iconRule, /left:\s*4rpx;/, `${page} icon left`);
  assert.match(iconRule, /width:\s*34rpx;/, `${page} icon width`);
  assert.match(iconRule, /height:\s*34rpx;/, `${page} icon height`);
}

function runPageLevelSeparationTest() {
  const firstLevelPages = ['index', 'diary', 'albums', 'wishes', 'profile'];
  const firstLevelHeadingPages = ['index', 'diary', 'albums', 'wishes'];
  const secondLevelPages = ['story', 'story-detail', 'story-edit', 'diary-detail', 'diary-edit', 'album-detail', 'album-edit', 'wish-detail', 'wish-edit', 'profile-edit', 'feedback'];
  const secondLevelHeadingPages = ['story-detail', 'diary-detail', 'album-detail', 'wish-detail', 'feedback'];

  firstLevelPages.forEach((page) => {
    const wxml = readWxml(page);
    assert.equal(wxml.includes('snowlit-tab-page'), true, `${page} should use first-level tab shell`);
    assert.equal(wxml.includes('snowlit-subpage-heading'), false, `${page} should not use secondary heading`);
    assert.equal(wxml.includes('back-button'), false, `${page} should not render secondary back button`);
    assert.equal(wxml.includes('top-action'), false, `${page} should not render secondary top action`);
  });

  firstLevelHeadingPages.forEach((page) => {
    const wxml = readWxml(page);
    assert.equal(wxml.includes('snowlit-page-heading'), true, `${page} should use first-level heading`);
  });

  ['index', 'diary', 'albums', 'wishes'].forEach((page) => {
    assert.equal(readWxml(page).includes('snowlit-page-brand'), true, `${page} should keep first-level brand`);
  });
  assert.equal(readWxml('profile').includes('snowlit-page-heading'), false, 'profile should not render title heading');
  assert.equal(readWxml('login').includes('login-brand'), false, 'login should not render uppercase brand');

  secondLevelPages.forEach((page) => {
    const wxml = readWxml(page);
    assert.equal(wxml.includes('snowlit-tab-page'), false, `${page} should not use first-level tab shell`);
    assert.equal(wxml.includes('back-button'), true, `${page} should render secondary back button`);
  });

  secondLevelHeadingPages.forEach((page) => {
    const wxml = readWxml(page);
    assert.equal(wxml.includes('snowlit-subpage-heading'), true, `${page} should use secondary heading`);
    assert.equal(wxml.includes('snowlit-page-heading'), false, `${page} should not use first-level heading`);
  });
}

function runBackChromeTest() {
  assertBackChrome('story', '.top-action');
  assertBackChrome('story-detail', '.top-action');
  assertBackChrome('story-edit', '.story-edit-top');
  assertBackChrome('diary-detail', '.top-action');
  assertBackChrome('diary-edit', '.diary-edit-top');
  assertBackChrome('album-detail', '.top-action');
  assertBackChrome('album-edit', '.album-edit-top');
  assertBackChrome('wish-detail', '.top-action');
  assertBackChrome('wish-edit', '.wish-edit-top');
  assertBackChrome('profile-edit', '.profile-edit-top');
  assertBackChrome('feedback', '.top-action');
}

function runContentStartTest() {
  const storyEditCss = readWxss('story-edit');
  const storyDetailCss = readWxss('story-detail');
  const diaryDetailCss = readWxss('diary-detail');
  const diaryEditCss = readWxss('diary-edit');
  const albumDetailCss = readWxss('album-detail');
  const albumEditCss = readWxss('album-edit');
  const wishDetailCss = readWxss('wish-detail');
  const wishEditCss = readWxss('wish-edit');
  const profileEditCss = readWxss('profile-edit');
  const feedbackCss = readWxss('feedback');

  assert.match(rule(storyEditCss, '.edit-section--basic'), /padding-top:\s*183rpx;/);
  assert.match(rule(storyDetailCss, '.story-head'), /padding-top:\s*183rpx;/);
  assert.match(rule(diaryDetailCss, '.diary-head'), /padding-top:\s*183rpx;/);
  assert.match(rule(diaryEditCss, '.diary-edit-basic'), /padding-top:\s*183rpx;/);
  assert.match(rule(albumDetailCss, '.album-head'), /padding-top:\s*183rpx;/);
  assert.match(rule(albumDetailCss, '.album-locked'), /padding-top:\s*183rpx;/);
  assert.match(rule(albumEditCss, '.album-edit-basic'), /padding-top:\s*183rpx;/);
  assert.match(rule(wishDetailCss, '.wish-head'), /padding-top:\s*183rpx;/);
  assert.match(rule(wishEditCss, '.wish-edit-basic'), /padding-top:\s*183rpx;/);
  assert.match(rule(profileEditCss, '.profile-preview'), /padding-top:\s*183rpx;/);
  assert.match(rule(feedbackCss, '.feedback-head'), /padding-top:\s*183rpx;/);
}

function runLoginLinkStyleTest() {
  const loginCss = readWxss('login');
  const publicLinkRule = rule(loginCss, '.public-link');
  const publicLinkHoverRule = rule(loginCss, '.public-link--hover');

  assert.match(publicLinkRule, /text-decoration:\s*underline;/);
  assert.match(publicLinkRule, /text-underline-offset:\s*8rpx;/);
  assert.doesNotMatch(publicLinkRule, /border-bottom:/);
  assert.doesNotMatch(publicLinkHoverRule, /border-bottom/);
}

function runTabbarIconStyleTest() {
  const homeActiveSvg = readAsset('assets/icons/tabbar/home-active.svg');

  assert.match(homeActiveSvg, /stroke="#111111"/);
  assert.doesNotMatch(homeActiveSvg, /fill="#111111"/);
}

function runScrollablePageEndTipTest() {
  const appCss = readAppWxss();
  const scrollablePages = [
    'index',
    'diary',
    'diary-detail',
    'diary-edit',
    'story',
    'story-detail',
    'story-edit',
    'albums',
    'album-detail',
    'album-edit',
    'wishes',
    'wish-detail',
    'wish-edit',
    'profile-edit',
    'profile',
    'feedback'
  ];

  assert.match(rule(appCss, '.snowlit-end-tip'), /text-align:\s*center;/);
  assert.match(rule(appCss, '.snowlit-end-tip'), /font-size:\s*24rpx;/);
  assert.match(rule(appCss, '.snowlit-end-tip--compact'), /margin-top:\s*32rpx;/);

  scrollablePages.forEach((page) => {
    const wxml = readWxml(page);
    assert.equal(wxml.includes('snowlit-end-tip'), true, `${page} should render end tip`);
    assert.equal(wxml.includes('没有更多了哦~'), true, `${page} should render unified end text`);
  });
  assert.equal(readWxml('login').includes('snowlit-end-tip'), false, 'login should not render scroll end tip');
  assert.equal(readWxml('wishes').includes('没有更多了</view>'), false, 'wishes should not keep old end text');
}

function runProfileUpdatedLinePlacementTest() {
  const wxml = readWxml('profile');
  const css = readWxss('profile');
  const actionIndex = wxml.indexOf('class="list-card action-card"');
  const updatedIndex = wxml.indexOf('class="updated-line"');
  const endTipIndex = wxml.indexOf('class="snowlit-end-tip"');

  assert.notEqual(actionIndex, -1, 'profile should render action card before footer metadata');
  assert.notEqual(updatedIndex, -1, 'profile should render updated line');
  assert.notEqual(endTipIndex, -1, 'profile should render end tip');
  assert.equal(updatedIndex > actionIndex, true, 'profile updated line should move below action card');
  assert.equal(updatedIndex < endTipIndex, true, 'profile updated line should sit above end tip');
  assert.match(rule(css, '.updated-line'), /text-align:\s*center;/, 'profile updated line should be centered');
}

function runProfileHeaderRoleBadgeRemovedTest() {
  const wxml = readWxml('profile');
  const css = readWxss('profile');

  assert.equal(wxml.includes('class="role-badge"'), false, 'profile header should not render role badge');
  assert.equal(wxml.includes('user.coupleRoleLabel'), false, 'profile header should not render role label text');
  assert.equal(css.includes('.role-badge'), false, 'profile should not keep unused role badge styles');
}

function runReadablePagePullDownRefreshTest() {
  const readablePages = [
    'index',
    'diary',
    'diary-detail',
    'story-detail',
    'albums',
    'album-detail',
    'wishes',
    'wish-detail',
    'profile'
  ];

  readablePages.forEach((page) => {
    const json = readJson(page);
    const js = readJs(page);

    assert.equal(json.enablePullDownRefresh, true, `${page} should enable pull-down refresh`);
    assert.match(js, /onPullDownRefresh\(\)/, `${page} should implement pull-down refresh`);
    assert.equal(js.includes('wx.stopPullDownRefresh'), true, `${page} should stop pull-down refresh`);
  });
}

runPageLevelSeparationTest();
runBackChromeTest();
runContentStartTest();
runLoginLinkStyleTest();
runTabbarIconStyleTest();
runScrollablePageEndTipTest();
runProfileUpdatedLinePlacementTest();
runProfileHeaderRoleBadgeRemovedTest();
runReadablePagePullDownRefreshTest();

console.log('page chrome tests passed');
