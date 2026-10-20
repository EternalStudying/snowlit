const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildStoryQuery,
  clusterStoryMarkers,
  createStoryMapSnapPoints,
  mapStoryLayoutByDrag,
  mapStoryLayoutByIndex,
  mapStoryLayoutByScroll,
  mapStoryDetail,
  mapStoryPage,
  STORY_CLUSTER_EXPANDED_SCALE
} = require('../pages/story/story-presenter');

function runStoryPageMappingTest() {
  const result = mapStoryPage({
    items: [
      {
        id: 1,
        title: '雨后的散步',
        content: '湖边的风慢下来，云也很轻。\n灯一盏一盏亮起来。',
        eventTime: '2026-05-25T18:20:00',
        endTime: '2026-05-25T19:10:00',
        locationName: '示例公园',
        address: '示例城市示例街区',
        longitude: 18.7967,
        latitude: 12.0701,
        category: 'travel',
        createdByUserId: 1,
        images: ['https://snowlit.example.com/media/story/lake.webp'],
        updatedAt: '2026-05-25T20:18:00'
      },
      {
        id: 2,
        title: '春天的小花',
        content: '',
        eventTime: '2025-04-12T10:05:00',
        locationName: '家附近',
        longitude: -0.165,
        latitude: 51.5064,
        category: 'daily',
        createdByUserId: 2,
        images: []
      }
    ],
    years: [2026, 2025, 2024],
    canManage: true
  }, 2, 'all');

  assert.equal(result.canManage, true);
  assert.equal(result.selectedMomentId, 2);
  assert.equal(result.hasMoments, true);
  assert.deepEqual(result.years, [
    { label: '全部', value: 'all', active: true },
    { label: '2026', value: 2026, active: false },
    { label: '2025', value: 2025, active: false }
  ]);
  assert.deepEqual(result.moments[0], {
    id: 1,
    selected: false,
    date: '05.25',
    title: '雨后的散步',
    locationName: '示例公园',
    category: 'travel',
    categoryLabel: '旅行',
    time: '18:20',
    summary: '湖边的风慢下来，云也很轻。',
    image: 'https://snowlit.example.com/media/story/lake.webp'
  });
  assert.equal(result.moments[1].selected, true);
  assert.equal(result.moments[1].image, '../../assets/story/moment-evening.png');
  assert.deepEqual(result.markers, [
    {
      id: 1,
      momentId: 1,
      locationLabel: '示例公园',
      title: '示例公园',
      latitude: 12.0701,
      longitude: 18.7967,
      iconPath: '/assets/icons/story/map-pin-filled.png',
      width: 22,
      height: 22,
      active: false,
      callout: {
        content: '示例公园',
        color: '#555e70',
        fontSize: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#dce2ea',
        bgColor: '#ffffff',
        padding: 8,
        display: 'ALWAYS',
        textAlign: 'center'
      }
    },
    {
      id: 2,
      momentId: 2,
      locationLabel: '家附近',
      title: '家附近',
      latitude: 51.5064,
      longitude: -0.165,
      iconPath: '/assets/icons/story/map-pin-filled.png',
      width: 22,
      height: 22,
      active: true,
      callout: {
        content: '家附近',
        color: '#1d2433',
        fontSize: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1d2433',
        bgColor: '#ffffff',
        padding: 8,
        display: 'ALWAYS',
        textAlign: 'center'
      }
    }
  ]);
  assert.deepEqual(result.mapCenter, {
    latitude: 51.5064,
    longitude: -0.165
  });
  assert.deepEqual(result.mapIncludePoints, [
    { latitude: 12.0701, longitude: 18.7967 },
    { latitude: 51.5064, longitude: -0.165 }
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(result.markers[0], 'label'), false);
}

function runStoryPageSkipsInvalidMapCoordinatesTest() {
  const result = mapStoryPage({
    items: [
      {
        id: 8,
        title: '没有坐标的点滴',
        eventTime: '2026-05-25T18:20:00',
        locationName: '未知地点',
        longitude: '',
        latitude: null,
        category: 'daily'
      }
    ]
  }, '', 'all');

  assert.equal(result.hasMoments, true);
  assert.deepEqual(result.markers, []);
  assert.deepEqual(result.mapIncludePoints, []);
  assert.deepEqual(result.mapCenter, {
    latitude: 0,
    longitude: 0
  });
}

function runStoryPageClustersNearbyMarkersTest() {
  const result = mapStoryPage({
    items: [
      {
        id: 11,
        title: '湖边',
        eventTime: '2026-05-25T18:20:00',
        locationName: '伦敦海德公园湖边',
        longitude: -0.1751,
        latitude: 51.5051,
        category: 'travel'
      },
      {
        id: 12,
        title: '咖啡',
        eventTime: '2026-05-25T19:20:00',
        locationName: '海德公园湖畔咖啡',
        longitude: -0.1742,
        latitude: 51.5055,
        category: 'daily'
      },
      {
        id: 13,
        title: '远一点',
        eventTime: '2026-05-26T10:20:00',
        locationName: '伦敦北部',
        longitude: -0.1402,
        latitude: 51.541,
        category: 'daily'
      }
    ]
  }, '', 'all');

  assert.equal(Array.isArray(result.rawMarkers), true);
  assert.equal(result.rawMarkers.length, 3);
  assert.equal(result.markers.length, 2);
  assert.equal(result.mapScale, 10);
  assert.deepEqual(result.markers[0], {
    id: 1000000000,
    cluster: true,
    clusterCount: 2,
    clusterMomentIds: [11, 12],
    clusterIncludePoints: [
      { latitude: 51.5051, longitude: -0.1751 },
      { latitude: 51.5055, longitude: -0.1742 }
    ],
    locationLabel: '2个点滴',
    title: '2个点滴',
    latitude: 51.5053,
    longitude: -0.17465,
    iconPath: '/assets/icons/story/map-cluster.png',
    width: 30,
    height: 30,
    active: true,
    callout: {
      content: '2个点滴',
      color: '#1d2433',
      fontSize: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#1d2433',
      bgColor: '#ffffff',
      padding: 8,
      display: 'ALWAYS',
      textAlign: 'center'
    }
  });
  assert.equal(result.markers[1].momentId, 13);
  assert.deepEqual(
    clusterStoryMarkers(result.rawMarkers, result.selectedMomentId, result.mapScale).map((item) => item.clusterCount || 1),
    [2, 1]
  );
  assert.deepEqual(
    clusterStoryMarkers(result.rawMarkers, result.selectedMomentId, STORY_CLUSTER_EXPANDED_SCALE).map((item) => item.momentId),
    [11, 12, 13]
  );
  assert.deepEqual(result.mapIncludePoints, [
    { latitude: 51.5051, longitude: -0.1751 },
    { latitude: 51.5055, longitude: -0.1742 },
    { latitude: 51.541, longitude: -0.1402 }
  ]);
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
  assert.deepEqual(buildStoryQuery('all', 'all'), {});
  assert.deepEqual(buildStoryQuery('travel', 'all'), { category: 'travel' });
  assert.deepEqual(buildStoryQuery('all', 2026), { year: 2026 });
  assert.deepEqual(buildStoryQuery('daily', 2025), { category: 'daily', year: 2025 });
}

function runStoryMapSnapLayoutTest() {
  const snapPoints = createStoryMapSnapPoints(1334);

  assert.equal(snapPoints.length, 5);
  assert.deepEqual(snapPoints.map((item) => item.key), [
    'fullMap',
    'largeMap',
    'balanced',
    'largeList',
    'fullList'
  ]);
  assert.deepEqual(snapPoints.map((item) => item.mapHeightRpx), [1098, 824, 549, 275, 0]);

  assert.deepEqual(mapStoryLayoutByIndex(1334, 0), {
    mapTopOffsetRpx: 160,
    mapHeightRpx: 1098,
    sheetHeightRpx: 0,
    mapSnapIndex: 0,
    mapSnapKey: 'fullMap',
    sheetPanOffsetRpx: 0,
    sheetScrollEnabled: false
  });
  assert.deepEqual(mapStoryLayoutByIndex(1334, 4), {
    mapTopOffsetRpx: 160,
    mapHeightRpx: 0,
    sheetHeightRpx: 1098,
    mapSnapIndex: 4,
    mapSnapKey: 'fullList',
    sheetPanOffsetRpx: 760,
    sheetScrollEnabled: true
  });
  assert.deepEqual(mapStoryLayoutByScroll(1334, 380), {
    mapTopOffsetRpx: 160,
    mapHeightRpx: 549,
    sheetHeightRpx: 549,
    mapSnapIndex: 2,
    mapSnapKey: 'balanced',
    sheetPanOffsetRpx: 380,
    sheetScrollEnabled: false
  });
  assert.deepEqual(mapStoryLayoutByDrag(1334, 0, -190), {
    mapTopOffsetRpx: 160,
    mapHeightRpx: 824,
    sheetHeightRpx: 274,
    mapSnapIndex: 1,
    mapSnapKey: 'largeMap',
    sheetPanOffsetRpx: 190,
    sheetScrollEnabled: false
  });
  assert.deepEqual(mapStoryLayoutByDrag(1334, 0, -760), {
    mapTopOffsetRpx: 160,
    mapHeightRpx: 0,
    sheetHeightRpx: 1098,
    mapSnapIndex: 4,
    mapSnapKey: 'fullList',
    sheetPanOffsetRpx: 760,
    sheetScrollEnabled: true
  });
}

function runStoryFilterTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxml'), 'utf8');

  assert.equal(wxml.includes('class="year-row"'), false);
  assert.equal(wxml.includes('class="year-dropdown"'), true);
  assert.equal(wxml.includes('wx:if="{{yearDropdownOpen}}"'), true);
  assert.equal(wxml.includes('bindtap="handleYearTap"'), true);
}

