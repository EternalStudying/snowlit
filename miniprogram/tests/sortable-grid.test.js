const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function gesture() {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../components/snowlit-sortable-grid/sortable.wxs'), 'utf8'), sandbox);
  const calls = []; const styles = new Map();
  const owner = { selectComponent: (selector) => ({ setStyle: (style) => styles.set(selector, style) }), callMethod: (method, detail) => calls.push({ method, detail: JSON.parse(JSON.stringify(detail)) }) };
  const rects = Array.from({ length: 36 }, (_, index) => ({ left: index % 3 * 110, top: Math.floor(index / 3) * 110 + 100, width: 100, height: 100 }));
  const event = (x, y, index = 0) => ({ touches: [{ clientX: x, clientY: y }], currentTarget: { dataset: { disabled: false, index } }, target: { dataset: { index } } });
  const layout = { rects, index: 0, columns: 3, viewportHeight: 700, edge: 40 };
  return { drag: sandbox.module.exports, owner, calls, styles, event, layout };
}

test('WXS keeps move updates in the view, animates cross-row slots and emits one changed drop', () => {
  const c = gesture(); c.drag.start(c.event(50, 150), c.owner); c.drag.lift(c.event(50, 150), c.owner);
  assert.deepEqual(c.calls, [{ method: 'measureDrag', detail: { index: 0 } }]);
  c.drag.layoutChanged(c.layout, null, c.owner);
  assert.equal(c.drag.move(c.event(160, 270), c.owner), false);
  assert.equal(c.calls.length, 1, 'ordinary moves never round-trip through JS');
  assert.match(c.styles.get('#sort-item-0').transform, /translate\(110px,120px\) scale/);
  assert.equal(c.styles.get('#sort-item-4').transform, 'translate(-110px,0px)');
  c.drag.end({}, c.owner); c.drag.end({}, c.owner);
  assert.deepEqual(c.calls.at(-1), { method: 'drop', detail: { from: 0, to: 4 } });
  assert.equal(c.calls.filter((call) => call.method === 'drop').length, 1);
});

test('quick scrolling before long-press never lifts and a late measure after release is ignored', () => {
  const c = gesture(); c.drag.start(c.event(50, 150), c.owner); c.drag.move(c.event(50, 180), c.owner); c.drag.lift(c.event(50, 180), c.owner);
  assert.deepEqual(c.calls, []);
  c.drag.start(c.event(50, 150), c.owner); c.drag.lift(c.event(50, 150), c.owner); c.drag.end({}, c.owner); c.drag.layoutChanged(c.layout, null, c.owner);
  assert.equal(c.styles.size, 0);
});

test('dragging at viewport edges requests scrolling and scroll offsets keep the lifted photo under the finger', () => {
  const c = gesture(); c.drag.start(c.event(50, 150), c.owner); c.drag.lift(c.event(50, 150), c.owner); c.drag.layoutChanged(c.layout, null, c.owner);
  c.drag.move(c.event(50, 680), c.owner);
  assert.deepEqual(c.calls.at(-1), { method: 'scrollDirection', detail: { direction: 1 } });
  c.drag.scrolled(120, 0, c.owner);
  assert.match(c.styles.get('#sort-item-0').transform, /650px/);
  c.drag.move(c.event(50, 20), c.owner);
  assert.deepEqual(c.calls.at(-1), { method: 'scrollDirection', detail: { direction: -1 } });
  c.drag.cancel({}, c.owner); assert.deepEqual(c.calls.at(-1), { method: 'drop', detail: { from: 0, to: 0 } });
});

test('one photo lifts without a missing second rectangle and disabled grids ignore touch', () => {
  const c = gesture(); const event = c.event(50, 150); event.currentTarget.dataset.disabled = true;
  c.drag.start(event, c.owner); c.drag.lift(event, c.owner); assert.deepEqual(c.calls, []);
  c.drag.start(c.event(50, 150), c.owner); c.drag.lift(c.event(50, 150), c.owner);
  c.drag.layoutChanged({ ...c.layout, rects: c.layout.rects.slice(0, 1) }, null, c.owner);
  c.drag.end({}, c.owner); assert.deepEqual(c.calls.at(-1), { method: 'drop', detail: { from: 0, to: 0 } });
});

test('component measures actual scroll offsets, clamps at page ends and stops', async () => {
  let definition; let scrollTop = 30; const requests = []; const changes = [];
  global.Component = (value) => { definition = value; };
  global.wx = { pageScrollTo({ scrollTop: value, success }) { requests.push(value); scrollTop = Math.min(42, value); success(); } };
  const modulePath = require.resolve('../components/snowlit-sortable-grid/index'); delete require.cache[modulePath]; require(modulePath);
  const component = { ...definition.methods, data: { disabled: false }, scrollTop: 30, scrollStart: 30,
    setData: (patch) => changes.push(patch), createSelectorQuery() { return { selectViewport() { return this; }, scrollOffset() { return this; }, exec(callback) { callback([{ scrollTop }]); } }; } };
  component.scrollDirection({ direction: 1 }); await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(requests, [42, 54]); assert.deepEqual(changes, [{ scrollOffset: 12 }]); assert.equal(component.scrollTimer, null);
  const events = []; component.triggerEvent = (name, detail) => events.push([name, detail]);
  component.drop({ from: 1, to: 1 }); component.drop({ from: 1, to: 3 });
  assert.deepEqual(events, [['reorder', { from: 1, to: 3 }]]);
  delete global.Component;
});
