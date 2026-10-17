const { request } = require('../utils/request');

function getHomeData() {
  return request({
    url: '/api/home',
    method: 'GET',
    errorMessage: '首页数据加载失败'
  });
}

function updateHomeLocation(payload) {
  return request({
    url: '/api/home/location',
    method: 'POST',
    data: payload,
    errorMessage: '位置状态更新失败'
  });
}

module.exports = {
  getHomeData,
  updateHomeLocation
};
