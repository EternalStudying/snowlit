const assert = require('node:assert/strict');

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

function createStoryPage(mapScale, mapCenter = { latitude: 51.531, longitude: -0.1302 }, options = {}) {
  clearStoryModules();

  let pageDefinition;
  let currentMapScale = mapScale;
  let currentMapCenter = mapCenter;
  let mapContextCallCount = 0;
  const includePointCalls = [];

  global.Page = (definition) => {
    pageDefinition = definition;
  };
  global.getCurrentPages = () => [{}];
  global.wx = {
    createMapContext() {
      mapContextCallCount += 1;
      if (Array.isArray(options.mapContextSequence) && options.mapContextSequence[mapContextCallCount - 1]) {
        return options.mapContextSequence[mapContextCallCount - 1];
      }
      return {
        getScale(options) {
          options.success({ scale: currentMapScale });
        },
        getCenterLocation(options) {
          options.success(currentMapCenter);
        },
        includePoints(options) {
          includePointCalls.push(options.points);
          if (options && typeof options.complete === 'function') {
            options.complete();
          }
        }
      };
    },
    nextTick(callback) {
      callback();
    },
    getWindowInfo() {
      return {
        windowWidth: 375,
        windowHeight: 667
      };
    },
    navigateBack() {},
    switchTab() {},
    navigateTo() {}
  };

  require('../pages/story/index.js');

  return {
    page: {
      ...pageDefinition,
      data: JSON.parse(JSON.stringify(pageDefinition.data)),
      setData(patch, callback) {
        Object.assign(this.data, patch);
        if (typeof callback === 'function') {
          callback();
        }
      }
    },
    setCurrentMapScale(scale) {
      currentMapScale = scale;
    },
    setCurrentMapCenter(center) {
      currentMapCenter = center;
    },
    getIncludePointCalls() {
      return includePointCalls;
    }
  };
}

function storyPageFixture() {
  const { mapStoryPage } = require('../pages/story/story-presenter');
  return mapStoryPage({
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
}

function runRegionChangeReadsActualMapScaleTest() {
  const { page } = createStoryPage(16);
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 10
  });

  page.handleMapRegionChange({
    type: 'end',
    detail: { scale: 10 }
  });

  assert.equal(page.data.mapScale, 16);
  assert.deepEqual(page.data.markers.map((item) => item.momentId), [11, 12, 13]);
}

function runWechatRegionChangeEndReclustersAfterZoomTest() {
  const { page } = createStoryPage(16);
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 10
  });

  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'end',
      causedBy: 'scale',
      scale: 10
    }
  });

  assert.equal(page.data.mapScale, 16);
  assert.deepEqual(page.data.markers.map((item) => item.momentId), [11, 12, 13]);
}

function runNoCauseTwoFingerRegionChangeReclustersAfterZoomTest() {
  const { page } = createStoryPage(16);
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 10
  });

  page.handleMapTouchStart({
    touches: [{ clientY: 120 }, { clientY: 220 }]
  });
  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'begin'
    }
  });
  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'end',
      scale: 10
    }
  });

  assert.equal(page.data.mapScale, 16);
  assert.deepEqual(page.data.markers.map((item) => item.momentId), [11, 12, 13]);
}

function runRegionChangeSyncsCenterAfterDragTest() {
  const { page } = createStoryPage(16, { latitude: 51.541, longitude: -0.1402 });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 16,
    mapCenter: { latitude: 51.5051, longitude: -0.1751 }
  });

  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'end',
      causedBy: 'drag',
      scale: 16
    }
  });

  assert.deepEqual(page.data.mapCenter, { latitude: 51.541, longitude: -0.1402 });
  assert.equal(page.data.mapScale, 16);
}

function runDragRegionChangeDoesNotResyncScaleTest() {
  const { page } = createStoryPage(12, { latitude: 51.541, longitude: -0.1402 });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 16,
    mapCenter: { latitude: 51.5051, longitude: -0.1751 },
    markers: clusterSplitMarkers(fixture)
  });

  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'begin',
      causedBy: 'drag'
    }
  });
  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'end',
      causedBy: 'drag',
      scale: 12
    }
  });

  assert.deepEqual(page.data.mapCenter, { latitude: 51.541, longitude: -0.1402 });
  assert.equal(page.data.mapScale, 16);
  assert.deepEqual(page.data.markers.map((item) => item.momentId), [11, 12, 13]);
}

