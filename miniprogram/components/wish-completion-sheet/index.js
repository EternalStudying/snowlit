const { showInfo } = require('../../utils/notify');
const { readPickedPath } = require('../../utils/image-list');
const { pickImages } = require('../../utils/image-picker');

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

      pickImages({
        count: 1,
        title: '选择完成照片',
        message: '需要读取你选中的照片，用于记录清单完成瞬间。',
        noun: '照片',
        isBlocked: () => this.data.submitting || this.data.visible === false
      }).then((files) => {
        const imagePath = readPickedPath(files[0]);
        if (imagePath) {
          this.setData({ imagePath });
        }
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
