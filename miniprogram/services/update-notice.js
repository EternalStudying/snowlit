const { request } = require('../utils/request');

function getUpdateNotice() {
  return request({
    url: '/api/update-notice?client=miniprogram',
    method: 'GET',
    errorMessage: '公告加载失败'
  });
}

function muteUpdateNoticeToday() {
  return request({
    url: '/api/update-notice/mute-today?client=miniprogram',
    method: 'POST',
    errorMessage: '公告状态更新失败'
  });
}

module.exports = {
  getUpdateNotice,
  muteUpdateNoticeToday
};
