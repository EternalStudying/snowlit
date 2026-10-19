const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { getMoments } = require('../../services/story');
const { beginRequest } = require('../../utils/request-guard');
const { showInfo } = require('../../utils/notify');
const {
  buildStoryQuery,
  clusterStoryMarkers,
  createStoryMapSnapPoints,
  DEFAULT_STORY_MAP_CENTER,
  EMPTY_STORY_MAP_SCALE,
  mapStoryLayoutByDrag,
  mapStoryLayoutByIndex,
  mapStoryLayoutByScroll,
  markStoryMarkers,
  mapStoryFilters,
  mapStoryPage,
  mapStoryYears,
  STORY_CLUSTER_EXPANDED_SCALE
} = require('./story-presenter');

function sameMomentId(left, right) {
  if (left === undefined || left === null || right === undefined || right === null) {
    return false;
  }
  return String(left) === String(right);
}

function findMarkerById(markers, markerId) {
  const id = Number(markerId);
  return (Array.isArray(markers) ? markers : []).find((item) => item.id === id) || null;
}

function readViewportMetrics() {
  const fallback = {
    viewportHeightRpx: 1334,
    rpxPerPx: 2
  };
  const info = wx.getWindowInfo
    ? wx.getWindowInfo()
    : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : null);
  if (!info || !info.windowWidth || !info.windowHeight) {
    return fallback;
  }
  return {
    viewportHeightRpx: Math.round((info.windowHeight * 750) / info.windowWidth),
    rpxPerPx: 750 / info.windowWidth
  };
}

function readTouchClientY(event) {
  const touch = event && event.touches && event.touches[0]
    ? event.touches[0]
    : (event && event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : null);
  const clientY = touch ? Number(touch.clientY) : Number.NaN;
  return Number.isFinite(clientY) ? clientY : null;
}

function readTouchCount(event) {
  if (!event || !event.touches) {
    return 0;
  }
  return event.touches.length || 0;
}

function readRegionScale(event) {
  const scale = event && event.detail ? Number(event.detail.scale) : Number.NaN;
  return Number.isFinite(scale) ? scale : null;
}

function normalizeMapCenter(center, fallbackCenter) {
  const latitude = center ? Number(center.latitude) : Number.NaN;
  const longitude = center ? Number(center.longitude) : Number.NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fallbackCenter || null;
  }
  return { latitude, longitude };
}

function sameMapCenter(left, right) {
  if (!left || !right) {
    return false;
  }
  return Math.abs(Number(left.latitude) - Number(right.latitude)) < 0.000001
    && Math.abs(Number(left.longitude) - Number(right.longitude)) < 0.000001;
}

function readRegionCenter(event) {
  return normalizeMapCenter(event && event.detail ? event.detail : null, null);
}

function readRegionStage(event) {
  const detailType = event && event.detail ? event.detail.type : '';
  if (detailType) {
    return detailType;
  }
  const eventType = event && event.type ? event.type : '';
  return eventType === 'regionchange' ? '' : eventType;
}

function readRegionCause(event) {
  return event && event.detail ? event.detail.causedBy : '';
}

function readMapContextViewport(context, fallbackViewport, callback) {
  const fallback = fallbackViewport || {};
  if (!wx.createMapContext) {
    callback(fallback);
    return;
  }
  const mapContext = wx.createMapContext('storyMap', context);
  if (!mapContext) {
    callback(fallback);
    return;
  }

  const readCenter = (scale) => {
    if (typeof mapContext.getCenterLocation !== 'function') {
      callback({
        scale,
        center: fallback.center || null
      });
      return;
    }
    mapContext.getCenterLocation({
      success(result) {
        callback({
          scale,
          center: normalizeMapCenter(result, fallback.center || null)
        });
      },
      fail() {
        callback({
          scale,
          center: fallback.center || null
        });
      }
    });
  };

  if (typeof mapContext.getScale !== 'function') {
    readCenter(fallback.scale);
    return;
  }

  mapContext.getScale({
    success(result) {
      const scale = result && Number.isFinite(Number(result.scale)) ? Number(result.scale) : fallback.scale;
      readCenter(scale);
    },
    fail() {
      readCenter(fallback.scale);
    }
  });
}

const INITIAL_MAP_LAYOUT = mapStoryLayoutByIndex(1334, 0);

