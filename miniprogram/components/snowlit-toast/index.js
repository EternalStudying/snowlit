Component({
  data: {
    mounted: false,
    visible: false,
    type: 'info',
    title: '',
    message: '',
    placement: 'top'
  },

  lifetimes: {
    detached() {
      this.clearTimer();
    }
  },

  methods: {
    show(options) {
      const next = options || {};
      this.clearTimer();
      this.setData({
        mounted: true,
        visible: true,
        type: next.type || 'info',
        title: next.title || '',
        message: next.message || '',
        placement: next.placement || 'top'
      });

      if (next.duration > 0) {
        this._hideTimer = setTimeout(() => {
          this.hide();
        }, next.duration);
      }
    },

    hide() {
      this.clearTimer();
      if (!this.data.mounted) {
        return;
      }
      this.setData({ visible: false });
      this._mountTimer = setTimeout(() => {
        this.setData({ mounted: false });
      }, 560);
    },

    noop() {},

    clearTimer() {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
      if (this._mountTimer) {
        clearTimeout(this._mountTimer);
        this._mountTimer = null;
      }
    }
  }
});
