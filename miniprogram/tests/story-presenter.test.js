const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildStoryQuery,
  findStoryMoment,
  mapClusterMarker,
  mapStoryDetail,
  mapStoryPage
} = require('../pages/story/story-presenter');

const ITEMS = [
  {
    id: 1,
    title: '雨后的散步',
    content: '湖边的风慢下来，云也很轻。\n灯一盏一盏亮起来。',
    eventTime: '2026-05-25T18:20:00',
    locationName: '示例公园',
    longitude: 18.7967,
    latitude: 12.0701,
    category: 'travel',
    images: ['https://snowlit.example.com/media/story/lake.webp']
  },
  {
    id: 2,
    title: '春天的小花',
    content: '',
    eventTime: '2025-04-12T10:05:00',
    locationName: '',
    address: '示例街区',
    category: 'daily',
    images: []
  },
  {
    id: 3,
    title: '同月更早',
    eventTime: '2026-05-02T09:00:00',
    longitude: 18.8,
    latitude: 12.1,
    category: 'date'
  },
  {
    id: 4,
    title: ''
  }
];

function runTimelineTest() {
  const result = mapStoryPage({ items: ITEMS, canManage: true });

  assert.equal(result.canManage, true);
  assert.equal(result.hasMoments, true);
  // Newest first, grouped by month; a drop with no date goes last.
  assert.deepEqual(result.sections.map((section) => [section.month, section.countText, section.moments.map((m) => m.id)]), [
    ['2026-05', '2 个', [1, 3]],
    ['2025-04', '1 个', [2]],
    ['undated', '1 个', [4]]
  ]);
  assert.deepEqual(
    result.sections.map((section) => [section.anchorId, section.yearText, section.monthText, section.dated]),
    [
      ['month-2026-05', '2026', '05', true],
      ['month-2025-04', '2025', '04', true],
      ['month-undated', '', '未注明日期', false]
    ]
  );
  assert.deepEqual(result.sections[0].moments[0], {
    id: 1,
    month: '2026-05',
    date: '05.25',
    title: '雨后的散步',
    locationName: '示例公园',
    categoryLabel: '旅行',
    time: '18:20',
    summary: '湖边的风慢下来，云也很轻。',
    image: 'https://snowlit.example.com/media/story/lake.webp',
    placed: true
  });
  // No stand-in photos or placeholder places: missing ones stay empty.
  const spring = result.sections[1].moments[0];
  assert.equal(spring.image, '');
  assert.equal(spring.locationName, '示例街区');
  assert.equal(result.sections[2].moments[0].title, '未命名点滴');
  assert.equal(result.sections[2].moments[0].locationName, '');
  // Only dated drops feed the month jump sheet.
  assert.deepEqual(result.months, ['2026-05', '2026-05', '2025-04']);
  assert.equal(findStoryMoment(result.sections, '3').title, '同月更早');
  assert.equal(findStoryMoment(result.sections, 99), null);
}

function runMarkersTest() {
  const result = mapStoryPage({ items: ITEMS });

  // Drops with coordinates become markers the native map clusters itself.
  assert.deepEqual(result.markers.map((marker) => [marker.id, marker.momentId, marker.joinCluster]), [[1, 1, true], [3, 3, true]]);
  assert.deepEqual(result.markers[0].anchor, { x: 0.5, y: 1 });
  assert.equal(result.unplacedCount, 2);
  assert.deepEqual(result.mapIncludePoints, [
    { latitude: 12.0701, longitude: 18.7967 },
    { latitude: 12.1, longitude: 18.8 }
  ]);

  const cluster = mapClusterMarker({ clusterId: 7, center: { latitude: 1, longitude: 2 }, markerIds: [1, 3] });
  assert.equal(cluster.clusterId, 7);
  assert.equal(cluster.latitude, 1);
  assert.equal(cluster.longitude, 2);
  assert.equal(cluster.label.content, '2');
  assert.equal(cluster.label.bgColor, '#1d2433');
  assert.equal(cluster.label.anchorX, -cluster.label.width / 2);
}

