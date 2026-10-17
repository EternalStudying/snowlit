const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { deleteDiary: deleteDiaryEntry, getDiaryDetail } = require('../../services/diary');
const { getStoredUser } = require('../../utils/auth');
const { showConfirm } = require('../../utils/dialog');
const { showInfo, showSuccess } = require('../../utils/notify');
const { mapDiaryDetail } = require('../diary/diary-presenter');

Page({
  data: {
    diary: null,
    diaryId: '',
    deleting: false,
    loading: true,
    message: ''
  },

  onLoad(options) {
    this.loadDiary(options && options.diaryId);
  },

  onPullDownRefresh() {
    this.loadDiary(this.data.diaryId).finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadDiary(diaryId) {
    if (!diaryId) {
      this.setData({
        loading: false,
        message: '日记不存在'
      });
      return Promise.resolve();
    }

    this.setData({
      diaryId,
      loading: true,
      message: ''
    });

    return getDiaryDetail(diaryId)
      .then((response) => {
        this.setData({
          diary: mapDiaryDetail(response, getStoredUser()),
          loading: false
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          message: error && error.message ? error.message : '日记详情加载失败'
        });
      });
  },

  editDiary() {
    if (!this.data.diary || !this.data.diary.canEdit || !this.data.diaryId) {
      showInfo('只能修改自己的日记');
      return;
    }
    wx.navigateTo({
      url: withQuery(ROUTES.DIARY_EDIT, { diaryId: this.data.diaryId })
    });
  },

  deleteDiary() {
    if (!this.data.diary || !this.data.diary.canEdit || !this.data.diaryId || this.data.deleting) {
      return;
    }

    showConfirm({
      title: '删除日记',
      content: '确定要删除这篇日记吗？删除后会从列表里消失。',
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
      deleteDiaryEntry(this.data.diaryId)
        .then(() => {
          this.refreshDiaryList();
          this.goBackAfterDelete();
        })
        .catch((error) => {
          this.setData({
            deleting: false,
            message: error && error.message ? error.message : '日记删除失败'
          });
        });
    });
  },

  refreshDiaryList() {
    const pages = getCurrentPages();
    const diary = this.data.diary || {};
    const month = diary.rawDate ? diary.rawDate.slice(0, 7) : '';
    pages.forEach((page) => {
      if (page && page.route === ROUTES.DIARY && typeof page.loadDiaryPage === 'function') {
        page.setData({
          selectedMonth: month || page.data.selectedMonth,
          loaded: false
        });
        page.loadDiaryPage();
      }
    });
  },

  goBackAfterDelete() {
    const showDeleted = () => {
      showSuccess({
        title: '日记已经轻轻移走啦',
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
      url: routePath(ROUTES.DIARY),
      success: showDeleted
    });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.DIARY) });
  },

  previewPhoto(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const currentUrl = event.currentTarget.dataset.url || '';
    const photos = this.data.diary && this.data.diary.photos ? this.data.diary.photos : [];
    const urls = photos.length ? photos : (currentUrl ? [currentUrl] : []);
    if (!urls.length) {
      return;
    }
    wx.previewImage({
      current: currentUrl || urls[index] || urls[0],
      urls
    });
  }
});