function runNoCauseSingleFingerRegionChangeDoesNotResyncScaleTest() {
  const { page } = createStoryPage(12, { latitude: 51.541, longitude: -0.1402 });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 16,
    mapCenter: { latitude: 51.5051, longitude: -0.1751 },
    markers: clusterSplitMarkers(fixture)
  });

  page.handleMapTouchStart({
    touches: [{ clientY: 120 }]
  });
  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'begin'
    }
  });
  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'end',
      scale: 12
    }
  });

  assert.deepEqual(page.data.mapCenter, { latitude: 51.541, longitude: -0.1402 });
  assert.equal(page.data.mapScale, 16);
  assert.deepEqual(page.data.markers.map((item) => item.momentId), [11, 12, 13]);
}

function runIncludePointsSyncsMapCenterWithoutChangingScaleTest() {
  const { page } = createStoryPage(8, { latitude: 51.523, longitude: -0.1582 });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 10,
    mapCenter: { latitude: 51.5051, longitude: -0.1751 }
  });

  page.fitMapToMarkers(fixture.mapIncludePoints);

  assert.equal(page.data.mapScale, 10);
  assert.deepEqual(page.data.mapCenter, { latitude: 51.523, longitude: -0.1582 });
}

function runInitialFitKeepsDefaultClusterAfterNativeFitScaleTest() {
  const { page, getIncludePointCalls } = createStoryPage(16, { latitude: 51.523, longitude: -0.1582 });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 10
  });

  page.fitMapToMarkers(fixture.mapIncludePoints);

  assert.equal(getIncludePointCalls().length, 1);
  assert.equal(page.data.mapScale, 10);
  assert.deepEqual(page.data.markers.map((item) => item.clusterCount || 1), [2, 1]);
  assert.deepEqual(page.data.mapCenter, { latitude: 51.523, longitude: -0.1582 });
}

function runInitialFitRetriesWhenNativeMapIsNotReadyTest() {
  const includePointCalls = [];
  const readyMapContext = {
    getScale(options) {
      options.success({ scale: 10 });
    },
    getCenterLocation(options) {
      options.success({ latitude: 51.523, longitude: -0.1582 });
    },
    includePoints(options) {
      includePointCalls.push(options.points);
      if (options && typeof options.complete === 'function') {
        options.complete();
      }
    }
  };
  const { page } = createStoryPage(10, { latitude: 51.523, longitude: -0.1582 }, {
    mapContextSequence: [{}, readyMapContext]
  });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 10
  });

  page.fitMapToMarkers(fixture.mapIncludePoints);

  assert.equal(includePointCalls.length, 1);
  assert.deepEqual(includePointCalls[0], fixture.mapIncludePoints);
}

function runProgrammaticUpdateRegionChangeDoesNotChangeScaleTest() {
  const { page } = createStoryPage(12, { latitude: 51.541, longitude: -0.1402 });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 16,
    markers: clusterSplitMarkers(fixture)
  });

  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'end',
      causedBy: 'update',
      scale: 12
    }
  });

  assert.equal(page.data.mapScale, 16);
  assert.deepEqual(page.data.markers.map((item) => item.momentId), [11, 12, 13]);
}

function runProgrammaticEndWithoutGestureDoesNotChangeScaleTest() {
  const { page } = createStoryPage(12, { latitude: 51.541, longitude: -0.1402 });
  const fixture = storyPageFixture();

  page.setData({
    ...fixture,
    mapScale: 16,
    markers: clusterSplitMarkers(fixture)
  });

  page.handleMapRegionChange({
    type: 'regionchange',
    detail: {
      type: 'end',
      scale: 12
    }
  });

  assert.equal(page.data.mapScale, 16);
  assert.deepEqual(page.data.markers.map((item) => item.momentId), [11, 12, 13]);
}

function clusterSplitMarkers(fixture) {
  const { clusterStoryMarkers } = require('../pages/story/story-presenter');
  return clusterStoryMarkers(fixture.rawMarkers, fixture.selectedMomentId, 16);
}

runRegionChangeReadsActualMapScaleTest();
runWechatRegionChangeEndReclustersAfterZoomTest();
runNoCauseTwoFingerRegionChangeReclustersAfterZoomTest();
runRegionChangeSyncsCenterAfterDragTest();
runDragRegionChangeDoesNotResyncScaleTest();
runNoCauseSingleFingerRegionChangeDoesNotResyncScaleTest();
runIncludePointsSyncsMapCenterWithoutChangingScaleTest();
runInitialFitKeepsDefaultClusterAfterNativeFitScaleTest();
runInitialFitRetriesWhenNativeMapIsNotReadyTest();
runProgrammaticUpdateRegionChangeDoesNotChangeScaleTest();
runProgrammaticEndWithoutGestureDoesNotChangeScaleTest();

delete global.Page;
delete global.wx;
delete global.getCurrentPages;

console.log('story map page tests passed');
