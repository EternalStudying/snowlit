const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const miniprogramRoot = path.join(__dirname, '..');
const maxAssetBytes = 200 * 1024;
const mediaExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.wav', '.aac']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }
    return fullPath;
  });
}

function relative(file) {
  return path.relative(miniprogramRoot, file).replace(/\\/g, '/');
}

function runLargeMediaTest() {
  const oversized = walk(miniprogramRoot)
    .filter((file) => mediaExtensions.has(path.extname(file).toLowerCase()))
    .map((file) => ({ file, size: fs.statSync(file).size }))
    .filter((item) => item.size > maxAssetBytes)
    .map((item) => `${relative(item.file)} (${item.size} bytes)`);

  assert.deepEqual(oversized, [], 'image and audio assets under miniprogram should not exceed 200KB');
  assert.equal(fs.existsSync(path.join(miniprogramRoot, 'assets/design')), false, 'design reference images should stay outside miniprogram root');
}

function runUploadConfigTest() {
  const appJson = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, 'app.json'), 'utf8'));
  const projectConfig = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, 'project.config.json'), 'utf8'));

  assert.equal(appJson.lazyCodeLoading, 'requiredComponents');
  assert.equal(projectConfig.setting.ignoreUploadUnusedFiles, true);
}

function runComponentWxssSelectorTest() {
  const invalidSelectors = walk(path.join(miniprogramRoot, 'components'))
    .filter((file) => path.extname(file) === '.wxss')
    .flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const matches = source.match(/[^{}\n]+\[[^\]]+\]\s*\{/g) || [];
      return matches.map((selector) => `${relative(file)}: ${selector.trim()}`);
    });

  assert.deepEqual(invalidSelectors, [], 'component wxss should not use attribute selectors');
}

runLargeMediaTest();
runUploadConfigTest();
runComponentWxssSelectorTest();

console.log('upload quality tests passed');
