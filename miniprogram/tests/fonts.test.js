const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const kaiCharacters = new Set([...read('assets/fonts/snowlit-kai.chars.txt').trim()]);
// Bound headings allowed in the Kai face, with every value they can take (see build_fonts.py).
const BOUND_KAI_HEADINGS = { '{{greetingTitle}}': ['上午好'] };

function templates() {
  return ['pages', 'components'].flatMap((dir) => fs.readdirSync(path.join(root, dir))
    .map((name) => `${dir}/${name}/index.wxml`)
    .filter((file) => fs.existsSync(path.join(root, file))));
}

function kaiTexts(file) {
  const pattern = /class="[^"]*\bsnowlit-kai\b[^"]*"[^>]*>([^<]*)</g;
  return [...read(file).matchAll(pattern)].map((match) => match[1].trim());
}

test('every Kai heading has fixed text whose characters are all in the bundled subset', () => {
  const missing = [];
  templates().forEach((file) => {
    kaiTexts(file).forEach((text) => {
      const values = text.includes('{{') ? BOUND_KAI_HEADINGS[text] : [text];
      assert.ok(values, `${file}: "${text}" is bound text; people's text must stay in the system font`);
      values.join('').split('').filter((ch) => !/\s/.test(ch) && !kaiCharacters.has(ch))
        .forEach((ch) => missing.push(`${file}: ${ch}`));
    });
  });
  assert.deepEqual(missing, [], 'run tools/miniprogram-fonts/build_fonts.py to add these characters');
});

test('the Home greeting only takes the values the Kai subset was built for', () => {
  const assignments = [...read('pages/index/index.js').matchAll(/greetingTitle:\s*'([^']*)'/g)].map((match) => match[1]);
  assert.ok(assignments.length > 0);
  assignments.forEach((value) => assert.ok(BOUND_KAI_HEADINGS['{{greetingTitle}}'].includes(value), value));
});

test('both bundled faces load from app.wxss and stay small', () => {
  const appWxss = read('app.wxss');
  ['snowlit-kai', 'snowlit-serif'].forEach((name) => {
    assert.match(appWxss, new RegExp(`@import\\s+"\\./assets/fonts/${name}\\.wxss";`));
    const face = read(`assets/fonts/${name}.wxss`);
    assert.match(face, /data:application\/font-woff;charset=utf-8;base64,/);
  });
  const total = ['snowlit-kai', 'snowlit-serif']
    .reduce((sum, name) => sum + Buffer.byteLength(read(`assets/fonts/${name}.wxss`), 'utf8'), 0);
  assert.ok(total < 160 * 1024, `fonts take ${total} bytes`);
});
