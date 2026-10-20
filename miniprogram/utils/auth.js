const { ROUTES, routePath } = require('../constants/routes');
const { getStorage, setStorage, removeStorage, removeStorageByPrefix } = require('./storage');
const { isManagerUser } = require('./permission');

const STORAGE_KEYS = {
  TOKEN: 'snowlit_token',
  USER: 'snowlit_user',
  LOGIN_REDIRECT: 'snowlit_login_redirect',
  ALBUM_PRIVATE_TOKEN_PREFIX: 'snowlit_album_private_token_'
};

const tokenListeners = new Set();

function onTokenChange(listener) {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

function notifyTokenChange(previous) {
  if (getToken() !== previous) tokenListeners.forEach((listener) => listener());
}

function getToken() {
  return getStorage(STORAGE_KEYS.TOKEN, '');
}

function setToken(token) {
  const previous = getToken();
  if (!token) {
    removeStorage(STORAGE_KEYS.TOKEN);
    notifyTokenChange(previous);
    return;
  }
  setStorage(STORAGE_KEYS.TOKEN, token);
  notifyTokenChange(previous);
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    ...user,
    canManage: isManagerUser(user)
  };
}

function getStoredUser() {
  return normalizeUser(getStorage(STORAGE_KEYS.USER, null));
}

function setStoredUser(user) {
  const normalized = normalizeUser(user);
  if (!normalized) {
    removeStorage(STORAGE_KEYS.USER);
    return;
  }
  setStorage(STORAGE_KEYS.USER, normalized);
}

function persistLoginSession(payload) {
  const token = payload && payload.token;
  const user = payload && payload.user;
  if (!token) {
    throw new Error('登录响应缺少 token');
  }
  setToken(token);
  setStoredUser(user || null);
  const app = typeof getApp === 'function' ? getApp({ allowDefault: true }) : null;
  if (app && app.globalData) {
    app.globalData.token = token;
    app.globalData.user = getStoredUser();
  }
}

function clearAuthSession() {
  setToken('');
  removeStorage(STORAGE_KEYS.USER);
  removeStorageByPrefix(STORAGE_KEYS.ALBUM_PRIVATE_TOKEN_PREFIX);
  const app = typeof getApp === 'function' ? getApp({ allowDefault: true }) : null;
  if (app && app.globalData) {
    app.globalData.token = '';
    app.globalData.user = null;
  }
}

function isLoggedIn() {
  return Boolean(getToken());
}

function isCurrentUserManager() {
  return isManagerUser(getStoredUser());
}

function setLoginRedirect(path) {
  if (path) {
    setStorage(STORAGE_KEYS.LOGIN_REDIRECT, path);
  }
}

function getAndClearLoginRedirect() {
  const value = getStorage(STORAGE_KEYS.LOGIN_REDIRECT, '');
  removeStorage(STORAGE_KEYS.LOGIN_REDIRECT);
  return value;
}

function currentPagePath() {
  if (typeof getCurrentPages !== 'function') {
    return '';
  }
  const pages = getCurrentPages();
  const page = pages && pages.length ? pages[pages.length - 1] : null;
  if (!page || !page.route) {
    return '';
  }
  const options = page.options || {};
  const query = Object.keys(options)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
    .join('&');
  return query ? `/${page.route}?${query}` : `/${page.route}`;
}

function redirectToLogin(options) {
  const sourcePath = options && options.redirect ? options.redirect : currentPagePath();
  if (sourcePath && sourcePath.indexOf(ROUTES.LOGIN) < 0) {
    setLoginRedirect(sourcePath);
  }
  if (typeof wx !== 'undefined' && wx) {
    const loginUrl = routePath(ROUTES.LOGIN);
    if (typeof wx.reLaunch === 'function') {
      wx.reLaunch({ url: loginUrl });
      return;
    }
    if (typeof wx.navigateTo === 'function') {
      wx.navigateTo({ url: loginUrl });
    }
  }
}

function saveAlbumPrivateToken(albumId, value) {
  if (!albumId || !value || !value.token) {
    return;
  }
  setStorage(`${STORAGE_KEYS.ALBUM_PRIVATE_TOKEN_PREFIX}${albumId}`, value);
}

function getAlbumPrivateToken(albumId) {
  const value = getStorage(`${STORAGE_KEYS.ALBUM_PRIVATE_TOKEN_PREFIX}${albumId}`, null);
  if (!value || !value.token) {
    return '';
  }
  if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now()) {
    clearAlbumPrivateToken(albumId);
    return '';
  }
  return value.token;
}

function clearAlbumPrivateToken(albumId) {
  removeStorage(`${STORAGE_KEYS.ALBUM_PRIVATE_TOKEN_PREFIX}${albumId}`);
}

module.exports = {
  STORAGE_KEYS,
  getToken,
  onTokenChange,
  setToken,
  getStoredUser,
  setStoredUser,
  persistLoginSession,
  clearAuthSession,
  isLoggedIn,
  isCurrentUserManager,
  setLoginRedirect,
  getAndClearLoginRedirect,
  redirectToLogin,
  saveAlbumPrivateToken,
  getAlbumPrivateToken,
  clearAlbumPrivateToken
};
