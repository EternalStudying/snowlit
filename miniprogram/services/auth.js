const { request } = require('../utils/request');

function wechatLogin(code) {
  return request({
    url: '/api/auth/wechat-login',
    method: 'POST',
    data: { code },
    skipAuth: true,
    silent: true,
    errorMessage: '微信登录失败'
  });
}

function wechatBindLogin(payload) {
  return request({
    url: '/api/auth/wechat-bind-login',
    method: 'POST',
    data: {
      code: payload && payload.code,
      username: payload && payload.username,
      password: payload && payload.password
    },
    skipAuth: true,
    silent: true,
    errorMessage: '微信绑定失败'
  });
}

function getCurrentUser() {
  return request({
    url: '/api/auth/me',
    method: 'GET',
    errorMessage: '登录状态已失效'
  });
}

function logout() {
  return request({
    url: '/api/auth/logout',
    method: 'POST',
    errorMessage: '退出登录失败'
  });
}

module.exports = {
  wechatLogin,
  wechatBindLogin,
  getCurrentUser,
  logout
};
