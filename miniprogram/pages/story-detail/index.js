const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { deleteMoment: deleteStoryMoment, getMomentDetail } = require('../../services/story');
const { getStoredUser } = require('../../utils/auth');
const { showConfirm } = require('../../utils/dialog');
const { showInfo, showSuccess } = require('../../utils/notify');
const { mapStoryDetail } = require('../story/story-presenter');

Page({
  data: {
    momentId: '',
    moment: mapStoryDetail(null),
    deleting: false,
    loading: false,
    message: ''
  },

  onLoad(options) {
    const id = options && options.id;
    if (!id) {
      this.setData({ message: '点滴不存在' });
      return;
    }
    this.setData({ momentId: id });
    this.loadMoment();
  },

  onPullDownRefresh() {
    this.loadMoment().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.navigateTo({ url: routePath(ROUTES.STORY) });
  },

  editMoment() {
    if (!this.data.moment || !this.data.moment.canManage || !this.data.momentId) {
      showInfo('当前账号没有管理权限');
      return;
    }
    wx.navigateTo({
      url: withQuery(ROUTES.STORY_EDIT, { id: this.data.momentId })
    });
  },

  deleteMoment() {
    if (!this.data.moment || !this.data.moment.canManage || !this.data.momentId || this.data.deleting) {
      return;
    }

    showConfirm({
      title: '删除点滴',
      content: '确定要删除这条点滴吗？删除后会从列表里消失。',
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
      deleteStoryMoment(this.data.momentId)
        .then(() => {
          this.refreshStoryPage();
          this.goBackAfterDelete();
        })
        .catch((error) => {
          this.setData({
            deleting: false,
            message: error && error.message ? error.message : '点滴删除失败'
          });
        });
    });
  },

  refreshStoryPage() {
    const pages = getCurrentPages();
    pages.forEach((page) => {
      if (page && page.route === ROUTES.STORY && typeof page.loadMoments === 'function') {
        page.loadMoments({ refreshYears: true });
      }
    });
  },

  goBackAfterDelete() {
    const showDeleted = () => {
      showSuccess({
        title: '点滴已经轻轻移走啦',
        duration: 1800
      });
    };

    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        success: showDeleted
      });
      return;
    }
    wx.redirectTo({
      url: routePath(ROUTES.STORY),
      success: showDeleted
    });
  },

  previewImage(event) {
    if (!this.data.moment.hasImages) {
      return;
    }
    const index = Number(event.currentTarget.dataset.index || 0);
    wx.previewImage({
      current: this.data.moment.images[index] || this.data.moment.images[0],
      urls: this.data.moment.images
    });
  },

  retryLoad() {
    this.loadMoment();
  },

  loadMoment() {
    if (!this.data.momentId) {
      return Promise.resolve();
    }

    this.setData({
      loading: true,
      message: ''
    });

    return getMomentDetail(this.data.momentId)
      .then((response) => {
        this.setData({ moment: mapStoryDetail(response, getStoredUser()) });
      })
      .catch((error) => {
        this.setData({
          message: (error && error.message) || '点滴详情加载失败'
        });
      })
      .then(() => {
        this.setData({ loading: false });
      });
  }
});
