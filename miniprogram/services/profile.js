const { request } = require('../utils/request');

function updateProfile(payload) {
  const source = payload || {};
  return request({
    url: '/api/auth/me/profile',
    method: 'PATCH',
    data: {
      displayName: source.displayName,
      mood: source.mood,
      bio: source.bio
    },
    errorMessage: '资料保存失败'
  });
}

module.exports = {
  updateProfile
};
