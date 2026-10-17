Component({
  data: {
    visible: false,
    title: '隐私授权',
    message: '继续使用前，需要先阅读并同意用户隐私保护指引。',
    contractName: '用户隐私保护指引'
  },

  lifetimes: {
    detached() {
      this.finish(false);
    }
  },

  methods: {
    authorize(options) {
      const next = options || {};
      return this.checkPrivacySetting().then((setting) => {
        if (!setting.needAuthorization) {
          return true;
        }
        return new Promise((resolve) => {
          if (this._privacyResolver) {
            this.finish(false);
          }
          this._privacyResolver = resolve;
          this.setData({
            visible: true,
            title: next.title || '隐私授权',
            message: next.message || '继续使用前，需要先阅读并同意用户隐私保护指引。',
            contractName: setting.privacyContractName || '用户隐私保护指引'
          });
        });
      });
    },

    checkPrivacySetting() {
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
    },

    openContract() {
      if (typeof wx !== 'undefined' && typeof wx.openPrivacyContract === 'function') {
        wx.openPrivacyContract({});
      }
    },

    handleAgree() {
      this.finish(true);
    },

    handleReject() {
      this.finish(false);
    },

    noop() {},

    finish(result) {
      const resolver = this._privacyResolver;
      this._privacyResolver = null;
      if (this.data.visible) {
        this.setData({ visible: false });
      }
      if (resolver) {
        resolver(result);
      }
    }
  }
});
