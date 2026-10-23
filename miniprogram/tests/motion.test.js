const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const appWxss = read('app.wxss');

test('shared keyframes only animate transform and opacity, which the render thread runs cheaply', () => {
  const keyframes = [...appWxss.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)];
  assert.ok(keyframes.length > 0);
  keyframes.forEach(([, name, body]) => {
    const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map((match) => match[1]);
    properties.forEach((property) => assert.ok(['transform', 'opacity'].includes(property), `${name} animates ${property}`));
  });
  assert.match(appWxss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
});

test('every hover-class a page uses is defined in app.wxss', () => {
  const pages = fs.readdirSync(path.join(root, 'pages'))
    .map((name) => `pages/${name}/index`)
    .filter((base) => fs.existsSync(path.join(root, `${base}.wxml`)));
  pages.forEach((base) => {
    const pageWxss = fs.existsSync(path.join(root, `${base}.wxss`)) ? read(`${base}.wxss`) : '';
    [...read(`${base}.wxml`).matchAll(/hover-class="([\w-]+)"/g)].forEach(([, name]) => {
      if (name === 'none') {
        return;
      }
      assert.ok(new RegExp(`\\.${name}\\s*\\{`).test(appWxss + pageWxss), `${base}.wxml uses undefined ${name}`);
    });
  });
});

test('returning to Albums refreshes without unmounting its cards, so their entrance does not replay', () => {
  const wxml = read('pages/albums/index.wxml');
  assert.match(wxml, /class="album-state" wx:if="\{\{loading && !albums\.length\}\}"/);
});
