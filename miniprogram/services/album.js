const { request, buildQuery } = require('../utils/request');
const { uploadFile } = require('../utils/upload');
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

function getCurrentAlbumDraft(options) {
  return request({
    url: '/api/albums/drafts/current',
    method: 'GET',
    silent: Boolean(options && options.silent),
    errorMessage: '未完成相册加载失败'
  });
}

function createAlbumDraft(payload, options) {
  return request({
    url: '/api/albums',
    method: 'POST',
    data: payload,
    silent: Boolean(options && options.silent),
    errorMessage: '相册保存失败'
  });
}

function uploadAlbumDraftPhoto(albumId, filePath, metadata, onProgress) {
  return uploadFile({
    url: `/api/albums/${albumId}/photos/mobile`,
    filePath,
    name: 'file',
    formData: {
      metadata: JSON.stringify(metadata || {})
    },
    onProgress,
    errorMessage: '相册照片上传失败'
  }).then((response) => ({
    ...(response || {}),
    // UI-local field for existing upload state. Backend contract is previewUrl/originalUrl.
    url: response && response.previewUrl ? response.previewUrl : ''
  }));
}

function publishAlbumDraft(albumId) {
  return request({
    url: `/api/albums/${albumId}/publish`,
    method: 'POST',
    errorMessage: '相册发布失败'
  });
}

function cancelAlbumDraft(albumId) {
  return request({
    url: `/api/albums/${albumId}/draft`,
    method: 'DELETE',
    silent: true,
    errorMessage: '相册临时内容清理失败'
  });
}

module.exports = {
  getAlbums,
  getAlbumDetail,
  unlockAlbum,
  likeAlbum,
  recordAlbumView,
  getCurrentAlbumDraft,
  createAlbumDraft,
  uploadAlbumDraftPhoto,
  publishAlbumDraft,
  cancelAlbumDraft,
  getAlbumPrivateToken,
  clearAlbumPrivateToken
};
