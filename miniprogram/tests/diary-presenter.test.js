const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  BATCH_ENTRIES,
  applyFilter,
  buildJumpYears,
  buildMonthIndex,
  mapDiaryDetail,
  mapTimelineSection,
  nextMonthToLoad
} = require('../pages/diary/diary-presenter');

const MONTHS_RESPONSE = {
  years: [
    {
      year: 2026,
      months: [
        { month: '2026-01', count: 1, hasEntries: true },
        { month: '2026-03', count: 2, hasEntries: true },
        { month: '2026-10', count: 0, hasEntries: false },
        { month: '2026-12', count: 0, hasEntries: false }
      ]
    },
    {
      year: 2025,
      months: [
        { month: '2025-12', count: 4, hasEntries: true }
      ]
    }
  ]
};

const ITEMS = [
  {
    id: 1,
    role: 'girlfriend',
    authorName: '伴侣 B',
    title: '有图共享日记',
    summary: '今天路过集市，买了一束花。',
    imageUrls: ['https://snowlit.example.com/media/diary/flower.webp'],
    entryDate: '2026-03-27',
    moodKey: 'happy',
    locationName: '集市',
    weather: '晴',
    visibility: 'shared'
  },
  {
    id: 2,
    role: 'boyfriend',
    authorName: '伴侣 A',
    title: '无天气私密日记',
    summary: '',
    imageUrls: [],
    entryDate: '2026-03-26',
    moodKey: 'calm',
    locationName: '',
    weather: '',
    visibility: 'private'
  }
];

function runMonthIndexTest() {
  assert.deepEqual(buildMonthIndex(MONTHS_RESPONSE), [
    { month: '2026-03', count: 2 },
    { month: '2026-01', count: 1 },
    { month: '2025-12', count: 4 }
  ]);
  assert.deepEqual(buildMonthIndex({ years: [{ year: 2026, months: [{ month: '2026-10', count: 0 }] }] }), []);
  assert.deepEqual(buildMonthIndex(null), []);
}

function runJumpYearsTest() {
  const years = buildJumpYears(MONTHS_RESPONSE, '2026-03');
  assert.deepEqual(years.map((year) => year.year), ['2026', '2025']);
  assert.equal(years[0].months.length, 12);
  assert.deepEqual(years[0].months[2], { month: '2026-03', label: '03', count: 2, disabled: false, active: true });
  // Empty and future months stay in the grid but can't be picked.
  assert.equal(years[0].months[9].disabled, true);
  assert.equal(years[0].months[11].disabled, true);
  assert.equal(years[1].months[11].disabled, false);
  assert.equal(years[1].months.filter((month) => month.active).length, 0);
  // An account with no diaries comes back as this year with zeros: no years to show.
  assert.deepEqual(buildJumpYears({ years: [{ year: 2026, months: [{ month: '2026-10', count: 0 }] }] }, ''), []);
}

function runSectionTest() {
  const section = mapTimelineSection('2026-03', ITEMS, 2, 'all', 'girlfriend');
  assert.equal(section.anchorId, 'month-2026-03');
  assert.equal(section.yearText, '2026');
  assert.equal(section.monthText, '03');
  assert.equal(section.countText, '2 篇');
  assert.deepEqual(section.entries[0], {
    id: 1,
    date: '03.27',
    visibility: '共享',
    title: '有图共享日记',
    summary: '今天路过集市，买了一束花。',
    meta: '伴侣 B · 开心 · 晴 · 集市',
    role: 'girlfriend',
    image: 'https://snowlit.example.com/media/diary/flower.webp'
  });
  assert.equal(section.entries[1].summary, '这篇日记没有摘要');

  // The heading keeps the month's total under a filter, so it matches the jump sheet.
  const mine = mapTimelineSection('2026-03', ITEMS, 2, 'mine', 'girlfriend');
  assert.deepEqual(mine.entries.map((entry) => entry.id), [1]);
  assert.equal(mine.countText, '2 篇');
  assert.deepEqual(mapTimelineSection('2026-03', ITEMS, 2, 'other', 'girlfriend').entries.map((entry) => entry.id), [2]);
  assert.deepEqual(mapTimelineSection('2026-03', ITEMS, 2, 'private', 'girlfriend').entries.map((entry) => entry.id), [2]);
}

function runApplyFilterTest() {
  const sections = [
    mapTimelineSection('2026-03', ITEMS, 2, 'all', 'girlfriend'),
    mapTimelineSection('2026-01', [{ id: 3, role: 'girlfriend', entryDate: '2026-01-02', visibility: 'shared' }], 1, 'all', 'girlfriend')
  ];
  const filtered = applyFilter(sections, 'private', 'girlfriend');
  assert.equal(filtered.matching, 1);
  assert.deepEqual(filtered.sections.map((section) => section.entries.length), [1, 0]);
  assert.equal(filtered.sections[1].countText, '1 篇');
  assert.equal(applyFilter(filtered.sections, 'all', 'girlfriend').matching, 3);
}

