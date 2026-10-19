const { updateHomeLocation } = require('../../services/home');
const { getBrowserAtmosphere, hasLocation } = require('../../services/weather');
const { getToken, isLoggedIn } = require('../../utils/auth');
const { showConfirm } = require('../../utils/dialog');
const { showInfo } = require('../../utils/notify');
const { authorizePrivacy } = require('../../utils/privacy');
const { buildHomeLocationPayload, mapHomeData } = require('./home-presenter');

const WEATHER_REFRESH_INTERVAL = 20 * 60 * 1000;
const WEATHER_CONSENT_KEY = 'snowlit_weather_auto_consent_v1';
// Declining, or a denied permission, stops automatic prompts for the rest of this run.
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

function openLocationSetting() {
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
}

/**
 * Home's automatic location and weather: consent and permission checks, the 20-minute foreground
 * schedule, and discarding results that return after the page hid or the session changed.
 * The page tells it when it shows, hides or changes session; it reports back through `view`:
 * `setUpdating(flag)`, `showWeather(weather)` and `reloadHome()` after a saved location.
 */
function createHomeWeather(view) {
  // Unknown until the page first shows or hides; only an explicit hide stops a manual update.
  let visible;
  let timer = null;
  let lastAttemptAt;
  let permissionPending = false;
  let updating = false;
  // Bumped whenever earlier results must be ignored: a hide, a session change, a newer update.
  let revision = 0;
  // Weather with no resolved place lives only in memory for the session that fetched it.
  let transient = null;

  function setUpdating(flag) {
    updating = flag;
    view.setUpdating(flag);
  }

  function stopTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function canRunAutomatically() {
    return visible && isLoggedIn() && !automaticWeatherSuppressed
      && typeof wx.getLocation === 'function' && !permissionPending && !updating;
  }

  function schedule() {
    stopTimer();
    if (!canRunAutomatically()) return;
    const elapsed = lastAttemptAt === undefined ? WEATHER_REFRESH_INTERVAL : Date.now() - lastAttemptAt;
    timer = setTimeout(() => {
      timer = null;
      refreshIfDue();
    }, Math.max(0, WEATHER_REFRESH_INTERVAL - elapsed));
  }

  function refreshIfDue() {
    if (!canRunAutomatically()) return Promise.resolve();
    if (lastAttemptAt !== undefined && Date.now() - lastAttemptAt < WEATHER_REFRESH_INTERVAL) {
      schedule();
      return Promise.resolve();
    }
    return requestUpdate({ automatic: true });
  }

  function askConsent(automatic, canContinue) {
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
    });
  }

  /** Runs consent, privacy and permission checks, then locates. Manual updates can open settings. */
  function requestUpdate({ automatic = false } = {}) {
    if (permissionPending || updating) return Promise.resolve();
    const token = getToken();
    if (!token || (automatic && (!visible || automaticWeatherSuppressed))) return Promise.resolve();
    permissionPending = true;
    const canContinue = () => getToken() === token && visible !== false;

    return askConsent(automatic, canContinue).then((agreed) => {
      if (!agreed || !canContinue()) return false;
      return readLocationPermission().then((permission) => {
        if (!canContinue()) return false;
        if (permission !== false) return true;
        automaticWeatherSuppressed = true;
        return automatic ? false : openLocationSetting();
      });
    }).then((allowed) => {
      if (!allowed || !canContinue()) return;
      automaticWeatherSuppressed = false;
      lastAttemptAt = Date.now();
      return locate({ automatic });
    }).catch(() => {
      automaticWeatherSuppressed = true;
      if (canContinue()) setUpdating(false);
      if (!automatic && canContinue()) showInfo('位置授权暂不可用，请稍后重试');
    }).then(() => {
      permissionPending = false;
      schedule();
    });
  }

  /** Gets the position and weather; saves the location only when a place was resolved. */
  function locate({ automatic = false } = {}) {
    const token = getToken();
    const current = ++revision;
    const isCurrent = () => getToken() === token && revision === current;
    setUpdating(true);

    return new Promise((resolve) => {
      wx.getLocation({
        type: 'wgs84',
        success: (location) => {
          if (!isCurrent()) { resolve(); return; }
          const coordinates = { latitude: location.latitude, longitude: location.longitude };

          getBrowserAtmosphere(coordinates)
            .then((atmosphere) => {
              if (!isCurrent()) return;
              const payload = buildHomeLocationPayload(coordinates, atmosphere);
              const weather = mapHomeData({ personStatuses: [{ ...payload, note: '刚刚更新' }] }).weather;
              if (!hasLocation(atmosphere)) {
                transient = { token, weather };
                view.showWeather(weather);
                if (!automatic) showInfo('天气已更新，位置暂不可用');
                return;
              }
              return updateHomeLocation(payload).then(() => {
                if (!isCurrent()) return;
                transient = null;
                view.showWeather(weather);
                if (!automatic) showInfo(payload.weather || payload.temperature !== null ? '位置已更新' : '位置已更新，天气暂不可用');
                return view.reloadHome();
              });
            })
            .catch((error) => {
              if (!automatic && isCurrent()) {
                showInfo(error && error.message ? error.message : '位置更新失败');
              }
            })
            .then(() => {
              if (revision === current) setUpdating(false);
              resolve();
            });
        },
        fail: (error) => {
          if (error && /auth|deny|denied|permission/i.test(error.errMsg || '')) automaticWeatherSuppressed = true;
          if (revision === current) setUpdating(false);
          if (!automatic && isCurrent()) showInfo('未获取到位置，页面仍可使用');
          resolve();
        }
      });
    });
  }

  return {
    /** The page is showing: automatic updates may run when due. */
    show() {
      visible = true;
      return refreshIfDue();
    },
    /** The page hid or unloaded: stop the schedule and drop results still on their way. */
    hide() {
      visible = false;
      stopTimer();
      revision += 1;
      setUpdating(false);
    },
    /** The member changed: forget the previous session's weather and schedule. */
    resetSession() {
      stopTimer();
      transient = null;
      lastAttemptAt = undefined;
      revision += 1;
      setUpdating(false);
    },
    /**
     * Call when a home summary request starts; the returned function fixes up its weather when it
     * arrives: in-memory weather for this session wins, and a summary older than a newer location
     * update does not overwrite it.
     */
    beginHomeLoad() {
      const token = getToken();
      const startedAt = revision;
      return (home) => {
        if (transient && transient.token === token) {
          home.weather = transient.weather;
        } else if (startedAt !== revision) {
          delete home.weather;
        }
        return home;
      };
    },
    requestUpdate,
    locate
  };
}

module.exports = {
  WEATHER_REFRESH_INTERVAL,
  createHomeWeather
};
