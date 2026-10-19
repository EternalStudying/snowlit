const { authorizePrivacy } = require('./privacy');
const { showInfo } = require('./notify');

/**
 * The one way to pick images: privacy consent, then the native picker (album or camera, compressed).
 * Resolves with the picked temp files, or [] when the person declines, cancels, or `isBlocked()`
 * turns true while the consent prompt or picker was open. Declining and failures show a toast;
 * cancelling stays quiet.
 */
function pickImages(options) {
  const { count, title, message, noun = '图片' } = options;
  const isBlocked = options.isBlocked || (() => false);

  return authorizePrivacy({ title, message }).then((agreed) => {
    if (!agreed) {
      showInfo(`同意隐私指引后才能选择${noun}`);
      return [];
    }
    if (isBlocked()) {
      return [];
    }
    return new Promise((resolve) => {
      wx.chooseMedia({
        count,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (response) => {
          resolve(isBlocked() || !Array.isArray(response.tempFiles) ? [] : response.tempFiles);
        },
        fail: (error) => {
          if (!/cancel/i.test((error && error.errMsg) || '')) {
            showInfo(`选择${noun}失败，请检查权限后重试`);
          }
          resolve([]);
        }
      });
    });
  });
}

module.exports = {
  pickImages
};
