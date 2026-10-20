const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CURRENT_ENV, ENVIRONMENTS, config } = require('../constants/config');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const appWxss = fs.readFileSync(path.join(__dirname, '../app.wxss'), 'utf8');
const projectConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.config.json'), 'utf8'));
const projectPrivateConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.private.config.json'), 'utf8'));

assert.equal(CURRENT_ENV, 'dev');
assert.equal(config.env, 'dev');
assert.equal(ENVIRONMENTS.dev.apiBaseUrl, 'http://localhost:8080');
assert.equal(ENVIRONMENTS.dev.uploadBaseUrl, 'http://localhost:8080');
assert.equal(ENVIRONMENTS.prod.apiBaseUrl, 'https://snowlit.xyz');
assert.equal(ENVIRONMENTS.prod.uploadBaseUrl, 'https://snowlit.xyz');
assert.doesNotMatch(ENVIRONMENTS.prod.apiBaseUrl, /^http:\/\//);
assert.doesNotMatch(ENVIRONMENTS.prod.uploadBaseUrl, /^http:\/\//);
assert.equal(config.apiBaseUrl, 'http://localhost:8080');
assert.equal(config.uploadBaseUrl, 'http://localhost:8080');
assert.equal(config.fontFace, null);
assert.equal(projectConfig.setting.urlCheck, true);
assert.equal(projectConfig.setting.ignoreUploadUnusedFiles, true);
assert.equal(projectPrivateConfig.setting.urlCheck, false);
assert.equal(projectPrivateConfig.setting.ignoreUploadUnusedFiles, true);
assert.equal(appJson.lazyCodeLoading, 'requiredComponents');
assert.ok(appJson.requiredPrivateInfos.includes('getLocation'));
assert.equal(
  appJson.permission['scope.userLocation'].desc,
  '用于首页前台自动更新天气、城市和距离状态'
);
assert.equal(ENVIRONMENTS.dev.fontFace, null);
assert.equal(ENVIRONMENTS.prod.fontFace, null);
// Bundled faces are covered by fonts.test.js; the old full-text subset must not come back.
assert.doesNotMatch(appWxss, /snowlit-sans\.wxss/);
assert.doesNotMatch(appJs, /NotoSansSC-VF\.woff/);

console.log('config tests passed');
