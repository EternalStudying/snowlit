const { ROUTES, routePath } = require('../../constants/routes');
const { getAlbums } = require('../../services/album');
const { getHomeData, updateHomeLocation } = require('../../services/home');
const { getMoments } = require('../../services/story');
const { getUpdateNotice } = require('../../services/update-notice');
const { getBrowserAtmosphere, hasLocation } = require('../../services/weather');
const { getWishSummary } = require('../../services/wish');
const { getToken, isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { showConfirm } = require('../../utils/dialog');
const { showInfo } = require('../../utils/notify');
const { authorizePrivacy } = require('../../utils/privacy');
const { beginRequest } = require('../../utils/request-guard');
const { setActiveTabBar } = require('../../utils/tabbar');
const {
  buildHomeLocationPayload,
  mapAlbums,
  mapHomeData,
  mapStoryMoments,
  mapUpdateNotice,
  mapWishStats
} = require('./home-presenter');

const initialHome = mapHomeData();
const initialWishes = mapWishStats();
const WEATHER_REFRESH_INTERVAL = 20 * 60 * 1000;
const WEATHER_CONSENT_KEY = 'snowlit_weather_auto_consent_v1';
let automaticWeatherSuppressed = false;

function hasWeatherConsent() {
  try {
    return wx.getStorageSync(WEATHER_CONSENT_KEY) === true;
  } catch (_) {
    return false;
  }
}

function rememberWeatherConsent() {
  if (typeof wx.setStorageSync === 'function') {
    try { wx.setStorageSync(WEATHER_CONSENT_KEY, true); } catch (_) {}
  }
}

function readLocationPermission() {
  if (typeof wx.getSetting !== 'function') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    wx.getSetting({
      success: (setting) => resolve(setting && setting.authSetting && setting.authSetting['scope.userLocation']),
      fail: () => resolve(undefined)
    });
  });
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
    this.locationPageVisible = true;
    setActiveTabBar(0);
    const home = this.loadHomePage();
    this.refreshWeatherIfDue();
    return home;
  },

  onHide() {
    this.locationPageVisible = false;
    this.stopWeatherRefresh();
    this.weatherUpdateRevision = (this.weatherUpdateRevision || 0) + 1;
    this.setData({ locationUpdating: false });
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
      this.stopWeatherRefresh();
      this.transientWeather = null;
      this.lastWeatherAttemptAt = undefined;
      this.weatherUpdateRevision = (this.weatherUpdateRevision || 0) + 1;
      this.setData({
        ...mapHomeData(),
        locationUpdating: false,
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
    const token = getToken();
    const isCurrent = beginRequest(this, 'home');
    const weatherRevision = this.weatherUpdateRevision || 0;
    if (!isLoggedIn()) {
      this.setData(mapHomeData());
      return Promise.resolve();
    }

    return getHomeData()
      .then((response) => {
        if (!isCurrent()) {
          return;
        }
        const home = mapHomeData(response);
        if (this.transientWeather && this.transientWeather.token === token) {
          home.weather = this.transientWeather.weather;
        } else if (weatherRevision !== (this.weatherUpdateRevision || 0)) {
          delete home.weather;
        }
        this.setData(home);
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

  stopWeatherRefresh() {
    if (this.weatherRefreshTimer) clearTimeout(this.weatherRefreshTimer);
    this.weatherRefreshTimer = null;
  },

  scheduleWeatherRefresh() {
    this.stopWeatherRefresh();
    if (!this.locationPageVisible || !isLoggedIn() || automaticWeatherSuppressed
      || typeof wx.getLocation !== 'function' || this.weatherPermissionPending || this.data.locationUpdating) return;
    const elapsed = this.lastWeatherAttemptAt === undefined ? WEATHER_REFRESH_INTERVAL : Date.now() - this.lastWeatherAttemptAt;
    this.weatherRefreshTimer = setTimeout(() => {
      this.weatherRefreshTimer = null;
      this.refreshWeatherIfDue();
    }, Math.max(0, WEATHER_REFRESH_INTERVAL - elapsed));
  },

  refreshWeatherIfDue() {
    if (!this.locationPageVisible || !isLoggedIn() || automaticWeatherSuppressed
      || typeof wx.getLocation !== 'function' || this.weatherPermissionPending || this.data.locationUpdating) return Promise.resolve();
    if (this.lastWeatherAttemptAt !== undefined && Date.now() - this.lastWeatherAttemptAt < WEATHER_REFRESH_INTERVAL) {
      this.scheduleWeatherRefresh();
      return Promise.resolve();
    }
    return this.requestLocationUpdate({ automatic: true });
  },

  handleLocationTap() {
    if (!isLoggedIn()) {
      redirectToLogin();
      return Promise.resolve();
    }
    return this.requestLocationUpdate();
  },

  requestLocationUpdate({ automatic = false } = {}) {
    if (this.weatherPermissionPending || this.data.locationUpdating) return Promise.resolve();
    const token = getToken();
    if (!token || (automatic && (!this.locationPageVisible || automaticWeatherSuppressed))) return Promise.resolve();
    this.weatherPermissionPending = true;
    const canContinue = () => getToken() === token && this.locationPageVisible !== false;
    const consent = hasWeatherConsent() ? Promise.resolve({ confirm: true }) : showConfirm({
      title: '自动更新位置',
      content: '同意后，首页打开或登录后自动定位，前台每 20 分钟更新，离开首页或切到后台即暂停。坐标用于天气、城市和距离，后端取小数点后 2 位发给 Geoapify 和 Open-Meteo，服务商可能保留查询日志。',
      confirmText: '同意并开启'
    });
    return consent.then((result) => {
      if (!result.confirm) {
        automaticWeatherSuppressed = true;
        return false;
      }
      if (!canContinue()) return false;
      return authorizePrivacy({
        title: '使用位置',
        message: '首页打开或登录后及前台每 20 分钟获取位置，离开首页或后台暂停；后端向 Geoapify 和 Open-Meteo 发送模糊坐标，服务商可能保留日志。'
      }).then((agreed) => {
        if (!agreed) {
          automaticWeatherSuppressed = true;
          if (!automatic) showInfo('同意隐私指引后才能更新位置');
          return false;
        }
        rememberWeatherConsent();
        return true;
      });
    }).then((agreed) => {
      if (!agreed || !canContinue()) return false;
      return readLocationPermission().then((permission) => {
        if (!canContinue()) return false;
        if (permission !== false) return true;
        automaticWeatherSuppressed = true;
        if (automatic) return false;
        return showConfirm({
          title: '开启位置权限',
          content: '微信的位置权限已关闭。请在设置中允许位置访问，之后可恢复首页自动天气更新。',
          confirmText: '前往设置'
        }).then((result) => {
          if (!result.confirm || typeof wx.openSetting !== 'function') return false;
          return new Promise((resolve) => {
            wx.openSetting({
              success: (setting) => resolve(Boolean(setting && setting.authSetting && setting.authSetting['scope.userLocation'])),
              fail: () => resolve(false)
            });
          });
        });
      });
    }).then((allowed) => {
      if (!allowed || !canContinue()) return;
      automaticWeatherSuppressed = false;
      this.lastWeatherAttemptAt = Date.now();
      return this.updateCurrentLocation({ automatic });
    }).catch(() => {
      automaticWeatherSuppressed = true;
      if (canContinue()) this.setData({ locationUpdating: false });
      if (!automatic && canContinue()) showInfo('位置授权暂不可用，请稍后重试');
    }).then(() => {
      this.weatherPermissionPending = false;
      this.scheduleWeatherRefresh();
    });
  },

  updateCurrentLocation({ automatic = false } = {}) {
    const token = getToken();
    const revision = (this.weatherUpdateRevision || 0) + 1;
    this.weatherUpdateRevision = revision;
    this.setData({ locationUpdating: true });

    return new Promise((resolve) => {
      wx.getLocation({
        type: 'wgs84',
        success: (location) => {
          if (getToken() !== token || this.weatherUpdateRevision !== revision) { resolve(); return; }
          const coordinates = {
            latitude: location.latitude,
            longitude: location.longitude
          };

          getBrowserAtmosphere(coordinates)
            .then((atmosphere) => {
              if (getToken() !== token || this.weatherUpdateRevision !== revision) return;
              const payload = buildHomeLocationPayload(coordinates, atmosphere);
              const weather = mapHomeData({ personStatuses: [{ ...payload, note: '刚刚更新' }] }).weather;
              if (!hasLocation(atmosphere)) {
                this.transientWeather = { token, weather };
                this.setData({ weather });
                if (!automatic) showInfo('天气已更新，位置暂不可用');
                return;
              }
              return updateHomeLocation(payload).then(() => {
                if (getToken() !== token || this.weatherUpdateRevision !== revision) return;
                this.transientWeather = null;
                this.setData({ weather });
                if (!automatic) showInfo(payload.weather || payload.temperature !== null ? '位置已更新' : '位置已更新，天气暂不可用');
                return this.loadHomeData();
              });
            })
            .catch((error) => {
              if (!automatic && getToken() === token && this.weatherUpdateRevision === revision) {
                showInfo(error && error.message ? error.message : '位置更新失败');
              }
            })
            .then(() => {
              if (this.weatherUpdateRevision === revision) this.setData({ locationUpdating: false });
              resolve();
            });
        },
        fail: (error) => {
          if (error && /auth|deny|denied|permission/i.test(error.errMsg || '')) automaticWeatherSuppressed = true;
          if (this.weatherUpdateRevision === revision) this.setData({ locationUpdating: false });
          if (!automatic && getToken() === token && this.weatherUpdateRevision === revision) {
            showInfo('未获取到位置，页面仍可使用');
          }
          resolve();
        }
      });
    });
  }
});
