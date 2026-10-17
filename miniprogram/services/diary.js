const { request, buildQuery } = require('../utils/request');
const { uploadFile } = require('../utils/upload');

function getDiaryMonths(year) {
  return request({
    url: `/api/diary/months${buildQuery({ year })}`,
    method: 'GET',
    errorMessage: '日记月份加载失败'
  });
}

function getDiaryMonth(month) {
  return request({
    url: `/api/diary${buildQuery({ month })}`,
    method: 'GET',
    errorMessage: '日记列表加载失败'
  });
}

function getDiaryDetail(id) {
  return request({
    url: `/api/diary/${id}`,
    method: 'GET',
    errorMessage: '日记详情加载失败'
  });
}

function createDiary(payload) {
  return request({
    url: '/api/diary',
    method: 'POST',
    data: payload,
    errorMessage: '日记保存失败'
  });
}

function updateDiary(id, payload) {
  return request({
    url: `/api/diary/${id}`,
    method: 'PUT',
    data: payload,
    errorMessage: '日记修改失败'
  });
}

function deleteDiary(id) {
  return request({
    url: `/api/diary/${id}`,
    method: 'DELETE',
    errorMessage: '日记删除失败'
  });
}

function uploadDiaryImage(filePath, onProgress) {
  return uploadFile({
    url: '/api/diary/images',
    filePath,
    name: 'file',
    errorMessage: '日记图片上传失败',
    onProgress
  });
}

module.exports = {
  createDiary,
  deleteDiary,
  getDiaryMonths,
  getDiaryMonth,
  getDiaryDetail,
  updateDiary,
  uploadDiaryImage
};
