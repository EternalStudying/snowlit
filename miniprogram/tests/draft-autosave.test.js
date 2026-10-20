const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createDraftAutosave } = require('../utils/draft-autosave');
const { setToken } = require('../utils/auth');

async function settle() { for (let i = 0; i < 20; i += 1) await Promise.resolve(); }
function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-05-20T12:00:00Z').getTime() });
  let token = 'member-a';
  const calls = [];
  const statuses = [];
  let fields = { title: 'first' };
  let dropped = 0;
  global.wx = {
    getStorageSync: () => token,
    setStorageSync: (key, value) => { token = value; },
    removeStorageSync: () => { token = ''; },
    request: (call) => calls.push(call)
  };
  const helper = createDraftAutosave({ page: {}, kind: 'album', read: () => ({ ...fields }), view: (value) => statuses.push(value), sessionChanged: () => { dropped += 1; } });
  t.after(() => helper.stop());
  return { helper, calls, statuses, edit: (value) => { fields = value; helper.changed(); }, dropped: () => dropped };
}
function saved(call) { call.success({ statusCode: 200, data: { updatedAt: '2026-05-20T12:00:00' } }); }

test('debounces at 1500 ms, serializes saves and follows an in-flight edit with one newest save', async (t) => {
  const c = setup(t);
  c.helper.changed();
  t.mock.timers.tick(1499); await settle(); assert.equal(c.calls.length, 0);
  c.edit({ title: 'second' });
  t.mock.timers.tick(1499); await settle(); assert.equal(c.calls.length, 0);
  t.mock.timers.tick(1); await settle(); assert.equal(c.calls.length, 1);
  assert.deepEqual(c.calls[0].data.fields, { title: 'second' });
  c.edit({ title: 'third' }); c.edit({ title: 'latest' });
  t.mock.timers.tick(1500); await settle(); assert.equal(c.calls.length, 1, 'only one HTTP save may be in flight');
  saved(c.calls[0]); await settle(); assert.equal(c.calls.length, 2);
  assert.deepEqual(c.calls[1].data.fields, { title: 'latest' });
  saved(c.calls[1]); await settle();
  assert.match(c.statuses.at(-1), /^已自动保存 \d{2}:\d{2}$/);
});

test('flush saves without waiting and quiet failure retries on next change', async (t) => {
  const c = setup(t);
  c.helper.changed(); const first = c.helper.flush(); await settle();
  assert.equal(c.calls.length, 1); assert.equal(c.statuses[0], '保存中…');
  c.calls[0].fail({ errMsg: 'offline' }); assert.equal(await first, false);
  assert.equal(c.statuses.at(-1), '自动保存失败，稍后会重试');
  c.edit({ title: 'retry' }); t.mock.timers.tick(1500); await settle();
  assert.equal(c.calls.length, 2); saved(c.calls[1]); await settle();
  assert.match(c.statuses.at(-1), /^已自动保存/);
});

test('flush retries a failed save, and stopping or switching member cancels delayed writes', async (t) => {
  const c = setup(t);
  c.helper.changed(); const failure = c.helper.flush(); await settle(); c.calls[0].fail({}); await failure;
  const retry = c.helper.flush(); await settle(); assert.equal(c.calls.length, 2); saved(c.calls[1]); await retry;
  c.edit({ title: 'must not cross member' }); setToken('member-b');
  assert.equal(c.dropped(), 1);
  t.mock.timers.tick(1500); await c.helper.flush(); assert.equal(c.calls.length, 2);
});

test('pausing for publish prevents a delayed PUT but retains immediate session invalidation', async (t) => {
  const c = setup(t);
  c.helper.changed(); c.helper.pause();
  t.mock.timers.tick(2000); await c.helper.flush(); await settle(); assert.equal(c.calls.length, 0);
  setToken('member-b'); assert.equal(c.dropped(), 1);
});
