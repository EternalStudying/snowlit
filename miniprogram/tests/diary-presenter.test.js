const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  mapDiaryDetail,
  mapDiaryMonth,
  mapDiaryMonths
} = require('../pages/diary/diary-presenter');

function runMonthsMappingTest() {
  const result = mapDiaryMonths({
    years: [
      {
        year: 2026,
        months: [
          { month: '2026-04', count: 1, hasEntries: true },
          { month: '2026-05', count: 2, hasEntries: true },
          { month: '2026-06', count: 0, hasEntries: false }
        ]
      },
      {
        year: 2025,
        months: [
          { month: '2025-12', count: 1, hasEntries: true }
        ]
      }
    ]
  }, '', { now: '2026-05-27' });

  assert.equal(result.selectedMonth, '2026-05');
  assert.equal(result.activeMonthAnchor, 'month-2026-05');
  assert.equal(result.monthTabs.length, 12);
  assert.deepEqual(result.monthTabs.slice(0, 6), [
    { value: '2026-01', label: '01', active: false, count: 0, hasEntries: false },
    { value: '2026-02', label: '02', active: false, count: 0, hasEntries: false },
    { value: '2026-03', label: '03', active: false, count: 0, hasEntries: false },
    { value: '2026-04', label: '04', active: false, count: 1, hasEntries: true },
    { value: '2026-05', label: '05', active: true, count: 2, hasEntries: true },
    { value: '2026-06', label: '06', active: false, count: 0, hasEntries: false }
  ]);
  assert.deepEqual(result.monthTabs[11], {
    value: '2026-12',
    label: '12',
    active: false,
    count: 0,
    hasEntries: false
  });

  const selected = mapDiaryMonths({ years: [] }, '2025-12', { now: '2026-05-27' });
  assert.equal(selected.selectedMonth, '2025-12');
  assert.equal(selected.monthTabs[11].active, true);
}

function runMonthMappingTest() {
  const result = mapDiaryMonth({
    month: '2026-05',
    items: [
      {
        id: 1,
        role: 'girlfriend',
        authorName: '伴侣 B',
        title: '有图共享日记',
        summary: '今天路过集市，买了一束花。',
        imageUrls: ['https://snowlit.example.com/media/diary/flower.webp'],
        entryDate: '2026-05-27',
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
        entryDate: '2026-05-26',
        moodKey: 'calm',
        locationName: '',
        weather: '',
        visibility: 'private'
      }
    ]
  }, 'all', 'girlfriend');

  assert.equal(result.monthTitle, '2026.05');
  assert.equal(result.monthCaption, '2 篇日记 · 2 位作者');
  assert.deepEqual(result.stats, [
    { label: '共享', value: '1' },
    { label: '私密', value: '1' },
    { label: '有照片', value: '1' }
  ]);
  assert.deepEqual(result.entries[0], {
    id: 1,
    date: '05.27',
    visibility: '共享',
    title: '有图共享日记',
    summary: '今天路过集市，买了一束花。',
    meta: '伴侣 B · 开心 · 晴 · 集市',
    role: 'girlfriend',
    image: 'https://snowlit.example.com/media/diary/flower.webp'
  });
  assert.equal(mapDiaryMonth({ month: '2026-05', items: result.rawItems }, 'mine', 'girlfriend').entries.length, 1);
  assert.equal(mapDiaryMonth({ month: '2026-05', items: result.rawItems }, 'other', 'girlfriend').entries.length, 1);
  assert.equal(mapDiaryMonth({ month: '2026-05', items: result.rawItems }, 'private', 'girlfriend').entries[0].id, 2);
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

  assert.equal(wxml.includes('class="month-action"'), false);
  assert.equal(wxml.includes('切换月份'), false);
  assert.equal(wxml.includes('{{monthTitle}}'), true);
  assert.equal(wxml.includes('{{monthCaption}}'), true);
  assert.equal(wxml.includes('<scroll-view'), true);
  assert.equal(wxml.includes('scroll-x'), true);
  assert.equal(wxml.includes('scroll-with-animation'), true);
  assert.equal(wxml.includes('scroll-into-view="{{activeMonthAnchor}}"'), true);
  assert.match(wxml, /id="month-\{\{item\.value\}\}"[\s\S]*class="month-tab \{\{item\.active \? 'month-tab--active' : ''\}\}"[\s\S]*data-value="\{\{item\.value\}\}"[\s\S]*bindtap="handleMonthTap"/);
  assert.match(wxml, /class="diary-add"[\s\S]*bindtap="handleCreateDiary"/);
  assert.match(wxml, /assets\/icons\/story\/plus-white\.svg/);
  assert.equal(wxss.includes('.month-action'), false);
  assert.match(wxss, /\.month-scroll[\s\S]*width: 100%/);
  assert.match(wxss, /\.month-tab[\s\S]*flex: 0 0 calc\(\(100vw - 88rpx\) \/ 4\)/);
  assert.match(wxss, /\.diary-add[\s\S]*position: fixed/);
  assert.match(wxss, /\.diary-add[\s\S]*right: 44rpx/);
  assert.match(wxss, /\.diary-add[\s\S]*bottom: calc\(142rpx \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(wxss, /\.diary-add[\s\S]*width: 68rpx/);
  assert.match(wxss, /\.diary-add[\s\S]*height: 68rpx/);
  assert.match(wxss, /\.diary-add__icon[\s\S]*width: 36rpx/);
  assert.match(wxss, /\.diary-add__icon[\s\S]*height: 36rpx/);
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

runMonthsMappingTest();
runMonthMappingTest();
runDetailMappingTest();
runDiaryTemplateTest();
runDiaryDetailTemplateTest();

console.log('diary-presenter tests passed');
