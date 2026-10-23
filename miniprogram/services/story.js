const { request, buildQuery } = require('../utils/request');
const { uploadFile } = require('../utils/upload');

function getMoments(filters) {
  return request({
    url: `/api/story/moments${buildQuery(filters)}`,
    method: 'GET',
    errorMessage: '点滴加载失败'
  });
}

function getMomentDetail(id) {
  return request({
    url: `/api/story/moments/${id}`,
    method: 'GET',
    errorMessage: '点滴详情加载失败'
  });
}

function createMoment(payload) {
  return request({
    url: '/api/story/moments',
    method: 'POST',
    data: payload,
    errorMessage: '点滴发布失败'
  });
}

function updateMoment(id, payload) {
  return request({
    url: `/api/story/moments/${id}`,
    method: 'PUT',
    data: payload,
    errorMessage: '点滴修改失败'
  });
}

function deleteMoment(id) {
  return request({
    url: `/api/story/moments/${id}`,
    method: 'DELETE',
    errorMessage: '点滴删除失败'
  });
}

function uploadMomentImage(filePath, onProgress) {
  return uploadFile({
    url: '/api/story/moments/images',
    filePath,
    name: 'file',
    onProgress,
    errorMessage: '点滴图片上传失败'
  });
}

// Worldwide place search for a moment's location; results are already in the stored map datum.
function searchPlaces(query) {
  return request({
    url: `/api/story/places${buildQuery({ q: query })}`,
    method: 'GET',
    errorMessage: '地点搜索失败'
  });
}

module.exports = {
  deleteMoment,
  searchPlaces,
  getMoments,
  getMomentDetail,
  createMoment,
  updateMoment,
  uploadMomentImage
};
