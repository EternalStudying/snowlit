const { showInfo } = require('../../utils/notify');
const { authorizePrivacy } = require('../../utils/privacy');

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    submitting: {
      type: Boolean,
      value: false
    }
  },

  data: {
    mounted: false,
    imagePath: ''
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
            this.setData({
              mounted: false,
              imagePath: ''
            });
          }
        }, 280);
      }
    }
  },

  methods: {
    noop() {},

    chooseImage() {
      if (this.data.submitting) {
        return;
      }

      authorizePrivacy({
        title: '选择完成照片',
        message: '需要读取你选中的照片，用于记录清单完成瞬间。'
      }).then((agreed) => {
        if (!agreed) {
          showInfo('同意隐私指引后才能选择照片');
          return;
        }
        if (this.data.submitting) {
          return;
        }

        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: (result) => {
            if (this.data.submitting || this.data.visible === false) {
              return;
            }
            const files = Array.isArray(result.tempFiles) ? result.tempFiles : [];
            const imagePath = files[0] && files[0].tempFilePath ? files[0].tempFilePath : '';
            if (imagePath) {
              this.setData({ imagePath });
            }
          },
          fail: (error) => {
            if (!/cancel/i.test((error && error.errMsg) || '')) {
              showInfo('选择照片失败，请检查权限后重试');
            }
          }
        });
      });
    },

    removeImage() {
      if (this.data.submitting) {
        return;
      }
      this.setData({ imagePath: '' });
    },

    handleCancel() {
      if (this.data.submitting) {
        return;
      }
      this.triggerEvent('cancel');
    },

    handleConfirm() {
      if (!this.data.imagePath) {
        this.triggerEvent('missing');
        return;
      }
      this.triggerEvent('confirm', {
        imagePath: this.data.imagePath
      });
    }
  }
});