Page({
  data: {
    canManage: false,
    activeFilter: 'all',
    activeYear: 'all',
    selectedMomentId: '',
    filters: mapStoryFilters('all'),
    years: mapStoryYears([], 'all'),
    yearDropdownOpen: false,
    markers: [],
    rawMarkers: [],
    mapCenter: DEFAULT_STORY_MAP_CENTER,
    mapIncludePoints: [],
    mapScale: EMPTY_STORY_MAP_SCALE,
    viewportHeightRpx: 1334,
    rpxPerPx: 2,
    snapPoints: createStoryMapSnapPoints(1334),
    ...INITIAL_MAP_LAYOUT,
    sheetScrollTop: 0,
    moments: [],
    hasMoments: false,
    loading: false,
    message: ''
  },

  onLoad() {
    this.initStoryMapLayout();
    this.loadMoments();
  },

  initStoryMapLayout() {
    const { viewportHeightRpx, rpxPerPx } = readViewportMetrics();
    this.setData({
      viewportHeightRpx,
      rpxPerPx,
      snapPoints: createStoryMapSnapPoints(viewportHeightRpx),
      ...mapStoryLayoutByIndex(viewportHeightRpx, 0),
      sheetScrollTop: 0
    });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.INDEX) });
  },

  handleFilterTap(event) {
    const { value } = event.currentTarget.dataset;
    const filter = this.data.filters.find((item) => item.value === value);
    if (!filter) {
      return;
    }

    if (value === this.data.activeFilter) {
      this.setData({
        yearDropdownOpen: !this.data.yearDropdownOpen
      });
      return;
    }

    this.setData({
      activeFilter: value,
      activeYear: 'all',
      yearDropdownOpen: false,
      selectedMomentId: '',
      filters: mapStoryFilters(value),
      years: mapStoryYears([], 'all')
    });
    this.loadMoments({ refreshYears: true });
  },

  handleYearTap(event) {
    const rawValue = event.currentTarget.dataset.value;
    const value = rawValue === 'all' ? 'all' : Number(rawValue);
    if (value === this.data.activeYear) {
      this.setData({ yearDropdownOpen: false });
      return;
    }
    this.setData({
      activeYear: value,
      yearDropdownOpen: false,
      selectedMomentId: '',
      years: mapStoryYears(this.data.years.map((item) => item.value).filter((item) => item !== 'all'), value)
    });
    this.loadMoments({ refreshYears: false });
  },

  handleMarkerTap(event) {
    const markerId = event && event.detail ? event.detail.markerId : '';
    const marker = findMarkerById(this.data.markers, markerId);
    if (!marker) {
      return;
    }
    if (marker.cluster) {
      this.expandStoryCluster(marker);
      return;
    }

    const id = marker.momentId;
    if (!id || sameMomentId(id, this.data.selectedMomentId)) {
      return;
    }
    this.selectMoment(id);
  },

  expandStoryCluster(marker) {
    const markers = clusterStoryMarkers(
      this.data.rawMarkers,
      this.data.selectedMomentId,
      STORY_CLUSTER_EXPANDED_SCALE
    );
    this.setData({
      markers,
      mapCenter: {
        latitude: marker.latitude,
        longitude: marker.longitude
      },
      mapIncludePoints: [],
      mapScale: STORY_CLUSTER_EXPANDED_SCALE,
      yearDropdownOpen: false
    });
  },

  syncStoryMapViewport(fallbackViewport, options) {
    const fallback = fallbackViewport || {};
    const syncOptions = options || {};
    const shouldSyncScale = syncOptions.syncScale !== false;
    const shouldSyncCenter = syncOptions.syncCenter !== false;
    readMapContextViewport(this, {
      scale: fallback.scale === null || fallback.scale === undefined ? this.data.mapScale : fallback.scale,
      center: fallback.center || this.data.mapCenter
    }, ({ scale, center }) => {
      const hasScale = scale !== null && scale !== undefined;
      const scaleChanged = shouldSyncScale
        && hasScale
        && Math.abs(scale - Number(this.data.mapScale || 0)) >= 0.01;
      const centerChanged = shouldSyncCenter && center && !sameMapCenter(center, this.data.mapCenter);
      if (!scaleChanged && !centerChanged) {
        return;
      }

      const nextData = {};
      if (scaleChanged) {
        nextData.mapScale = scale;
        nextData.markers = clusterStoryMarkers(this.data.rawMarkers, this.data.selectedMomentId, scale);
      }
      if (centerChanged) {
        nextData.mapCenter = center;
      }
      this.setData(nextData);
    });
  },

  handleMapTouchStart(event) {
    if (this.storyMapTouchClearTimer) {
      clearTimeout(this.storyMapTouchClearTimer);
      this.storyMapTouchClearTimer = null;
    }
    this.storyMapTouchActive = true;
    this.storyMapTouchMayScale = readTouchCount(event) >= 2;
  },

  handleMapTouchMove(event) {
    if (readTouchCount(event) >= 2) {
      this.storyMapTouchMayScale = true;
    }
  },

  handleMapTouchEnd() {
    if (this.storyMapTouchClearTimer) {
      clearTimeout(this.storyMapTouchClearTimer);
    }
    this.storyMapTouchClearTimer = setTimeout(() => {
      this.clearStoryMapTouchState();
    }, 1000);
  },

  clearStoryMapTouchState() {
    if (this.storyMapTouchClearTimer) {
      clearTimeout(this.storyMapTouchClearTimer);
      this.storyMapTouchClearTimer = null;
    }
    this.storyMapTouchActive = false;
    this.storyMapTouchMayScale = false;
  },

  handleMapRegionChange(event) {
    const stage = readRegionStage(event);
    const cause = readRegionCause(event);
    if (stage === 'begin') {
      this.storyMapRegionCause = cause || '';
      return;
    }
    if (stage && stage !== 'end') {
      return;
    }
    const effectiveCause = cause || this.storyMapRegionCause || '';
    this.storyMapRegionCause = '';
    if (effectiveCause === 'update') {
      this.clearStoryMapTouchState();
      return;
    }
    if (effectiveCause === 'drag') {
      this.syncStoryMapViewport({
        scale: this.data.mapScale,
        center: readRegionCenter(event) || this.data.mapCenter
      }, { syncScale: false });
      this.clearStoryMapTouchState();
      return;
    }
    if (effectiveCause === 'scale') {
      this.syncStoryMapViewport({
        scale: readRegionScale(event),
        center: readRegionCenter(event) || this.data.mapCenter
      });
      this.clearStoryMapTouchState();
      return;
    }
    if (this.storyMapTouchActive) {
      const shouldSyncScale = Boolean(this.storyMapTouchMayScale);
      this.syncStoryMapViewport({
        scale: shouldSyncScale ? readRegionScale(event) : this.data.mapScale,
        center: readRegionCenter(event) || this.data.mapCenter
      }, { syncScale: shouldSyncScale });
      this.clearStoryMapTouchState();
      return;
    }
    this.clearStoryMapTouchState();
    if (event && event.type === 'regionchange') {
      return;
    }
    this.syncStoryMapViewport({
      scale: readRegionScale(event),
      center: readRegionCenter(event) || this.data.mapCenter
    });
  },

  goDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: withQuery(ROUTES.STORY_DETAIL, { id })
    });
  },

  goCreate() {
    if (!this.data.canManage) {
      showInfo('当前账号没有发布权限');
      return;
    }
    wx.navigateTo({ url: routePath(ROUTES.STORY_EDIT) });
  },

  retryLoad() {
    this.loadMoments();
  },

  handleMomentSheetScroll(event) {
    const scrollTop = event && event.detail && Number.isFinite(Number(event.detail.scrollTop))
      ? Number(event.detail.scrollTop)
      : 0;
    this.storySheetInnerScrollTop = scrollTop;
  },

  handleMomentSheetTouchStart(event) {
    const clientY = readTouchClientY(event);
    if (clientY === null) {
      return;
    }
    this.storySheetTouchY = clientY;
    this.storySheetGestureActive = false;
    this.storySheetPanOffsetRpx = this.data.sheetPanOffsetRpx;
  },

  shouldControlMomentSheetGesture(deltaYRpx) {
    const isFullList = this.data.sheetScrollEnabled;
    if (!isFullList) {
      return true;
    }
    return deltaYRpx > 0 && (this.storySheetInnerScrollTop || 0) <= 1;
  },

  handleMomentSheetTouchMove(event) {
    const clientY = readTouchClientY(event);
    if (clientY === null) {
      return;
    }
    if (this.storySheetTouchY === undefined || this.storySheetTouchY === null) {
      this.storySheetTouchY = clientY;
      return;
    }

    const deltaYRpx = Math.round((clientY - this.storySheetTouchY) * this.data.rpxPerPx);
    this.storySheetTouchY = clientY;
    if (Math.abs(deltaYRpx) < 2 || !this.shouldControlMomentSheetGesture(deltaYRpx)) {
      return;
    }

    const currentOffset = this.storySheetPanOffsetRpx === undefined || this.storySheetPanOffsetRpx === null
      ? this.data.sheetPanOffsetRpx
      : this.storySheetPanOffsetRpx;
    const layout = mapStoryLayoutByDrag(this.data.viewportHeightRpx, currentOffset, deltaYRpx);
    if (layout.sheetPanOffsetRpx === currentOffset) {
      return;
    }

    this.storySheetGestureActive = true;
    this.storySheetInnerScrollTop = 0;
    this.storySheetPanOffsetRpx = layout.sheetPanOffsetRpx;
    this.setData({
      ...layout,
      sheetScrollTop: 0
    });
  },

  handleMomentSheetTouchEnd() {
    this.storySheetTouchY = null;
    if (!this.storySheetGestureActive) {
      this.storySheetPanOffsetRpx = null;
      return;
    }
    this.storySheetGestureActive = false;
    this.snapStoryMapToScroll(this.storySheetPanOffsetRpx);
    this.storySheetPanOffsetRpx = null;
  },

  snapStoryMapToScroll(scrollTop) {
    const layout = mapStoryLayoutByScroll(this.data.viewportHeightRpx, scrollTop);
    this.snapStoryMapToIndex(layout.mapSnapIndex);
  },

  snapStoryMapToIndex(index) {
    const layout = mapStoryLayoutByIndex(this.data.viewportHeightRpx, index);
    this.storySheetInnerScrollTop = 0;
    this.storySheetPanOffsetRpx = layout.sheetPanOffsetRpx;
    this.setData({
      ...layout,
      sheetScrollTop: 0
    });
  },

  scheduleFitMapToMarkers(points, retryCount) {
    if (retryCount >= 2) {
      return;
    }
    const run = () => {
      this.fitMapToMarkers(points, retryCount + 1);
    };
    if (wx.nextTick) {
      wx.nextTick(run);
      return;
    }
    setTimeout(run, 16);
  },

  fitMapToMarkers(points, retryCount = 0) {
    const includePoints = Array.isArray(points) ? points : this.data.mapIncludePoints;
    if (!includePoints.length || !wx.createMapContext) {
      return;
    }
    const mapContext = wx.createMapContext('storyMap', this);
    if (!mapContext || typeof mapContext.includePoints !== 'function') {
      this.scheduleFitMapToMarkers(includePoints, retryCount);
      return;
    }
    mapContext.includePoints({
      points: includePoints,
      padding: [64, 48, 64, 48],
      complete: () => {
        this.syncStoryMapViewport({
          scale: this.data.mapScale,
          center: this.data.mapCenter
        }, { syncScale: false });
      }
    });
  },

  selectMoment(id) {
    if (!id || sameMomentId(id, this.data.selectedMomentId)) {
      return;
    }
    const markers = markStoryMarkers(this.data.markers, id);
    const activeMarker = markers.find((item) => item.active);
    this.setData({
      selectedMomentId: id,
      markers,
      mapCenter: activeMarker
        ? { latitude: activeMarker.latitude, longitude: activeMarker.longitude }
        : this.data.mapCenter,
      moments: this.data.moments.map((item) => ({
        ...item,
        selected: sameMomentId(item.id, id)
      }))
    });
  },

  getYearValues() {
    return this.data.years
      .map((item) => item.value)
      .filter((item) => item !== 'all');
  },

  loadMoments(options) {
    const shouldRefreshYears = (!options || options.refreshYears !== false) && this.data.activeYear === 'all';
    const previousYearValues = this.getYearValues();
    const isCurrent = beginRequest(this, 'moments');

    this.setData({
      loading: true,
      message: ''
    });

    return getMoments(buildStoryQuery(this.data.activeFilter, this.data.activeYear))
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        const page = mapStoryPage(response, this.data.selectedMomentId, this.data.activeYear);
        this.setData({
          ...page,
          years: shouldRefreshYears ? page.years : mapStoryYears(previousYearValues, this.data.activeYear),
          filters: mapStoryFilters(this.data.activeFilter)
        }, () => {
          this.fitMapToMarkers(page.mapIncludePoints);
        });
      })
      .catch((error) => {
        if (!isCurrent()) {
          return;
        }
        this.setData({
          canManage: false,
          markers: [],
          rawMarkers: [],
          mapCenter: DEFAULT_STORY_MAP_CENTER,
          mapIncludePoints: [],
          mapScale: EMPTY_STORY_MAP_SCALE,
          moments: [],
          hasMoments: false,
          yearDropdownOpen: false,
          message: (error && error.message) || '点滴加载失败'
        });
      })
      .then(() => {
        if (isCurrent()) {
          this.setData({ loading: false });
        }
      });
  }
});
