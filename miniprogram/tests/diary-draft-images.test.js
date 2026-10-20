const assert = require('node:assert/strict');
const { test } = require('node:test');
const { removeDiaryImageMarkdown } = require('../pages/diary-edit/diary-edit-presenter');

const url = 'https://media.example.com/draft/photo[1]+.jpg?size=small&v=2';

test('draft image removal strips matching single and double quoted HTML images, including uppercase tags', () => {
  const content = `Before<img src="${url}" alt="First" />middle<IMG class='photo' SRC='${url}'>After`;
  assert.equal(removeDiaryImageMarkdown(content, url), 'BeforemiddleAfter');
});

test('draft image removal matches regex-special URLs exactly and preserves other images and plain links', () => {
  const other = `${url}&other=1`;
  const content = `![Owned](${url})<img src='${url}'><img src="${other}"><a href="${url}">Link</a>Keep text`;
  assert.equal(removeDiaryImageMarkdown(content, url), `<img src="${other}"><a href="${url}">Link</a>Keep text`);
});

test('draft image removal reads the real src attribute and preserves data-src, srcset and different URL casing', () => {
  const content = `<img data-src="${url}" src="other.jpg"><img srcset='${url}'><img alt="src='${url}'" src='other.jpg'><img src='${url.toUpperCase()}'>`;
  assert.equal(removeDiaryImageMarkdown(content, url), content);
});

test('draft image removal handles quoted attributes containing greater-than characters', () => {
  const content = `<img alt="Before > after" src='${url}'>Keep<img alt='Keep > this' src='other.jpg'>`;
  assert.equal(removeDiaryImageMarkdown(content, url), "Keep<img alt='Keep > this' src='other.jpg'>");
});
