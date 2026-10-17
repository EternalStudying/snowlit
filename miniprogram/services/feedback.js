const { request } = require('../utils/request');
const { uploadFile } = require('../utils/upload');

function uploadFeedbackImage(filePath, onProgress) {
  return uploadFile({
    url: '/api/feedback/screenshots',
    filePath,
    name: 'file',
    onProgress,
    errorMessage: '截图上传失败'
  });
}

function createFeedback(payload) {
  return request({
    url: '/api/feedback',
    method: 'POST',
    data: payload,
    errorMessage: '反馈提交失败'
  });
}

module.exports = {
  uploadFeedbackImage,
  createFeedback
};
