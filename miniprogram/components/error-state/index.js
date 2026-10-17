Component({
  properties: {
    title: {
      type: String,
      value: '加载失败'
    },
    message: {
      type: String,
      value: '请稍后再试'
    },
    actionText: {
      type: String,
      value: '重试'
    }
  },

  methods: {
    handleRetry() {
      this.triggerEvent('retry');
    }
  }
});
