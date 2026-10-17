function canUseWxStorage() {
  return typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function';
}

function getStorage(key, fallbackValue) {
  if (!canUseWxStorage()) {
    return fallbackValue;
  }
  try {
    const value = wx.getStorageSync(key);
    return value === '' || value === undefined ? fallbackValue : value;
  } catch (error) {
    return fallbackValue;
  }
}

function setStorage(key, value) {
  if (!canUseWxStorage()) {
    return false;
  }
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function removeStorage(key) {
  if (!canUseWxStorage()) {
    return false;
  }
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (error) {
    return false;
  }
}

function getStorageKeys() {
  if (!canUseWxStorage()) {
    return [];
  }
  try {
    const info = wx.getStorageInfoSync();
    return info && Array.isArray(info.keys) ? info.keys : [];
  } catch (error) {
    return [];
  }
}

function removeStorageByPrefix(prefix) {
  getStorageKeys()
    .filter((key) => key.indexOf(prefix) === 0)
    .forEach((key) => removeStorage(key));
}

module.exports = {
  getStorage,
  setStorage,
  removeStorage,
  getStorageKeys,
  removeStorageByPrefix
};
