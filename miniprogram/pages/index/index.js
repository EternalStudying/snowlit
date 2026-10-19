const { ROUTES, routePath } = require('../../constants/routes');
const { getAlbums } = require('../../services/album');
const { getHomeData } = require('../../services/home');
const { getMoments } = require('../../services/story');
const { getUpdateNotice } = require('../../services/update-notice');
const { getWishSummary } = require('../../services/wish');
const { getToken, isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { beginRequest } = require('../../utils/request-guard');
const { setActiveTabBar } = require('../../utils/tabbar');
const {
  mapAlbums,
  mapHomeData,
  mapStoryMoments,
  mapUpdateNotice,
  mapWishStats
} = require('./home-presenter');
const { createHomeWeather } = require('./home-weather');

const initialHome = mapHomeData();
const initialWishes = mapWishStats();

// One weather controller per page instance, created on first use.
function weatherOf(page) {
  if (!page.homeWeather) {
    page.homeWeather = createHomeWeather({
      setUpdating: (locationUpdating) => page.setData({ locationUpdating }),
      showWeather: (weather) => page.setData({ weather }),
      reloadHome: () => page.loadHomeData()
    });
  }
  return page.homeWeather;
}

Page({
  data: {
    showTopMask: false,
    greetingTitle: '上午好',
    greetingSubtitle: initialHome.greetingSubtitle,
    couple: initialHome.couple,
    weather: initialHome.weather,
    moments: [],
    momentsLoading: false,
    momentsError: '',
    albums: [],
    albumsLoading: false,
    albumsMessage: '',
    updateNotice: null,
    wishes: initialWishes,
    wishesLoading: false,
    wishesMessage: '',
    locationUpdating: false
  },

  onShow() {
    setActiveTabBar(0);
    const home = this.loadHomePage();
    weatherOf(this).show();
    return home;
  },

  onHide() {
    weatherOf(this).hide();
  },

  onUnload() {
    this.onHide();
  },

  onPageScroll(event) {
    const shouldShow = event.scrollTop > 18;
    if (shouldShow !== this.data.showTopMask) {
      this.setData({ showTopMask: shouldShow });
    }
  },

  onPullDownRefresh() {
    this.loadHomePage().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadHomePage() {
    const token = getToken();
    if (this.homeSessionToken !== token) {
      this.homeSessionToken = token;
      weatherOf(this).resetSession();
      this.setData({
        ...mapHomeData(),
        albums: [],
        updateNotice: null,
        wishes: []
      });
    }
    return Promise.all([
      this.loadHomeData(),
      this.loadStoryMoments(),
      this.loadAlbums(),
      this.loadUpdateNotice(),
      this.loadWishStats()
    ]);
  },

  loadHomeData() {
    const isCurrent = beginRequest(this, 'home');
    const settleWeather = weatherOf(this).beginHomeLoad();
    if (!isLoggedIn()) {
      this.setData(mapHomeData());
      return Promise.resolve();
    }

    return getHomeData()
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        this.setData(settleWeather(mapHomeData(response)));
      })
      .catch(() => {});
  },

  loadStoryMoments() {
    const isCurrent = beginRequest(this, 'storyMoments');
    this.setData({
      momentsLoading: true,
      momentsError: ''
    });

    return getMoments()
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        this.setData({
          moments: mapStoryMoments(response),
          momentsLoading: false
        });
      })
      .catch((error) => {
        if (!isCurrent()) {
          return;
        }
        this.setData({
          momentsLoading: false,
          momentsError: error && error.message ? error.message : '点滴加载失败'
        });
      });
  },

  loadAlbums() {
    const isCurrent = beginRequest(this, 'albums');
    if (!isLoggedIn()) {
      this.setData({
        albums: [],
        albumsLoading: false,
        albumsMessage: '登录后查看相册'
      });
      return Promise.resolve();
    }

    this.setData({
      albumsLoading: true,
      albumsMessage: ''
    });

    return getAlbums({ page: 1, size: 2, previewLimit: 1 })
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        const albums = mapAlbums(response);
        this.setData({
          albums,
          albumsLoading: false,
          albumsMessage: albums.length ? '' : '还没有相册'
        });
      })
      .catch((error) => {
        if (!isCurrent()) {
          return;
        }
        this.setData({
          albums: [],
          albumsLoading: false,
          albumsMessage: error && error.message ? error.message : '相册加载失败'
        });
      });
  },

  loadUpdateNotice() {
    const isCurrent = beginRequest(this, 'updateNotice');
    if (!isLoggedIn()) {
      this.setData({ updateNotice: null });
      return Promise.resolve();
    }

    return getUpdateNotice()
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        this.setData({ updateNotice: mapUpdateNotice(response) });
      })
      .catch(() => {
        if (!isCurrent()) {
          return;
        }
        this.setData({ updateNotice: null });
      });
  },

  loadWishStats() {
    const isCurrent = beginRequest(this, 'wishStats');
    if (!isLoggedIn()) {
      this.setData({
        wishes: [],
        wishesLoading: false,
        wishesMessage: '登录后查看清单'
      });
      return Promise.resolve();
    }

    this.setData({
      wishesLoading: true,
      wishesMessage: ''
    });

    return getWishSummary()
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        this.setData({
          wishes: mapWishStats(response),
          wishesLoading: false,
          wishesMessage: ''
        });
      })
      .catch((error) => {
        if (!isCurrent()) {
          return;
        }
        this.setData({
          wishes: [],
          wishesLoading: false,
          wishesMessage: error && error.message ? error.message : '清单统计加载失败'
        });
      });
  },

  goStory() {
    wx.navigateTo({ url: routePath(ROUTES.STORY) });
  },

  goAlbums() {
    wx.switchTab({ url: routePath(ROUTES.ALBUMS) });
  },

  goWishes() {
    wx.switchTab({ url: routePath(ROUTES.WISHES) });
  },

  goProfile() {
    wx.switchTab({ url: routePath(ROUTES.PROFILE) });
  },

  goFeedback() {
    wx.navigateTo({ url: routePath(ROUTES.FEEDBACK) });
  },

  handleLocationTap() {
    if (!isLoggedIn()) {
      redirectToLogin();
      return Promise.resolve();
    }
    return weatherOf(this).requestUpdate();
  }
});