function runStoryDetailMappingTest() {
  const result = mapStoryDetail({
    id: 1,
    title: '雨后的散步',
    content: '湖边的风慢下来，云也很轻。\n\n灯一盏一盏亮起来。',
    eventTime: '2026-05-25T18:20:00',
    endTime: '2026-05-25T19:10:00',
    locationName: '示例公园',
    address: '示例城市示例街区示例路',
    longitude: 18.7967,
    latitude: 12.0701,
    category: 'travel',
    createdByUserId: 1,
    images: [
      'https://snowlit.example.com/media/story/lake.webp',
      'https://snowlit.example.com/media/story/evening.webp'
    ],
    updatedAt: '2026-05-25T20:18:00'
  }, { canManage: true });

  assert.deepEqual(result, {
    id: 1,
    canManage: true,
    title: '雨后的散步',
    date: '2026.05.25',
    timeRange: '18:20 - 19:10',
    categoryLabel: '旅行',
    locationName: '示例公园',
    address: '示例城市示例街区示例路',
    coordinate: '18.797, 12.070',
    updatedAt: '2026.05.25 20:18',
    contentLines: ['湖边的风慢下来，云也很轻。', '灯一盏一盏亮起来。'],
    images: [
      'https://snowlit.example.com/media/story/lake.webp',
      'https://snowlit.example.com/media/story/evening.webp'
    ],
    hasImages: true,
    photoMain: 'https://snowlit.example.com/media/story/lake.webp',
    photoThumbs: [
      { index: 1, url: 'https://snowlit.example.com/media/story/evening.webp' }
    ]
  });
  assert.equal(mapStoryDetail({ title: '只读点滴' }, { canManage: false }).canManage, false);
}

function runBuildStoryQueryTest() {
  assert.deepEqual(buildStoryQuery('all'), {});
  assert.deepEqual(buildStoryQuery('travel'), { category: 'travel' });
  assert.deepEqual(buildStoryQuery('unknown'), {});
}

function runStoryTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxss'), 'utf8');
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../pages/story/index.json'), 'utf8'));
  const js = fs.readFileSync(path.join(__dirname, '../pages/story/index.js'), 'utf8');

  // List first, with the same heading as the tab pages and a switch to the map.
  assert.match(wxml, /class="snowlit-page-title snowlit-kai">点滴</);
  assert.match(wxml, /data-view="list"[\s\S]*data-view="map"/);
  assert.match(wxml, /wx:for="\{\{sections\}\}"[\s\S]*class="month-head"[\s\S]*bindtap="handleMonthHeadTap"/);
  assert.match(wxml, /<snowlit-month-sheet[\s\S]*bind:select="handleJumpSelect"/);
  assert.match(wxss, /\.month-head \{[^}]*position: sticky;[^}]*top: 150rpx;/);
  assert.equal(json.usingComponents['snowlit-month-sheet'], '/components/snowlit-month-sheet/index');
  assert.equal(json.disableScroll, undefined);

  // The map is only in the map view, never resized by gestures, and clustering is native.
  assert.match(wxml, /<view class="map-stage" wx:else>[\s\S]*<map[\s\S]*id="storyMap"/);
  assert.equal(/bindregionchange|bindtouchmove|markers="/.test(wxml), false);
  assert.match(js, /initMarkerCluster/);
  assert.match(js, /markerClusterCreate/);
  assert.match(wxml, /class="map-card[^"]*"[\s\S]*bindtap="goDetail"/);
  assert.match(wxml, /class="map-note"[\s\S]*bindtap="showList"/);
  assert.match(wxml, /wx:if="\{\{canManage && view === 'list'\}\}" bindtap="goCreate"/);
}

function runStoryDetailActionsTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/story-detail/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/story-detail/index.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../pages/story-detail/index.js'), 'utf8');

  assert.match(wxml, /class="detail-actions"[\s\S]*wx:if="\{\{moment\.canManage\}\}"/);
  assert.match(wxml, /bindtap="editMoment"/);
  assert.match(wxml, /bindtap="deleteMoment"/);
  assert.match(wxml, />编辑点滴</);
  assert.match(wxml, /删除/);
  assert.match(wxml, /detail-actions[\s\S]*snowlit-end-tip/);
  assert.match(wxss, /\.detail-actions[\s\S]*display: grid/);
  assert.match(wxss, /\.detail-action--delete[\s\S]*color:/);
  assert.equal(js.includes('deleteMoment: deleteStoryMoment'), true);
  assert.equal(js.includes('getStoredUser'), true);
  assert.equal(js.includes('showConfirm'), true);
  assert.equal(js.includes('editMoment()'), true);
  assert.equal(js.includes('deleteMoment()'), true);
}

runTimelineTest();
runMarkersTest();
runStoryDetailMappingTest();
runBuildStoryQueryTest();
runStoryTemplateTest();
runStoryDetailActionsTest();

console.log('story-presenter tests passed');
