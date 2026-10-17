Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '选择'
    },
    cancelText: {
      type: String,
      value: '取消'
    },
    options: {
      type: Array,
      value: []
    },
    value: {
      type: String,
      value: ''
    }
  },

  data: {
    mounted: false
  },

  observers: {
    visible(visible) {
      if (visible) {
        this.setData({ mounted: true });
        return;
      }
      if (this.data.mounted) {
        setTimeout(() => {
          if (!this.data.visible) {
            this.setData({ mounted: false });
          }
        }, 280);
      }
    }
  },

  methods: {
    noop() {},

    handleCancel() {
      this.triggerEvent('cancel');
    },

    handleOptionTap(event) {
      const value = event.currentTarget.dataset.value || '';
      const options = Array.isArray(this.data.options) ? this.data.options : [];
      const option = options.find((item) => item && item.value === value) || null;
      this.triggerEvent('select', {
        value,
        option
      });
    }
  }
});
