const { uploadFile } = require('../utils/upload');
const { request, buildQuery } = require('../utils/request');
const { saveAlbumPrivateToken, getAlbumPrivateToken, clearAlbumPrivateToken } = require('../utils/auth');

const TOKEN_ERROR_CODES = ['PRIVATE_ALBUM_TOKEN_EXPIRED', 'PRIVATE_ALBUM_TOKEN_INVALID'];

function getAlbums(params) {
  return request({
    url: `/api/albums${buildQuery({
      page: params && params.page ? params.page : 1,
      size: params && params.size ? params.size : 5,
      previewLimit: params && params.previewLimit ? params.previewLimit : 9
    })}`,
    method: 'GET',
    errorMessage: '相册加载失败'
  });
}

function getAlbumDetail(albumId, privateAccessToken, options) {
  const token = privateAccessToken || getAlbumPrivateToken(albumId);
  return request({
    url: `/api/albums/${albumId}`,
    method: 'GET',
    header: token ? { 'X-Album-Access-Token': token } : {},
    errorMessage: '相册详情加载失败',
    silent: Boolean(options && options.silent)
  }).catch((error) => {
    if (TOKEN_ERROR_CODES.indexOf(error.code) >= 0) {
      clearAlbumPrivateToken(albumId);
    }
    throw error;
  });
}

function unlockAlbum(albumId, password) {
  return request({
    url: `/api/albums/${albumId}/unlock`,
    method: 'POST',
    data: { password },
    errorMessage: '相册解锁失败'
  }).then((response) => {
    if (response && response.privateAccessToken) {
      saveAlbumPrivateToken(albumId, {
        token: response.privateAccessToken,
        expiresAt: response.expiresAt
      });
    }
    return response;
  });
}

function likeAlbum(albumId) {
  return request({
    url: `/api/albums/${albumId}/like`,
    method: 'POST',
    errorMessage: '喜欢失败'
  }).then((response) => {
    const result = response || {};
    return {
      ...result,
      likedToday: Boolean(result.likedToday)
    };
  });
}

function recordAlbumView(albumId) {
  const token = getAlbumPrivateToken(albumId);
  return request({
    url: `/api/albums/${albumId}/view`,
    method: 'POST',
    header: token ? { 'X-Album-Access-Token': token } : {},
    silent: true,
    errorMessage: '浏览记录保存失败'
  });
}

function startAlbumEdit(albumId) {
  return request({ url: `/api/albums/${albumId}/edit`, method: 'POST', silent: true, errorMessage: '相册编辑加载失败' });
}

function uploadAlbumEditPhoto(albumId, filePath, metadata, onProgress) {
  return uploadFile({ url: `/api/albums/${albumId}/edit/photos`, filePath, name: 'file', formData: { metadata: JSON.stringify(metadata) }, onProgress, silent: true, errorMessage: '相册照片上传失败' });
}

function removeAlbumEditPhoto(albumId, draftImageId) {
  return request({ url: `/api/albums/${albumId}/edit/photos/${encodeURIComponent(draftImageId)}`, method: 'DELETE', silent: true, errorMessage: '照片删除失败' });
}

function cancelAlbumEdit(albumId) {
  return request({ url: `/api/albums/${albumId}/edit`, method: 'DELETE', silent: true, errorMessage: '取消修改失败' });
}

function saveAlbum(albumId, payload) {
  return request({ url: `/api/albums/${albumId}`, method: 'PUT', data: payload, silent: true, errorMessage: '相册保存失败' });
}

function deleteAlbum(albumId) {
  return request({ url: `/api/albums/${albumId}`, method: 'DELETE', silent: true, errorMessage: '相册删除失败' });
}

module.exports = {
  startAlbumEdit, uploadAlbumEditPhoto, removeAlbumEditPhoto, cancelAlbumEdit, saveAlbum, deleteAlbum,
  getAlbums,
  getAlbumDetail,
  unlockAlbum,
  likeAlbum,
  recordAlbumView,
  getAlbumPrivateToken,
  clearAlbumPrivateToken
};
