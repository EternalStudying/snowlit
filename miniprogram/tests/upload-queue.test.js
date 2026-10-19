const assert = require('node:assert/strict');
const { test } = require('node:test');
const { patchItem, uploadQueue } = require('../utils/upload-queue');

function createList(items) {
  let list = items;
  const patches = [];
  return {
    read: () => list,
    patch: (index, value) => {
      patches.push([index, value.status || value.message]);
      list = patchItem(list, index, value);
    },
    list: () => list,
    patches
  };
}

function local(name) {
  return { id: name, path: `wxfile://${name}`, status: 'local', url: '' };
}

test('uploads one file at a time and records progress and the returned url', async () => {
  const state = createList([local('a'), local('b')]);
  const order = [];
  let active = 0;
  await uploadQueue({
    read: state.read,
    patch: state.patch,
    upload: (item, index, onProgress) => {
      active += 1;
      assert.equal(active, 1, 'only one upload runs at a time');
      order.push(item.path);
      onProgress({ progress: 140 });
      assert.equal(state.list()[index].message, '上传中 100%');
      return Promise.resolve().then(() => {
        active -= 1;
        return { url: `https://media.test/${item.id}.jpg` };
      });
    }
  });
  assert.deepEqual(order, ['wxfile://a', 'wxfile://b']);
  assert.deepEqual(state.list().map((item) => [item.status, item.url, item.message]), [
    ['uploaded', 'https://media.test/a.jpg', '已上传'],
    ['uploaded', 'https://media.test/b.jpg', '已上传']
  ]);
});

test('skips items already uploaded and items before `from`', async () => {
  const state = createList([local('a'), { ...local('b'), status: 'uploaded', url: 'https://media.test/b.jpg' }, local('c')]);
  const sent = [];
  await uploadQueue({
    read: state.read,
    patch: state.patch,
    from: 1,
    upload: (item) => {
      sent.push(item.id);
      return Promise.resolve({ url: 'https://media.test/new.jpg' });
    }
  });
  assert.deepEqual(sent, ['c']);
  assert.equal(state.list()[0].status, 'local');
});

test('stops at the first failure by default and marks that item failed', async () => {
  const state = createList([local('a'), local('b')]);
  const sent = [];
  await assert.rejects(uploadQueue({
    read: state.read,
    patch: state.patch,
    upload: (item) => {
      sent.push(item.id);
      return Promise.reject(new Error('network down'));
    }
  }), /network down/);
  assert.deepEqual(sent, ['a']);
  assert.deepEqual(state.list().map((item) => item.status), ['failed', 'local']);
});

test('a response without a url counts as a failure with the given message', async () => {
  const state = createList([local('a')]);
  await assert.rejects(uploadQueue({
    read: state.read,
    patch: state.patch,
    failureMessage: '截图上传失败',
    upload: () => Promise.resolve({})
  }), /截图上传失败/);
  assert.equal(state.list()[0].status, 'failed');
});

test('continueOnFailure uploads the rest, then rejects with the first error', async () => {
  const state = createList([local('a'), local('b'), local('c')]);
  const uploaded = [];
  await assert.rejects(uploadQueue({
    read: state.read,
    patch: state.patch,
    continueOnFailure: true,
    uploadedMessage: '已插入',
    onUploaded: (response, index) => uploaded.push([index, response.url]),
    upload: (item) => (item.id === 'a' ? Promise.reject(new Error('first')) : Promise.resolve({ url: `u-${item.id}` }))
  }), /first/);
  assert.deepEqual(uploaded, [[1, 'u-b'], [2, 'u-c']]);
  assert.deepEqual(state.list().map((item) => item.status), ['failed', 'uploaded', 'uploaded']);
  assert.equal(state.list()[1].message, '已插入');
});

test('an upload function that throws synchronously still marks the item failed', async () => {
  const state = createList([local('a')]);
  await assert.rejects(uploadQueue({
    read: state.read,
    patch: state.patch,
    upload: () => { throw new Error('bad path'); }
  }), /bad path/);
  assert.equal(state.list()[0].status, 'failed');
});