function runNextMonthTest() {
  const index = buildMonthIndex(MONTHS_RESPONSE);
  assert.equal(BATCH_ENTRIES, 8);
  assert.equal(nextMonthToLoad(index, [], {}, 0), '2026-03');
  assert.equal(nextMonthToLoad(index, ['2026-03'], {}, 2), '2026-01');
  assert.equal(nextMonthToLoad(index, ['2026-03'], {}, 8), '');
  assert.equal(nextMonthToLoad(index, ['2026-03'], { minEntries: 2 }, 2), '');
  assert.equal(nextMonthToLoad(index, ['2026-03', '2026-01', '2025-12'], {}, 0), '');
  // A jump loads every month up to the target, in order, then stops.
  assert.equal(nextMonthToLoad(index, ['2026-03'], { untilMonth: '2025-12' }, 50), '2026-01');
  assert.equal(nextMonthToLoad(index, ['2026-03', '2026-01'], { untilMonth: '2025-12' }, 50), '2025-12');
  assert.equal(nextMonthToLoad(index, ['2026-03', '2026-01', '2025-12'], { untilMonth: '2025-12' }, 0), '');
}

function runDetailMappingTest() {
  const result = mapDiaryDetail({
    id: 1,
    role: 'girlfriend',
    authorName: '伴侣 B',
    contentMarkdown: '# 有图共享日记\n\n今天路过集市。\n\n![花](https://snowlit.example.com/media/diary/flower.webp)\n\n## 晚上\n\n回家路上看到灯光。',
    title: '有图共享日记',
    summary: '今天路过集市。',
    imageUrls: ['https://snowlit.example.com/media/diary/flower.webp'],
    entryDate: '2026-05-27',
    moodKey: 'happy',
    visibility: 'shared',
    weather: '晴',
    temperature: 28,
    province: '示例地区',
    city: '示例城市',
    district: '示例街区',
    locationName: '集市',
    latitude: 3.1111,
    longitude: 14.2222,
    updatedAt: '2026-05-27T21:10:00'
  }, { coupleRole: 'girlfriend' });

  assert.equal(result.title, '有图共享日记');
  assert.equal(result.canEdit, true);
  assert.equal(result.brand, 'DIARY');
  assert.equal(result.subtitle, '05.27 · 伴侣 B · 共享');
  assert.equal(result.contentBlocks.length, 4);
  assert.deepEqual({
    key: result.contentBlocks[0].key,
    type: result.contentBlocks[0].type,
    spacing: result.contentBlocks[0].spacing,
    text: result.contentBlocks[0].text
  }, { key: 'paragraph-0', type: 'paragraph', spacing: 'first', text: '今天路过集市。' });
  assert.deepEqual(result.contentBlocks[0].nodes, [{ type: 'text', text: '今天路过集市。' }]);
  assert.deepEqual(result.contentBlocks[1], {
    key: 'image-1',
    type: 'image',
    spacing: 'tight',
    url: 'https://snowlit.example.com/media/diary/flower.webp',
    alt: '花'
  });
  assert.deepEqual({
    key: result.contentBlocks[2].key,
    type: result.contentBlocks[2].type,
    spacing: result.contentBlocks[2].spacing,
    level: result.contentBlocks[2].level,
    text: result.contentBlocks[2].text
  }, { key: 'heading-2', type: 'heading', spacing: 'spaced', level: 2, text: '晚上' });
  assert.deepEqual(result.contentBlocks[2].nodes, [{ type: 'text', text: '晚上' }]);
  assert.deepEqual({
    key: result.contentBlocks[3].key,
    type: result.contentBlocks[3].type,
    spacing: result.contentBlocks[3].spacing,
    text: result.contentBlocks[3].text
  }, { key: 'paragraph-3', type: 'paragraph', spacing: 'spaced', text: '回家路上看到灯光。' });
  assert.deepEqual(result.contentBlocks[3].nodes, [{ type: 'text', text: '回家路上看到灯光。' }]);
  assert.deepEqual(result.photos, ['https://snowlit.example.com/media/diary/flower.webp']);
  assert.equal(result.weatherText, '晴 · 28°C');
  assert.equal(result.placeText, '示例地区 示例城市 示例街区 · 集市');
  assert.equal(result.coordinate, '3.111 / 14.222');
  assert.equal(result.updatedText, '2026.05.27 21:10');

  assert.equal(mapDiaryDetail({ role: 'boyfriend' }, { coupleRole: 'girlfriend' }).canEdit, false);
}

function runDiaryTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/diary/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/diary/index.wxss'), 'utf8');
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../pages/diary/index.json'), 'utf8'));

  // The month header, month strip and stats row are gone; months are sections of one timeline.
  ['{{monthTitle}}', '{{monthCaption}}', '<scroll-view', 'stat-row', 'handleMonthTap'].forEach((text) => {
    assert.equal(wxml.includes(text), false, text);
  });
  assert.match(wxml, /wx:for="\{\{sections\}\}"[\s\S]*id="\{\{section\.anchorId\}\}"/);
  assert.match(wxml, /class="month-head"[\s\S]*bindtap="handleMonthHeadTap"/);
  assert.match(wxml, /wx:for="\{\{section\.entries\}\}"[\s\S]*bindtap="handleEntryTap"/);
  assert.match(wxml, /bindtap="handleRetryTap"/);
  assert.match(wxml, /<snowlit-month-sheet[\s\S]*bind:select="handleJumpSelect"/);
  assert.match(wxml, /class="diary-add"[\s\S]*bindtap="handleCreateDiary"/);
  assert.match(wxml, /assets\/icons\/story\/plus-white\.svg/);
  assert.equal(json.usingComponents['snowlit-month-sheet'], '/components/snowlit-month-sheet/index');
  assert.equal(json.onReachBottomDistance, 200);

  assert.match(wxss, /\.month-head \{[^}]*position: sticky;[^}]*top: 128rpx;/);
  // Sticky needs the page container's overflow visible (snowlit-tab-page hides x overflow).
  assert.match(wxss, /\.diary-page \{[^}]*overflow: visible;/);
  assert.match(wxss, /\.diary-add[\s\S]*position: fixed/);
  assert.match(wxss, /\.diary-add[\s\S]*bottom: calc\(142rpx \+ env\(safe-area-inset-bottom\)\)/);
}

function runDiaryDetailTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/diary-detail/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/diary-detail/index.wxss'), 'utf8');

  assert.equal(wxml.includes('diary.contentLines'), false);
  assert.equal(wxml.includes('photo-section'), false);
  assert.equal(wxml.includes('PHOTOS'), false);
  assert.equal(wxml.includes('content-image-caption'), false);
  assert.equal(wxml.includes('{{item.alt}}'), false);
  assert.match(wxml, /wx:for="\{\{diary\.contentBlocks\}\}"/);
  assert.match(wxml, /content-block--\{\{item\.spacing\}\}/);
  assert.match(wxml, /<rich-text nodes="\{\{item\.nodes\}\}"/);
  assert.match(wxml, /wx:if="\{\{item\.type === 'paragraph'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-text"/);
  assert.match(wxml, /wx:elif="\{\{item\.type === 'heading'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-heading/);
  assert.match(wxml, /wx:elif="\{\{item\.type === 'quote'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-quote"/);
  assert.match(wxml, /wx:elif="\{\{item\.type === 'list'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-list"/);
  assert.match(wxml, /wx:elif="\{\{item\.type === 'code'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-code"/);
  assert.match(wxml, /wx:elif="\{\{item\.type === 'hr'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-hr"/);
  assert.match(wxml, /wx:elif="\{\{item\.type === 'table'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-table"/);
  assert.match(wxml, /wx:elif="\{\{item\.type === 'image'\}\}"[\s\S]*class="content-block content-block--\{\{item\.spacing\}\} content-image-wrap"/);
  assert.match(wxml, /class="detail-actions"[\s\S]*wx:if="\{\{diary\.canEdit\}\}"/);
  assert.match(wxml, /bindtap="editDiary"/);
  assert.match(wxml, /bindtap="deleteDiary"/);
  assert.match(wxml, />编辑日记</);
  assert.match(wxml, /删除/);
  assert.match(wxml, /detail-actions[\s\S]*snowlit-end-tip/);
  assert.match(wxml, /bindtap="previewPhoto"/);
  assert.match(wxss, /\.content-image-wrap[\s\S]*align-items: center/);
  assert.match(wxss, /\.content-image[\s\S]*width: 50%/);
  assert.equal(wxss.includes('.content-block + .content-block'), false);
  assert.match(wxss, /\.content-block--spaced[\s\S]*margin-top: 14rpx/);
  assert.match(wxss, /\.content-block--tight[\s\S]*margin-top: 0/);
  assert.match(wxss, /\.content-text[\s\S]*line-height: 44rpx/);
  assert.match(wxss, /\.content-quote[\s\S]*border-left: 5rpx solid/);
  assert.match(wxss, /\.content-list-item[\s\S]*display: flex/);
  assert.match(wxss, /\.content-code[\s\S]*white-space: pre-wrap/);
  assert.match(wxss, /\.content-hr[\s\S]*border-top: 1rpx dashed/);
  assert.match(wxss, /\.content-table-row[\s\S]*display: flex/);
  assert.match(wxss, /\.detail-actions[\s\S]*display: grid/);
  assert.match(wxss, /\.detail-action--delete[\s\S]*color:/);
  assert.equal(wxss.includes('.photo-section'), false);
  assert.equal(wxss.includes('.content-image-caption'), false);
}

runMonthIndexTest();
runJumpYearsTest();
runSectionTest();
runApplyFilterTest();
runNextMonthTest();
runDetailMappingTest();
runDiaryTemplateTest();
runDiaryDetailTemplateTest();

console.log('diary-presenter tests passed');
