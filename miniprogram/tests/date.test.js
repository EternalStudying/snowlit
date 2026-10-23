const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function checkDateBehavior() {
  const assert = require('node:assert/strict');
  const { toDate, formatDate, formatDateTime, formatMonthDay } = require('./utils/date');
  const { mapTimelineSection, mapDiaryDetail } = require('./pages/diary/diary-presenter');
  const { mapAlbumPage, mapAlbumDetail } = require('./pages/albums/album-presenter');
  const { mapStoryPage } = require('./pages/story/story-presenter');

  // A calendar date is not an instant: even month/year boundaries stay unchanged.
  const calendarDates = ['2026-01-01', '2026-03-01', '2026-12-31', '2024-02-29', '2000-02-29', '0099-01-01'];
  for (const value of calendarDates) {
    assert.equal(formatDate(value), value);
    assert.equal(formatMonthDay(value), value.slice(5).replace('-', '.'));
    assert.equal(formatDateTime(value), `${value} 00:00`);
    assert.equal(formatDate(toDate(value)), value);
    const section = mapTimelineSection(value.slice(0, 7), [{ id: 1, entryDate: value }], 1);
    assert.equal(section.entries[0].date, value.slice(5).replace('-', '.'));
  }

  // Invalid calendar dates must not silently roll into the next month.
  const invalidValues = [
    null, undefined, '', false, NaN, new Date(NaN), 'not-a-date',
    '2023-02-29', '1900-02-29', '2026-02-30', '2026-04-31',
    '2026-00-01', '2026-13-01', '2026-01-00', '2026-01-32', '2026-13-01T00:00:00Z'
  ];
  for (const value of invalidValues) {
    assert.equal(toDate(value), null);
    assert.equal(formatDate(value), '');
    assert.equal(formatDateTime(value), '');
    assert.equal(formatMonthDay(value), '');
  }

  const timestampCases = [
    {
      value: '2026-01-01T00:30:00Z',
      local: { 'America/Los_Angeles': '2025-12-31 16:30', 'Asia/Singapore': '2026-01-01 08:30', UTC: '2026-01-01 00:30' }
    },
    {
      value: '2026-03-01T00:30:00+08:00',
      local: { 'America/Los_Angeles': '2026-02-28 08:30', 'Asia/Singapore': '2026-03-01 00:30', UTC: '2026-02-28 16:30' }
    },
    {
      value: '2026-12-31T23:30:00-07:00',
      local: { 'America/Los_Angeles': '2026-12-31 22:30', 'Asia/Singapore': '2027-01-01 14:30', UTC: '2027-01-01 06:30' }
    },
    {
      value: '2024-02-29T00:30:00Z',
      local: { 'America/Los_Angeles': '2024-02-28 16:30', 'Asia/Singapore': '2024-02-29 08:30', UTC: '2024-02-29 00:30' }
    }
  ];
  for (const { value, local } of timestampCases) {
    const expected = local[process.env.TZ];
    assert.equal(formatDateTime(value), expected);
    assert.equal(formatDate(value), expected.slice(0, 10));
    assert.equal(formatMonthDay(value), expected.slice(5, 10).replace('-', '.'));
    assert.equal(formatDateTime(new Date(value)), expected);
    assert.equal(formatDateTime(Date.parse(value)), expected);
    const detail = mapDiaryDetail({ entryDate: '2026-01-01', updatedAt: value });
    assert.equal(detail.updatedText, expected.replace(/-/g, '.'));
    const story = mapStoryPage({ items: [{ id: 1, eventTime: value }] });
    assert.equal(story.years[1].value, Number(expected.slice(0, 4)));
  }
  assert.equal(formatDateTime('2026-05-27T21:10:00'), '2026-05-27 21:10');

  const diary = mapTimelineSection('2026-01', [{ id: 1, entryDate: '2026-01-01' }], 1);
  assert.equal(diary.entries[0].date, '01.01');
  assert.ok(mapDiaryDetail({ entryDate: '2024-02-29' }).subtitle.startsWith('02.29 ·'));
  assert.ok(mapAlbumPage({ items: [{ id: 1, eventDate: '2026-01-01' }] }).items[0].meta.startsWith('01.01 ·'));
  const album = mapAlbumDetail({ album: { eventDate: '2024-02-29' }, photos: [{ takenAt: '2026-03-01' }] });
  assert.equal(album.eventDate, '2024.02.29');
  assert.equal(album.photos[0].meta, '03.01');
  assert.equal(mapStoryPage({ items: [{ id: 1, eventTime: '2026-01-01' }] }).years[1].value, 2026);
}

for (const timezone of ['America/Los_Angeles', 'Asia/Singapore', 'UTC']) {
  test(`calendar dates and timestamp presenters in ${timezone}`, () => {
    const result = spawnSync(process.execPath, ['-e', `(${checkDateBehavior.toString()})()`], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || String(result.error || result.signal));
  });
}
