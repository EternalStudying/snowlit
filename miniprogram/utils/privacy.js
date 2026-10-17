function getPrivacyComponent() {
  if (typeof getCurrentPages !== 'function') {
    return null;
  }
  const pages = getCurrentPages();
  const page = pages && pages.length ? pages[pages.length - 1] : null;
  if (!page || typeof page.selectComponent !== 'function') {
    return null;
  }
  return page.selectComponent('#snowlit-privacy');
}

function checkPrivacySetting() {
  if (typeof wx === 'undefined' || typeof wx.getPrivacySetting !== 'function') {
    return Promise.resolve({ needAuthorization: false });
  }
  return new Promise((resolve) => {
    wx.getPrivacySetting({
      success(response) {
        resolve(response || { needAuthorization: false });
      },
      fail() {
        resolve({ needAuthorization: false });
      }
    });
  });
}

function authorizePrivacy(options) {
  const component = getPrivacyComponent();
  if (component && typeof component.authorize === 'function') {
    return component.authorize(options || {});
  }

  return checkPrivacySetting().then((setting) => !setting.needAuthorization);
}

module.exports = {
  authorizePrivacy,
  checkPrivacySetting
};
