const { request } = require('../utils/request');
const { uploadFile } = require('../utils/upload');

function draftPath(kind) {
  return `/api/drafts/${encodeURIComponent(kind)}`;
}

function getDraft(kind) {
  return request({ url: draftPath(kind), method: 'GET', silent: true, errorMessage: '草稿加载失败' });
}

function saveDraft(kind, fields) {
  return request({ url: draftPath(kind), method: 'PUT', data: { fields }, silent: true, errorMessage: '草稿保存失败' });
}

function discardDraft(kind) {
  return request({ url: draftPath(kind), method: 'DELETE', silent: true, errorMessage: '草稿删除失败' });
}

function uploadDraftImage(kind, filePath, metadata, onProgress) {
  return uploadFile({
    url: `${draftPath(kind)}/images`, filePath, name: 'file',
    formData: kind === 'album' ? { metadata: JSON.stringify(metadata || {}) } : {},
    onProgress, silent: true, errorMessage: '草稿图片上传失败'
  });
}

function removeDraftImage(kind, imageId) {
  return request({ url: `${draftPath(kind)}/images/${encodeURIComponent(imageId)}`, method: 'DELETE', silent: true, errorMessage: '图片删除失败' });
}

function reorderDraftImages(kind, ids) {
  return request({ url: `${draftPath(kind)}/images/order`, method: 'PUT', data: { ids }, silent: true, errorMessage: '照片排序保存失败' });
}

function publishDraft(kind, fields, extra) {
  return request({ url: `${draftPath(kind)}/publish`, method: 'POST', data: { fields, ...(extra || {}) }, silent: true, errorMessage: '发布失败，请稍后重试' });
}

module.exports = { reorderDraftImages, getDraft, saveDraft, discardDraft, uploadDraftImage, removeDraftImage, publishDraft };
