const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { config } = require('../../constants/config');
const { getMoments } = require('../../services/story');
const { beginRequest } = require('../../utils/request-guard');
const { buildJumpYears, monthsResponseFrom } = require('../../utils/month-jump');
const { showInfo } = require('../../utils/notify');
const {
  buildStoryQuery,
  DEFAULT_STORY_MAP_CENTER,
  EMPTY_STORY_MAP_SCALE,
  findStoryMoment,
  mapClusterMarker,
  mapStoryFilters,
  mapStoryPage
} = require('./story-presenter');

// Month headings stick just under the top mask, which clears the back button.
const STICKY_TOP_RPX = 150;
// A tap on a marker can also reach the map's own tap; ignore that echo.
const MARKER_TAP_ECHO_MS = 350;

function rpxToPx(rpx) {
  const windowWidth = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth;
  return Math.round((rpx * windowWidth) / 750);
}

Page({
  data: {
    view: 'list',
    showTopMask: false,
    canManage: false,
    activeFilter: 'all',
    filters: mapStoryFilters('all'),
    sections: [],
    hasMoments: false,
    unplacedCount: 0,
    mapCenter: DEFAULT_STORY_MAP_CENTER,
    mapScale: EMPTY_STORY_MAP_SCALE,
    mapSubkey: config.mapSubkey || '',
    selectedMoment: null,
    jumpVisible: false,
    jumpYears: [],
    loading: false,
    message: ''
  },

  onLoad() {
    this.markers = [];
    this.includePoints = [];
    this.months = [];
    this.loadMoments();
  },

  onPageScroll({ scrollTop }) {
    const showTopMask = scrollTop > 18;
    if (showTopMask !== this.data.showTopMask) {
      this.setData({ showTopMask });
    }
  },

  onPullDownRefresh() {
    this.loadMoments().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.INDEX) });
  },

  // Also called by story-edit and story-detail after a change.
  loadMoments() {
    const isCurrent = beginRequest(this, 'moments');
    this.setData({ loading: true, message: '' });

    return getMoments(buildStoryQuery(this.data.activeFilter))
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        const page = mapStoryPage(response);
        this.markers = page.markers;
        this.includePoints = page.mapIncludePoints;
        this.months = page.months;
        const stillThere = this.data.selectedMoment && findStoryMoment(page.sections, this.data.selectedMoment.id);
        this.setData({
          sections: page.sections,
          hasMoments: page.hasMoments,
          unplacedCount: page.unplacedCount,
          canManage: page.canManage,
          mapCenter: page.mapCenter,
          mapScale: page.mapScale,
          selectedMoment: stillThere || null,
          loading: false
        }, () => {
          if (this.data.view === 'map') {
            this.showMarkers();
          }
        });
      })
      .catch((error) => {
        if (!isCurrent()) {
          return;
        }
        this.markers = [];
        this.includePoints = [];
        this.months = [];
        this.setData({
          sections: [],
          hasMoments: false,
          unplacedCount: 0,
          selectedMoment: null,
          loading: false,
          message: (error && error.message) || '点滴加载失败'
        });
      });
  },

  retryLoad() {
    this.loadMoments();
  },

  handleFilterTap(event) {
    const { value } = event.currentTarget.dataset;
    if (!value || value === this.data.activeFilter) {
      return;
    }
    this.setData({
      activeFilter: value,
      filters: mapStoryFilters(value),
      selectedMoment: null
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    this.loadMoments();
  },

  handleViewTap(event) {
    const view = event.currentTarget.dataset.view;
    if (!view || view === this.data.view) {
      return;
    }
    this.mapContext = null;
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    this.setData({ view, selectedMoment: null, showTopMask: false }, () => {
      if (view === 'map') {
        this.showMarkers();
      }
    });
  },

  showList() {
    this.handleViewTap({ currentTarget: { dataset: { view: 'list' } } });
  },

  // The native map clusters the markers itself and redraws clusters as you zoom; no JS runs per gesture.
  showMarkers() {
    if (!wx.createMapContext) {
      return;
    }
    const mapContext = this.mapContext || wx.createMapContext('storyMap', this);
    if (!mapContext || typeof mapContext.addMarkers !== 'function') {
      return;
    }
    if (!this.mapContext) {
      this.mapContext = mapContext;
      if (typeof mapContext.initMarkerCluster === 'function') {
        mapContext.initMarkerCluster({ enableDefaultStyle: false, zoomOnClick: true, gridSize: 60 });
        mapContext.on('markerClusterCreate', (result) => {
          const clusters = result && Array.isArray(result.clusters) ? result.clusters : [];
          mapContext.addMarkers({ markers: clusters.map(mapClusterMarker), clear: false });
        });
      }
    }
    mapContext.addMarkers({ markers: this.markers, clear: true });
    if (this.includePoints.length && typeof mapContext.includePoints === 'function') {
      mapContext.includePoints({ points: this.includePoints, padding: [72, 56, 180, 56] });
    }
  },

  handleMarkerTap(event) {
    const markerId = event && event.detail ? Number(event.detail.markerId) : NaN;
    const marker = this.markers.find((item) => item.id === markerId);
    if (!marker) {
      return;
    }
    this.lastMarkerTapAt = Date.now();
    this.setData({ selectedMoment: findStoryMoment(this.data.sections, marker.momentId) });
  },

  handleMapTap() {
    if (Date.now() - (this.lastMarkerTapAt || 0) < MARKER_TAP_ECHO_MS) {
      return;
    }
    if (this.data.selectedMoment) {
      this.setData({ selectedMoment: null });
    }
  },

  handleMonthHeadTap(event) {
    const { month, dated } = event.currentTarget.dataset;
    if (!dated) {
      return;
    }
    this.setData({
      jumpYears: buildJumpYears(monthsResponseFrom(this.months), month),
      jumpVisible: true
    });
  },

  handleJumpCancel() {
    this.setData({ jumpVisible: false });
  },

  handleJumpSelect(event) {
    const month = event.detail && event.detail.month;
    this.setData({ jumpVisible: false });
    if (!month) {
      return;
    }
    wx.pageScrollTo({
      selector: `#month-${month}`,
      offsetTop: -rpxToPx(STICKY_TOP_RPX),
      duration: 260
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
  }
});
