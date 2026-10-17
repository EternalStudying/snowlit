const TOAST_SELECTOR = '#snowlit-toast';
const DEFAULT_DURATION = 2200;
const DEFAULT_PLACEMENT = 'bottom';

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeType(value, fallback) {
  const type = clean(value || fallback || 'info').toLowerCase();
  if (type === 'success') {
    return 'success';
  }
  if (type === 'loading') {
    return 'loading';
  }
  if (type === 'warning' || type === 'warn') {
    return 'warning';
  }
  if (type === 'error' || type === 'fail' || type === 'danger') {
    return 'error';
  }
  return 'info';
}

function normalizePlacement(value) {
  const placement = clean(value).toLowerCase();
  return ['top', 'middle', 'bottom'].indexOf(placement) >= 0 ? placement : DEFAULT_PLACEMENT;
}

function normalizeDuration(value) {
  if (value === 0) {
    return 0;
  }
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION;
}

function normalizeToastOptions(options, defaults) {
  const source = typeof options === 'string' ? { title: options } : { ...(options || {}) };
  const base = defaults || {};
  const title = clean(source.title || source.message || source.content || base.title || base.message) || '操作完成';
  const message = clean(source.message && source.title ? source.message : source.description);

  return {
    type: normalizeType(source.type || source.theme || source.icon, base.type),
    title,
    message,
    placement: normalizePlacement(source.placement || source.position || base.placement),
    duration: normalizeDuration(source.duration !== undefined ? source.duration : base.duration)
  };
}

function getCurrentToast() {
  if (typeof getCurrentPages !== 'function') {
    return null;
  }
  const pages = getCurrentPages();
  const page = pages && pages.length ? pages[pages.length - 1] : null;
  if (!page || typeof page.selectComponent !== 'function') {
    return null;
  }
  const toast = page.selectComponent(TOAST_SELECTOR);
  return toast && typeof toast.show === 'function' ? toast : null;
}

function fallbackToast(options) {
  if (typeof wx === 'undefined' || !wx || typeof wx.showToast !== 'function') {
    return;
  }
  wx.showToast({
    title: options.title,
    icon: options.type === 'success' || options.type === 'loading' ? options.type : 'none',
    duration: options.duration || DEFAULT_DURATION,
    mask: false
  });
}

function showToast(options, defaults) {
  const normalized = normalizeToastOptions(options, defaults);
  const toast = getCurrentToast();
  if (toast) {
    toast.show(normalized);
  } else {
    fallbackToast(normalized);
  }
  return normalized;
}

function withType(options, type) {
  if (typeof options === 'string') {
    return { title: options, type };
  }
  return {
    ...(options || {}),
    type: options && options.type ? options.type : type
  };
}

function showSuccess(options) {
  return showToast(withType(options, 'success'));
}

function showError(options) {
  return showToast(withType(options, 'error'));
}

function showInfo(options) {
  return showToast(withType(options, 'info'));
}

function showWarning(options) {
  return showToast(withType(options, 'warning'));
}

function showLoading(options) {
  return showToast({
    ...withType(options || '加载中', 'loading'),
    duration: options && options.duration !== undefined ? options.duration : 0
  });
}

function hideToast() {
  const toast = getCurrentToast();
  if (toast && typeof toast.hide === 'function') {
    toast.hide();
    return;
  }
  if (typeof wx !== 'undefined' && wx && typeof wx.hideToast === 'function') {
    wx.hideToast();
  }
}

module.exports = {
  DEFAULT_DURATION,
  DEFAULT_PLACEMENT,
  TOAST_SELECTOR,
  hideToast,
  normalizeToastOptions,
  showError,
  showInfo,
  showLoading,
  showSuccess,
  showToast,
  showWarning
};
