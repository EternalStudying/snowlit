const { config } = require('../constants/config');
const { getToken } = require('./auth');
const { createApiError, formatApiErrorMessage, handleUnauthorized, showApiError, resolveApiUrl } = require('./request');

function parseUploadData(data) {
  if (!data) {
    return null;
  }
  if (typeof data === 'object') {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    return data;
  }
}

function uploadFile(options) {
  const uploadOptions = options || {};
  const token = uploadOptions.skipAuth ? '' : getToken();
  const header = {
    ...(uploadOptions.header || {})
  };
  if (token) {
    header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const task = wx.uploadFile({
      url: resolveApiUrl(uploadOptions.url, config.uploadBaseUrl),
      filePath: uploadOptions.filePath,
      name: uploadOptions.name || 'file',
      formData: uploadOptions.formData || {},
      header,
      timeout: uploadOptions.timeout || config.uploadTimeout,
      success(response) {
        const statusCode = response.statusCode || 0;
        const data = parseUploadData(response.data);
        if (statusCode >= 200 && statusCode < 300) {
          resolve(data);
          return;
        }

        const message = formatApiErrorMessage(
          statusCode,
          data && data.code ? data.code : '',
          data && data.message ? data.message : '',
          uploadOptions.errorMessage || '上传失败'
        );
        const error = createApiError(
          message,
          statusCode,
          data && data.code ? data.code : '',
          data
        );
        if (statusCode === 401) {
          handleUnauthorized(uploadOptions);
        } else if (!uploadOptions.silent) {
          showApiError(error);
        }
        reject(error);
      },
      fail() {
        const error = createApiError(uploadOptions.networkErrorMessage || '上传连接失败', 0);
        if (!uploadOptions.silent) {
          showApiError(error);
        }
        reject(error);
      }
    });

    if (uploadOptions.onProgress && task && typeof task.onProgressUpdate === 'function') {
      task.onProgressUpdate(uploadOptions.onProgress);
    }
  });
}

module.exports = {
  uploadFile
};
