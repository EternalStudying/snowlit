const assert = require('node:assert/strict');
const { test } = require('node:test');

function clearDiaryModules() {
  [
    '../pages/diary/index.js',
    '../pages/diary/diary-presenter.js',
    '../services/diary.js',
    '../services/auth.js',
    '../utils/request.js',
    '../utils/auth.js'
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
}

// setData paths as the page uses them: 'key' and 'list[3]'.
function assignPath(target, key, value) {
  const match = key.match(/^(\w+)\[(\d+)\]$/);
  if (match) {
    target[match[1]] = target[match[1]].slice();
    target[match[1]][Number(match[2])] = value;
    return;
  }
  target[key] = value;
}

function diaries(month, count, extra) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${month}-${index}`,
    role: index % 2 ? 'boyfriend' : 'girlfriend',
    entryDate: `${month}-${String(28 - index).padStart(2, '0')}`,
    visibility: 'shared',
    ...(extra || {})
  }));
}

// months: { 'YYYY-MM': items[] }. failing: months whose list request fails once.
function createDiaryPage(months, options) {
  clearDiaryModules();
  const failing = new Set((options && options.failing) || []);
  const requested = [];
  const scrolls = [];
  let pageDefinition;

  global.Page = (definition) => {
    pageDefinition = definition;
  };
  global.getCurrentPages = () => [];
  global.wx = {
    getStorageSync: (key) => (key === 'snowlit_token' ? 'token' : ''),
    getWindowInfo: () => ({ windowWidth: 375 }),
    pageScrollTo: (scroll) => scrolls.push(scroll),
    request(request) {
      const url = request.url;
      if (url.indexOf('/api/auth/me') >= 0) {
        request.success({ statusCode: 200, data: { coupleRole: 'girlfriend' } });
        return;
      }
      if (url.indexOf('/api/diary/months') >= 0) {
        const years = {};
        Object.keys(months).forEach((month) => {
          const year = month.slice(0, 4);
          years[year] = years[year] || [];
          years[year].push({ month, count: months[month].length, hasEntries: months[month].length > 0 });
        });
        request.success({
          statusCode: 200,
          data: { years: Object.keys(years).sort().reverse().map((year) => ({ year: Number(year), months: years[year] })) }
        });
        return;
      }
      const month = decodeURIComponent(url.split('month=')[1] || '');
      requested.push(month);
      if (failing.has(month)) {
        failing.delete(month);
        request.success({ statusCode: 500, data: { message: '服务器开小差了' } });
        return;
      }
      request.success({ statusCode: 200, data: { month, items: months[month] || [] } });
    }
  };

  require('../pages/diary/index.js');
  const page = {
    ...pageDefinition,
    data: JSON.parse(JSON.stringify(pageDefinition.data)),
    setData(patch) {
      Object.keys(patch).forEach((key) => assignPath(this.data, key, patch[key]));
    }
  };
  page.onLoad();
  return { page, requested, scrolls };
}

test.afterEach(() => {
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
});

test('opens on the newest diaries even when this month is empty, and stops once a batch is full', async () => {
  const { page, requested } = createDiaryPage({
    '2026-10': [],
    '2026-08': diaries('2026-08', 3),
    '2026-07': diaries('2026-07', 6),
    '2026-05': diaries('2026-05', 2)
  });
  await page.loadDiaryPage();

  assert.deepEqual(requested, ['2026-08', '2026-07']);
  assert.deepEqual(page.data.sections.map((section) => section.month), ['2026-08', '2026-07']);
  assert.equal(page.data.sections[0].countText, '3 篇');
  assert.equal(page.data.exhausted, false);
});

test('scrolling loads older months in order until the index runs out', async () => {
  const { page, requested } = createDiaryPage({
    '2026-08': diaries('2026-08', 9),
    '2026-07': diaries('2026-07', 1),
    '2025-12': diaries('2025-12', 1)
  });
  await page.loadDiaryPage();
  assert.deepEqual(requested, ['2026-08']);

  await page.onReachBottom();
  assert.deepEqual(requested, ['2026-08', '2026-07', '2025-12']);
  assert.equal(page.data.exhausted, true);

  await page.onReachBottom();
  assert.equal(requested.length, 3, 'no requests once exhausted');
});

test('a filter applies to every loaded month and keeps loading until enough match', async () => {
  const { page, requested } = createDiaryPage({
    '2026-08': diaries('2026-08', 9),
    '2026-07': diaries('2026-07', 2, { visibility: 'private' }),
    '2026-06': diaries('2026-06', 1)
  });
  await page.loadDiaryPage();
  assert.deepEqual(requested, ['2026-08']);

  page.handleFilterTap({ currentTarget: { dataset: { value: 'private' } } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requested, ['2026-08', '2026-07', '2026-06']);
  assert.deepEqual(page.data.sections.map((section) => section.entries.length), [0, 2, 0]);
  assert.equal(page.data.matching, 2);
  assert.equal(page.data.filters[2].label, 'TA的');
});

test('jumping to an unloaded month loads the months in between and scrolls under the sticky heading', async () => {
  const { page, requested, scrolls } = createDiaryPage({
    '2026-08': diaries('2026-08', 9),
    '2026-07': diaries('2026-07', 1),
    '2025-03': diaries('2025-03', 1)
  });
  await page.loadDiaryPage();

  page.handleMonthHeadTap({ currentTarget: { dataset: { month: '2026-08' } } });
  assert.equal(page.data.jumpVisible, true);
  assert.deepEqual(page.data.jumpYears.map((year) => year.year), ['2026', '2025']);

  page.handleJumpSelect({ detail: { month: '2025-03' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.data.jumpVisible, false);
  assert.deepEqual(requested, ['2026-08', '2026-07', '2025-03']);
  assert.deepEqual(scrolls[scrolls.length - 1], { selector: '#month-2025-03', offsetTop: -64, duration: 260 });
});

test('a failed month shows a retry, keeps what was loaded, and retrying continues in order', async () => {
  const { page, requested } = createDiaryPage({
    '2026-08': diaries('2026-08', 3),
    '2026-07': diaries('2026-07', 6)
  }, { failing: ['2026-07'] });
  await page.loadDiaryPage();

  assert.equal(page.data.failedMonth, '2026-07');
  assert.deepEqual(page.data.sections.map((section) => section.month), ['2026-08']);

  await page.handleRetryTap();
  assert.equal(page.data.failedMonth, '');
  assert.deepEqual(requested, ['2026-08', '2026-07', '2026-07']);
  assert.deepEqual(page.data.sections.map((section) => section.month), ['2026-08', '2026-07']);
});

test('an account with no diaries shows the empty state without listing months', async () => {
  const { page, requested } = createDiaryPage({});
  await page.loadDiaryPage();
  assert.deepEqual(requested, []);
  assert.equal(page.data.exhausted, true);
  assert.deepEqual(page.data.sections, []);
});