function runStoryAddButtonStyleTest() {
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxss'), 'utf8');
  const storyAddRule = wxss.match(/\.story-add\s*\{[\s\S]*?\n\}/);

  assert.ok(storyAddRule, 'story add button style should exist');
  assert.match(storyAddRule[0], /position:\s*fixed;/);
  assert.match(storyAddRule[0], /bottom:\s*calc\(44rpx \+ env\(safe-area-inset-bottom\)\);/);
  assert.doesNotMatch(storyAddRule[0], /top:\s*796rpx;/);
}

function runStoryFilterStyleTest() {
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxss'), 'utf8');
  const filterAreaRule = wxss.match(/\.filter-area\s*\{[\s\S]*?\n\}/);
  const categoryRowRule = wxss.match(/\.category-row\s*\{[\s\S]*?\n\}/);
  const yearChipRule = wxss.match(/\.year-chip\s*\{[\s\S]*?\n\}/);

  assert.ok(filterAreaRule, 'filter area style should exist');
  assert.ok(categoryRowRule, 'category row style should exist');
  assert.ok(yearChipRule, 'year chip style should exist');
  assert.match(filterAreaRule[0], /background:\s*#ebeff5;/);
  assert.match(categoryRowRule[0], /background:\s*#ebeff5;/);
  assert.match(yearChipRule[0], /display:\s*flex;/);
  assert.match(yearChipRule[0], /align-items:\s*center;/);
  assert.match(yearChipRule[0], /justify-content:\s*center;/);
  assert.match(yearChipRule[0], /line-height:\s*1;/);
}

function runStoryMapChromeTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxss'), 'utf8');

  assert.equal(wxml.includes('class="page-head'), false);
  assert.equal(wxml.includes('snowlit-subpage-heading'), false);
  assert.equal(wxml.includes('snowlit-subpage-brand'), false);
  assert.equal(wxml.includes('snowlit-subpage-title'), false);
  assert.equal(wxml.includes('snowlit-subpage-subtitle'), false);
  assert.equal(wxml.includes('map-tool'), false);
  assert.equal(wxml.includes('handleLocateTap'), false);
  assert.equal(wxml.includes('handleListTap'), false);
  assert.equal(wxml.includes('current-location.svg'), false);
  assert.equal(wxml.includes('assets/icons/story/list.svg'), false);
  assert.equal(wxss.includes('.page-head'), false);
  assert.equal(wxss.includes('.map-tool'), false);
  assert.equal(wxss.includes('.story-brand'), false);
  assert.equal(wxss.includes('.story-title'), false);
  assert.equal(wxss.includes('.story-subtitle'), false);
}

function runStoryNativeMapTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/story/index.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../pages/story/index.js'), 'utf8');
  const presenterJs = fs.readFileSync(path.join(__dirname, '../pages/story/story-presenter.js'), 'utf8');
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../pages/story/index.json'), 'utf8'));
  const markerPng = fs.readFileSync(path.join(__dirname, '../assets/icons/story/map-pin-filled.png'));
  const clusterPng = fs.readFileSync(path.join(__dirname, '../assets/icons/story/map-cluster.png'));
  const mapStageRule = wxss.match(/\.map-stage\s*\{[\s\S]*?\n\}/);

  assert.match(wxml, /<map[\s\S]*id="storyMap"[\s\S]*markers="\{\{markers\}\}"/);
  assert.match(wxml, /<map[\s\S]*wx:if="\{\{mapHeightRpx > 0\}\}"/);
  assert.equal(wxml.indexOf('class="top-action"') < wxml.indexOf('<map'), true);
  assert.match(wxml, /latitude="\{\{mapCenter\.latitude\}\}"/);
  assert.match(wxml, /longitude="\{\{mapCenter\.longitude\}\}"/);
  assert.match(wxml, /scale="\{\{mapScale\}\}"/);
  assert.equal(wxml.includes('include-points="{{mapIncludePoints}}"'), false);
  assert.match(wxml, /bindregionchange="handleMapRegionChange"/);
  assert.match(wxml, /bindmarkertap="handleMarkerTap"/);
  assert.match(wxml, /<view[\s\S]*class="map-stage"[\s\S]*style="margin-top: \{\{mapTopOffsetRpx\}\}rpx; height: \{\{mapHeightRpx\}\}rpx;"/);
  assert.match(wxml, /<view[^>]*class="filter-area"[^>]*bindtouchstart="handleMomentSheetTouchStart"[^>]*bindtouchmove="handleMomentSheetTouchMove"[^>]*bindtouchend="handleMomentSheetTouchEnd"/);
  assert.match(wxml, /<view[\s\S]*class="moment-sheet-frame"[\s\S]*style="height: \{\{sheetHeightRpx\}\}rpx;"/);
  assert.match(wxml, /bindtouchstart="handleMomentSheetTouchStart"/);
  assert.match(wxml, /bindtouchmove="handleMomentSheetTouchMove"/);
  assert.match(wxml, /bindtouchend="handleMomentSheetTouchEnd"/);
  assert.match(wxml, /<scroll-view[\s\S]*class="moment-sheet"[\s\S]*scroll-y="\{\{sheetScrollEnabled\}\}"/);
  assert.match(wxml, /scroll-top="\{\{sheetScrollTop\}\}"/);
  assert.match(wxml, /bindscroll="handleMomentSheetScroll"/);
  assert.equal(wxml.includes('bindrefresherrefresh'), false);
  assert.equal(wxml.includes('refresher-enabled'), false);
  assert.equal(wxml.includes('refresher-triggered'), false);
  assert.match(wxml, /style="height: 100%;"/);
  assert.equal(wxml.includes('style="left: {{item.left}}%; top: {{item.top}}%;"'), false);
  assert.equal(wxml.includes('wx:for="{{markers}}"'), false);
  assert.equal(wxml.includes('class="map-texture"'), false);
  assert.equal(json.disableScroll, true);
  assert.equal(json.enablePullDownRefresh, false);
  assert.ok(mapStageRule, 'map stage style should exist');
  assert.doesNotMatch(mapStageRule[0], /transition:\s*height\b/);
  assert.equal(wxss.includes('.native-map'), true);
  assert.match(wxss, /\.story-map-page[\s\S]*height:\s*100vh;/);
  assert.match(wxss, /\.story-map-page[\s\S]*overflow:\s*hidden;/);
  assert.equal(wxss.includes('.map-marker'), false);
  assert.equal(js.includes('event.detail.markerId'), true);
  assert.equal(presenterJs.includes("const MAP_PIN_ICON = '/assets/icons/story/map-pin-filled.png';"), true);
  assert.equal(presenterJs.includes("const MAP_PIN_ICON = '../../assets/icons/story/map-pin-filled.svg';"), false);
  assert.equal(presenterJs.includes("const MAP_CLUSTER_ICON = '/assets/icons/story/map-cluster.png';"), true);
  assert.equal(js.includes('expandStoryCluster'), true);
  assert.equal(js.includes('mapScale: STORY_CLUSTER_EXPANDED_SCALE'), true);
  assert.equal(js.includes('handleMapRegionChange'), true);
  assert.equal(js.includes('clusterStoryMarkers(this.data.rawMarkers'), true);
  assert.equal(markerPng.toString('ascii', 1, 4), 'PNG');
  assert.equal(markerPng.readUInt32BE(16), 72);
  assert.equal(markerPng.readUInt32BE(20), 72);
  assert.equal(clusterPng.toString('ascii', 1, 4), 'PNG');
  assert.equal(clusterPng.readUInt32BE(16), 72);
  assert.equal(clusterPng.readUInt32BE(20), 72);
  assert.equal(js.includes("wx.createMapContext('storyMap', this)"), true);
  assert.equal(js.includes('includePoints'), true);
  assert.equal(js.includes('this.fitMapToMarkers();'), false);
  assert.equal(js.includes('createStoryMapSnapPoints'), true);
  assert.equal(js.includes('mapStoryLayoutByDrag'), true);
  assert.equal(js.includes('mapStoryLayoutByScroll'), true);
  assert.equal(js.includes('handleMomentSheetScroll'), true);
  assert.equal(js.includes('handleMomentSheetTouchMove'), true);
  assert.equal(js.includes('onPullDownRefresh'), false);
  assert.equal(js.includes('handleMomentSheetRefresh'), false);
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

runStoryPageMappingTest();
runStoryPageSkipsInvalidMapCoordinatesTest();
runStoryPageClustersNearbyMarkersTest();
runStoryDetailMappingTest();
runBuildStoryQueryTest();
runStoryMapSnapLayoutTest();
runStoryFilterTemplateTest();
runStoryAddButtonStyleTest();
runStoryFilterStyleTest();
runStoryMapChromeTemplateTest();
runStoryNativeMapTemplateTest();
runStoryDetailActionsTest();

console.log('story-presenter tests passed');
