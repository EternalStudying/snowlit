const { request, buildQuery } = require('../utils/request');
const { uploadFile } = require('../utils/upload');

function getWishes(params) {
  return request({
    url: `/api/wishes${buildQuery({
      category: params && params.category,
      completed: params && params.completed,
      page: params && params.page ? params.page : 1,
      size: params && params.size ? params.size : 10
    })}`,
    method: 'GET',
    errorMessage: '清单加载失败'
  });
}

function getWishDetail(id) {
  return request({
    url: `/api/wishes/${id}`,
    method: 'GET',
    errorMessage: '清单详情加载失败'
  });
}

function getWishSummary() {
  return request({
    url: '/api/wishes/summary',
    method: 'GET',
    errorMessage: '清单统计加载失败'
  });
}

function buildWishCreateMultipart(payload) {
  const boundary = `snowlit-wish-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const data = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="payload"',
    'Content-Type: application/json',
    '',
    JSON.stringify(payload || {}),
    `--${boundary}--`,
    ''
  ].join('\r\n');

  return {
    boundary,
    data
  };
}

function createWish(payload) {
  const multipart = buildWishCreateMultipart(payload);
  return request({
    url: '/api/wishes',
    method: 'POST',
    data: multipart.data,
    header: {
      'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`
    },
    errorMessage: '新增清单失败'
  });
}

function updateWish(id, payload) {
  return request({
    url: `/api/wishes/${id}`,
    method: 'PUT',
    data: payload,
    errorMessage: '保存清单失败'
  });
}

function deleteWish(id) {
  return request({
    url: `/api/wishes/${id}`,
    method: 'DELETE',
    errorMessage: '删除清单失败'
  });
}

function completeWish(id, imagePath) {
  if (!imagePath) {
    return Promise.reject(new Error('请先添加完成图片'));
  }

  return uploadFile({
    url: `/api/wishes/${id}/complete`,
    filePath: imagePath,
    name: 'image',
    errorMessage: '完成清单失败'
  });
}

function reopenWish(id) {
  return request({
    url: `/api/wishes/${id}/reopen`,
    method: 'POST',
    errorMessage: '恢复清单失败'
  });
}

module.exports = {
  buildWishCreateMultipart,
  completeWish,
  createWish,
  deleteWish,
  getWishes,
  getWishDetail,
  getWishSummary,
  reopenWish,
  updateWish
};
