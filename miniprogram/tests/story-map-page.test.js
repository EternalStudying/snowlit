const assert = require('node:assert/strict');
const { test } = require('node:test');

function clearStoryModules() {
  [
    '../pages/story/index.js',
    '../pages/story/story-presenter.js',
    '../services/story.js',
    '../utils/request.js',
    '../utils/notify.js'
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
}

const ITEMS = [
  { id: 11, title: '湖边', eventTime: '2026-05-25T18:20:00', latitude: 30.1, longitude: 120.1, category: 'travel', images: ['https://snowlit.example.com/a.webp'] },
  { id: 12, title: '咖啡', eventTime: '2026-04-02T10:00:00', latitude: 30.2, longitude: 120.2, category: 'date' },
  { id: 13, title: '没有地点', eventTime: '2025-12-01T09:00:00', category: 'daily' }
];

function createStoryPage() {
  clearStoryModules();
  let pageDefinition;
  const requests = [];
  const scrolls = [];
  const map = { clusterOptions: null, handlers: {}, addCalls: [], includeCalls: [] };

  global.Page = (definition) => {
    pageDefinition = definition;
  };
  global.getCurrentPages = () => [{}];
  global.wx = {
    getStorageSync: () => '',
    getWindowInfo: () => ({ windowWidth: 375 }),
    pageScrollTo: (options) => scrolls.push(options),
    navigateTo() {},
    navigateBack() {},
    switchTab() {},
    request(options) {
      requests.push(options.url);
      const category = (options.url.match(/category=(\w+)/) || [])[1];
      const items = category ? ITEMS.filter((item) => item.category === category) : ITEMS;
      options.success({ statusCode: 200, data: { items, canManage: true } });
    },
    createMapContext() {
      return {
        initMarkerCluster(options) {
          map.clusterOptions = options;
        },
        on(name, handler) {
          map.handlers[name] = handler;
        },
        addMarkers(options) {
          map.addCalls.push(options);
        },
        includePoints(options) {
          map.includeCalls.push(options);
        }
      };
    }
  };

  require('../pages/story/index.js');
  const page = {
    ...pageDefinition,
    data: JSON.parse(JSON.stringify(pageDefinition.data)),
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) {
        callback();
      }
    }
  };
  return { page, requests, scrolls, map };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test.afterEach(() => {
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
});

test('opens on the list, newest month first, with nothing hidden behind a map', async () => {
  const { page } = createStoryPage();
  page.onLoad();
  await settle();

  assert.equal(page.data.view, 'list');
  assert.deepEqual(page.data.sections.map((section) => section.month), ['2026-05', '2026-04', '2025-12']);
  assert.equal(page.data.unplacedCount, 1);
  assert.equal(page.data.canManage, true);
});

test('a category refetches from the server and keeps the view', async () => {
  const { page, requests } = createStoryPage();
  page.onLoad();
  await settle();

  page.handleFilterTap({ currentTarget: { dataset: { value: 'date' } } });
  await settle();
  assert.match(requests[requests.length - 1], /category=date/);
  assert.deepEqual(page.data.sections.map((section) => section.moments.map((moment) => moment.id)), [[12]]);
  assert.equal(page.data.filters.find((filter) => filter.active).value, 'date');
});

test('the map view hands markers to native clustering and fits them once', async () => {
  const { page, map } = createStoryPage();
  page.onLoad();
  await settle();

  page.handleViewTap({ currentTarget: { dataset: { view: 'map' } } });
  assert.equal(page.data.view, 'map');
  assert.deepEqual(map.clusterOptions, { enableDefaultStyle: false, zoomOnClick: true, gridSize: 60 });
  assert.equal(map.addCalls[0].clear, true);
  assert.deepEqual(map.addCalls[0].markers.map((marker) => [marker.id, marker.joinCluster]), [[11, true], [12, true]]);
  assert.equal(map.includeCalls.length, 1);

  // The native map asks for cluster bubbles; they are drawn in Snowlit's ink.
  map.handlers.markerClusterCreate({ clusters: [{ clusterId: 1, center: { latitude: 30.15, longitude: 120.15 }, markerIds: [11, 12] }] });
  const bubbles = map.addCalls[map.addCalls.length - 1];
  assert.equal(bubbles.clear, false);
  assert.equal(bubbles.markers[0].clusterId, 1);
  assert.equal(bubbles.markers[0].label.content, '2');
});

test('tapping a marker opens its card; tapping the map closes it, but not the echo of the marker tap', async () => {
  const { page } = createStoryPage();
  page.onLoad();
  await settle();
  page.handleViewTap({ currentTarget: { dataset: { view: 'map' } } });

  page.handleMarkerTap({ detail: { markerId: 12 } });
  assert.equal(page.data.selectedMoment.title, '咖啡');
  page.handleMapTap();
  assert.equal(page.data.selectedMoment.title, '咖啡', 'the same tap reaching the map is ignored');

  page.lastMarkerTapAt = 0;
  page.handleMapTap();
  assert.equal(page.data.selectedMoment, null);

  page.handleMarkerTap({ detail: { markerId: 999 } });
  assert.equal(page.data.selectedMoment, null, 'cluster bubbles and unknown markers open nothing');
});

test('the month sheet lists only dated months and jumps under the sticky heading', async () => {
  const { page, scrolls } = createStoryPage();
  page.onLoad();
  await settle();

  page.handleMonthHeadTap({ currentTarget: { dataset: { month: '2026-05', dated: true } } });
  assert.equal(page.data.jumpVisible, true);
  assert.deepEqual(page.data.jumpYears.map((year) => year.year), ['2026', '2025']);
  assert.equal(page.data.jumpYears[0].months[4].active, true);

  page.handleJumpSelect({ detail: { month: '2025-12' } });
  assert.equal(page.data.jumpVisible, false);
  assert.deepEqual(scrolls[scrolls.length - 1], { selector: '#month-2025-12', offsetTop: -75, duration: 260 });
});

test('returning to the list after the map rebuilds the map context next time', async () => {
  const { page, map } = createStoryPage();
  page.onLoad();
  await settle();
  page.handleViewTap({ currentTarget: { dataset: { view: 'map' } } });
  page.showList();
  assert.equal(page.data.view, 'list');
  map.clusterOptions = null;
  page.handleViewTap({ currentTarget: { dataset: { view: 'map' } } });
  assert.ok(map.clusterOptions, 'a fresh map gets clustering again');
});
