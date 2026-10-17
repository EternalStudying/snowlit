Component({
  data: {
    mounted: false,
    visible: false,
    title: '',
    content: '',
    confirmText: '知道了',
    cancelText: '取消',
    showCancel: false,
    closeOnMask: false
  },

  lifetimes: {
    detached() {
      this.resolvePending({ confirm: false, cancel: true });
      this.clearTimer();
    }
  },

  methods: {
    open(options) {
      const next = options || {};
      this.resolvePending({ confirm: false, cancel: true });
      this.clearTimer();

      this.setData({
        mounted: true,
        visible: true,
        title: next.title || '提示',
        content: next.content || '',
        confirmText: next.confirmText || '知道了',
        cancelText: next.cancelText || '取消',
        showCancel: Boolean(next.showCancel),
        closeOnMask: Boolean(next.closeOnMask)
      });

      return new Promise((resolve) => {
        this._resolver = resolve;
      });
    },

    handleConfirm() {
      this.close({ confirm: true, cancel: false });
    },

    handleCancel() {
      this.close({ confirm: false, cancel: true });
    },

    handleMaskTap() {
      if (this.data.closeOnMask) {
        this.handleCancel();
      }
    },

    noop() {},

    close(result) {
      this.clearTimer();
      this.setData({ visible: false });
      this._mountTimer = setTimeout(() => {
        this.setData({ mounted: false });
        this.resolvePending(result);
      }, 180);
    },

    resolvePending(result) {
      if (!this._resolver) {
        return;
      }
      const resolver = this._resolver;
      this._resolver = null;
      resolver(result);
    },

    clearTimer() {
      if (this._mountTimer) {
        clearTimeout(this._mountTimer);
        this._mountTimer = null;
      }
    }
  }
});
