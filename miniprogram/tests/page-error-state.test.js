const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readPage(page, ext) {
  return fs.readFileSync(path.join(__dirname, `../pages/${page}/index.${ext}`), 'utf8');
}

function runStatusCopyTest() {
  const requestSource = fs.readFileSync(path.join(__dirname, '../utils/request.js'), 'utf8');
  const uploadSource = fs.readFileSync(path.join(__dirname, '../utils/upload.js'), 'utf8');

  [
    '登录已过期',
    '当前账号没有操作权限',
    '内容不存在或已删除',
    '服务繁忙，请稍后重试'
  ].forEach((message) => {
    assert.equal(requestSource.includes(message), true, `request should map ${message}`);
  });
  assert.equal(uploadSource.includes('formatApiErrorMessage'), true, 'upload errors should use the shared status mapper');
}

function runPageMessageBindingTest() {
  const pages = [
    { page: 'index', bindings: ['{{momentsError}}', '{{albumsMessage}}', '{{wishesMessage}}'] },
    { page: 'diary', bindings: ['{{message}}'] },
    { page: 'diary-detail', bindings: ['{{message}}'] },
    { page: 'diary-edit', bindings: ['{{message}}'] },
    { page: 'story', bindings: ['{{message}}'] },
    { page: 'story-detail', bindings: ['{{message}}'] },
    { page: 'story-edit', bindings: ['{{message}}'] },
    { page: 'albums', bindings: ['{{message}}'] },
    { page: 'album-detail', bindings: ['{{message}}'] },
    { page: 'album-edit', bindings: ['{{message}}'] },
    { page: 'wishes', bindings: ['{{pageState.wantGo.message}}', '{{pageState.wantDo.message}}', '{{pageState.completed.message}}'] },
    { page: 'wish-detail', bindings: ['{{message}}'] },
    { page: 'wish-edit', bindings: ['{{message}}'] },
    { page: 'profile', bindings: ['{{message}}'] },
    { page: 'feedback', bindings: ['{{message}}'] }
  ];

  pages.forEach(({ page, bindings }) => {
    const js = readPage(page, 'js');
    const wxml = readPage(page, 'wxml');

    assert.equal(js.includes('error.message'), true, `${page} should read request error message`);
    bindings.forEach((binding) => {
      assert.equal(wxml.includes(binding), true, `${page} should render ${binding}`);
    });
  });
}

runStatusCopyTest();
runPageMessageBindingTest();

console.log('page error state tests passed');
