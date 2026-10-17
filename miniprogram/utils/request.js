const { config } = require('../constants/config');
const { getToken, clearAuthSession, redirectToLogin } = require('./auth');
const { showAlert } = require('./dialog');
const { showError } = require('./notify');

let unauthorizedPrompting = false;

function resolveApiUrl(url, baseUrl) {
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  const base = (baseUrl || config.apiBaseUrl).replace(/\/$/, '');
  const path = url.charAt(0) === '/' ? url : `/${url}`;
  return `${base}${path}`;
}

function createApiError(message, statusCode, code, payload) {
  const error = new Error(message || '请求失败');
  error.name = 'SnowlitApiError';
  error.statusCode = statusCode || 0;
  error.code = code || '';
  error.payload = payload || null;
  return error;
}

function formatApiErrorMessage(statusCode, code, message, fallbackMessage, options) {
  const normalizedCode = String(code || '');
  const isAuthRequest = options && options.skipAuth;
  if (statusCode === 401 && !isAuthRequest && normalizedCode.indexOf('PRIVATE_ALBUM_') !== 0) {
    return '登录已过期';
  }
  if (statusCode === 403) {
    return '当前账号没有操作权限';
  }
  if (statusCode === 404) {
    return '内容不存在或已删除';
  }
  if (statusCode >= 500) {
    return '服务繁忙，请稍后重试';
  }
  return message || fallbackMessage || '请求失败';
}

function readErrorPayload(data, fallbackMessage) {
  if (data && typeof data === 'object') {
    return {
      message: data.message || fallbackMessage,
      code: data.code || '',
      payload: data
    };
  }
  return {
    message: fallbackMessage,
    code: '',
    payload: data || null
  };
}

function showApiError(error) {
  showError({
    title: error.message || '请求失败',
    duration: 2200
  });
}

function handleUnauthorized(options) {
  clearAuthSession();
  if (options && options.redirectOnUnauthorized === false) {
    return Promise.resolve(false);
  }
  if (unauthorizedPrompting) {
    return Promise.resolve(false);
  }

  unauthorizedPrompting = true;
  return showAlert({
    title: '登录已过期',
    content: '需要重新登录后继续查看',
    confirmText: '去登录'
  })
    .catch(() => ({ confirm: true }))
    .then(() => {
      redirectToLogin(options && options.redirect ? { redirect: options.redirect } : undefined);
      return true;
    })
    .finally(() => {
      unauthorizedPrompting = false;
    });
}

function request(options) {
  const requestOptions = options || {};
  const method = requestOptions.method || 'GET';
  const token = requestOptions.skipAuth ? '' : getToken();
  const header = {
    ...(requestOptions.header || {})
  };

  if (token) {
    header.Authorization = `Bearer ${token}`;
  }
  if (method !== 'GET' && requestOptions.data !== undefined && !header['Content-Type']) {
    header['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: resolveApiUrl(requestOptions.url),
      method,
      data: requestOptions.data,
      header,
      timeout: requestOptions.timeout || config.requestTimeout,
      success(response) {
        const statusCode = response.statusCode || 0;
        if (statusCode >= 200 && statusCode < 300) {
          resolve(requestOptions.raw ? response : response.data);
          return;
        }

        const payload = readErrorPayload(response.data, requestOptions.errorMessage || '请求失败');
        const message = formatApiErrorMessage(statusCode, payload.code, payload.message, requestOptions.errorMessage, requestOptions);
        const error = createApiError(message, statusCode, payload.code, payload.payload);
        const isUnauthorized = statusCode === 401
          && !requestOptions.skipAuth
          && String(payload.code || '').indexOf('PRIVATE_ALBUM_') !== 0;
        if (isUnauthorized) {
          handleUnauthorized(requestOptions);
        } else if (!requestOptions.silent) {
          showApiError(error);
        }
        reject(error);
      },
      fail() {
        const error = createApiError(requestOptions.networkErrorMessage || '网络连接失败', 0);
        if (!requestOptions.silent) {
          showApiError(error);
        }
        reject(error);
      }
    });
  });
}

function buildQuery(params) {
  const query = Object.keys(params || {})
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  return query ? `?${query}` : '';
}

module.exports = {
  request,
  resolveApiUrl,
  createApiError,
  formatApiErrorMessage,
  showApiError,
  handleUnauthorized,
  buildQuery
};
