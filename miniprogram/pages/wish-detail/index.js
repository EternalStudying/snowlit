const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { completeWish, deleteWish: deleteWishEntry, getWishDetail, reopenWish } = require('../../services/wish');
const { getStoredUser } = require('../../utils/auth');
const { showConfirm } = require('../../utils/dialog');
const { showInfo, showSuccess } = require('../../utils/notify');
const { mapWishDetail } = require('../wishes/wish-presenter');

Page({
  data: {
    wish: null,
    wishId: '',
    deleting: false,
    statusSubmitting: false,
    completionSheetVisible: false,
    completionSubmitting: false,
    loading: true,
    message: ''
  },

  onLoad(options) {
    this.loadWish(options && options.wishId);
  },

  onPullDownRefresh() {
    this.loadWish(this.data.wishId).finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadWish(wishId) {
    if (!wishId) {
      this.setData({
        loading: false,
        message: '清单不存在'
      });
      return Promise.resolve();
    }

    this.setData({
      wishId,
      loading: true,
      message: ''
    });

    return getWishDetail(wishId)
      .then((response) => {
        this.setData({
          wish: mapWishDetail(response, getStoredUser()),
          loading: false
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          message: error && error.message ? error.message : '清单详情加载失败'
        });
      });
  },

  editWish() {
    if (!this.data.wish || !this.data.wish.canEdit || !this.data.wishId) {
      showInfo('只能修改自己的清单');
      return;
    }
    wx.navigateTo({
      url: withQuery(ROUTES.WISH_EDIT, { wishId: this.data.wishId })
    });
  },

  deleteWish() {
    if (!this.data.wish || !this.data.wish.canEdit || !this.data.wishId || this.data.deleting) {
      return;
    }

    showConfirm({
      title: '删除清单',
      content: '确定要删除这条清单吗？删除后会从列表里消失。',
      confirmText: '删除',
      cancelText: '取消'
    }).then((result) => {
      if (!result.confirm) {
        return;
      }
      this.setData({
        deleting: true,
        message: ''
      });
      deleteWishEntry(this.data.wishId)
        .then(() => {
          this.refreshWishPages();
          this.goBackAfterDelete();
        })
        .catch((error) => {
          this.setData({
            deleting: false,
            message: error && error.message ? error.message : '清单删除失败'
          });
        });
    });
  },

  toggleWishStatus() {
    if (!this.data.wish || !this.data.wish.canEdit || !this.data.wishId || this.data.statusSubmitting) {
      return;
    }

    if (!this.data.wish.completed) {
      this.openCompletionSheet();
      return;
    }

    this.setData({
      statusSubmitting: true,
      message: ''
    });

    reopenWish(this.data.wishId)
      .then(() => {
        this.refreshWishPages();
        showSuccess({
          title: '清单已经重新放回愿望里啦',
          duration: 1800
        });
        return this.loadWish(this.data.wishId);
      })
      .finally(() => {
        this.setData({ statusSubmitting: false });
      })
      .catch((error) => {
        this.setData({
          message: error && error.message ? error.message : '清单状态更新失败'
        });
      });
  },

  openCompletionSheet() {
    this.setData({
      completionSheetVisible: true,
      completionSubmitting: false,
      message: ''
    });
  },

  closeCompletionSheet() {
    if (this.data.completionSubmitting) {
      return;
    }
    this.setData({
      completionSheetVisible: false
    });
  },

  handleCompletionImageMissing() {
    showInfo('请先添加完成图片');
  },

  confirmCompleteWish(event) {
    const imagePath = event.detail && event.detail.imagePath;
    if (!this.data.wish || !this.data.wish.canEdit || !this.data.wishId || this.data.completionSubmitting || !imagePath) {
      return;
    }

    this.setData({
      completionSubmitting: true,
      statusSubmitting: true,
      message: ''
    });

    completeWish(this.data.wishId, imagePath)
      .then(() => {
        this.setData({
          completionSheetVisible: false,
          completionSubmitting: false
        });
        this.refreshWishPages();
        showSuccess({
          title: '清单已经点亮完成啦',
          duration: 1800
        });
        return this.loadWish(this.data.wishId);
      })
      .finally(() => {
        this.setData({
          statusSubmitting: false,
          completionSubmitting: false
        });
      })
      .catch((error) => {
        this.setData({
          message: error && error.message ? error.message : '清单状态更新失败'
        });
      });
  },

  refreshWishPages() {
    getCurrentPages().forEach((page) => {
      if (page && page.route === ROUTES.WISHES && typeof page.loadAllWishes === 'function') {
        page.loadAllWishes();
      }
    });
  },

  goBackAfterDelete() {
    const showDeleted = () => {
      showSuccess({
        title: '清单已经轻轻移走啦',
        duration: 1800
      });
    };

    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        success: showDeleted
      });
      return;
    }
    wx.switchTab({
      url: routePath(ROUTES.WISHES),
      success: showDeleted
    });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.WISHES) });
  },

  previewImage() {
    const image = this.data.wish && this.data.wish.image;
    if (!image) {
      return;
    }
    wx.previewImage({
      current: image,
      urls: [image]
    });
  }
});
