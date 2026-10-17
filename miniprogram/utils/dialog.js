const DIALOG_SELECTOR = '#snowlit-dialog';

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeDialogOptions(options, defaults) {
  const source = typeof options === 'string' ? { content: options } : { ...(options || {}) };
  const base = defaults || {};
  const showCancel = source.showCancel !== undefined ? Boolean(source.showCancel) : Boolean(base.showCancel);

  return {
    title: clean(source.title || base.title) || '提示',
    content: clean(source.content || source.message || base.content || base.message),
    confirmText: clean(source.confirmText || base.confirmText) || (showCancel ? '确定' : '知道了'),
    cancelText: clean(source.cancelText || base.cancelText) || '取消',
    showCancel,
    closeOnMask: source.closeOnMask !== undefined ? Boolean(source.closeOnMask) : Boolean(base.closeOnMask)
  };
}

function getCurrentDialog() {
  if (typeof getCurrentPages !== 'function') {
    return null;
  }
  const pages = getCurrentPages();
  const page = pages && pages.length ? pages[pages.length - 1] : null;
  if (!page || typeof page.selectComponent !== 'function') {
    return null;
  }
  const dialog = page.selectComponent(DIALOG_SELECTOR);
  return dialog && typeof dialog.open === 'function' ? dialog : null;
}

function fallbackDialog(options) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx || typeof wx.showModal !== 'function') {
      resolve({ confirm: false, cancel: true });
      return;
    }

    wx.showModal({
      title: options.title,
      content: options.content,
      showCancel: options.showCancel,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      success: resolve,
      fail: reject
    });
  });
}

function showDialog(options, defaults) {
  const normalized = normalizeDialogOptions(options, defaults);
  const dialog = getCurrentDialog();
  if (dialog) {
    return dialog.open(normalized);
  }
  return fallbackDialog(normalized);
}

function showAlert(options) {
  return showDialog(options, { showCancel: false });
}

function showConfirm(options) {
  return showDialog(options, { showCancel: true });
}

module.exports = {
  DIALOG_SELECTOR,
  normalizeDialogOptions,
  showAlert,
  showConfirm,
  showDialog
};
