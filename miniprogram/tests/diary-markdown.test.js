const assert = require('node:assert/strict');

const { parseDiaryMarkdown } = require('../utils/diary-markdown');

function nodeText(nodes) {
  return (nodes || []).map((node) => {
    if (node.type === 'text') {
      return node.text || '';
    }
    return nodeText(node.children);
  }).join('');
}

function hasNode(nodes, name) {
  return (nodes || []).some((node) => (
    node.name === name || hasNode(node.children, name)
  ));
}

function runStyledMarkdownTest() {
  const blocks = parseDiaryMarkdown([
    '# 今天的标题',
    '',
    '## 小标题',
    '',
    '今天**很好**，也__很亮__，还*很轻*。',
    '',
    '> 引用 **重点**',
    '',
    '- 第一件',
    '- **第二件**',
    '',
    '1. 第一步',
    '2. **第二步**'
  ].join('\n'), {});

  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[0].text, '小标题');
  assert.equal(nodeText(blocks[0].nodes), '小标题');

  const paragraph = blocks.find((block) => block.type === 'paragraph');
  assert.equal(paragraph.text, '今天很好，也很亮，还很轻。');
  assert.equal(nodeText(paragraph.nodes), '今天很好，也很亮，还很轻。');
  assert.equal(hasNode(paragraph.nodes, 'strong'), true);
  assert.equal(hasNode(paragraph.nodes, 'em'), true);

  const quote = blocks.find((block) => block.type === 'quote');
  assert.equal(quote.text, '引用 重点');
  assert.equal(nodeText(quote.nodes), '引用 重点');
  assert.equal(hasNode(quote.nodes, 'strong'), true);

  const unorderedList = blocks.find((block) => block.type === 'list' && !block.ordered);
  assert.equal(unorderedList.items.length, 2);
  assert.equal(unorderedList.items[0].marker, '•');
  assert.equal(unorderedList.items[1].text, '第二件');
  assert.equal(hasNode(unorderedList.items[1].nodes, 'strong'), true);

  const orderedList = blocks.find((block) => block.type === 'list' && block.ordered);
  assert.equal(orderedList.items.length, 2);
  assert.equal(orderedList.items[0].marker, '1.');
  assert.equal(orderedList.items[1].marker, '2.');
  assert.equal(orderedList.items[1].text, '第二步');
  assert.equal(hasNode(orderedList.items[1].nodes, 'strong'), true);
}

function runCommonMarkdownTest() {
  const blocks = parseDiaryMarkdown([
    '普通链接 [Snowlit](https://snowlit.example.com)，自动链接 https://snowlit.example.com。',
    '',
    '~~删掉~~ ==高亮== `代码`',
    '',
    '---',
    '',
    '```js',
    'const mood = "happy";',
    '```',
    '',
    '| 名称 | 状态 |',
    '| --- | --- |',
    '| 花 | **漂亮** |'
  ].join('\n'), {});

  const firstParagraph = blocks[0];
  assert.equal(firstParagraph.type, 'paragraph');
  assert.equal(hasNode(firstParagraph.nodes, 'a'), true);

  const secondParagraph = blocks[1];
  assert.equal(secondParagraph.type, 'paragraph');
  assert.equal(hasNode(secondParagraph.nodes, 'del'), true);
  assert.equal(hasNode(secondParagraph.nodes, 'span'), true);
  assert.equal(hasNode(secondParagraph.nodes, 'code'), true);

  assert.equal(blocks[2].type, 'hr');
  assert.equal(blocks[3].type, 'code');
  assert.equal(blocks[3].text, 'const mood = "happy";');
  assert.equal(blocks[4].type, 'table');
  assert.equal(blocks[4].rows.length, 2);
  assert.equal(blocks[4].rows[0].header, true);
  assert.equal(blocks[4].rows[1].cells[1].text, '漂亮');
  assert.equal(hasNode(blocks[4].rows[1].cells[1].nodes, 'strong'), true);
}

function runImageSpacingTest() {
  const blocks = parseDiaryMarkdown('今天**很好**。\n\n![图](https://snowlit.example.com/one.jpg)', {});

  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(hasNode(blocks[0].nodes, 'strong'), true);
  assert.equal(blocks[1].type, 'image');
  assert.equal(blocks[1].spacing, 'tight');
}

runStyledMarkdownTest();
runCommonMarkdownTest();
runImageSpacingTest();

console.log('diary-markdown tests passed');
