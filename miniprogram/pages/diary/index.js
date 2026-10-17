const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { getCurrentUser } = require('../../services/auth');
const { getDiaryMonth, getDiaryMonths } = require('../../services/diary');
const { isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { setActiveTabBar } = require('../../utils/tabbar');
const {
  mapDiaryMonth,
  mapDiaryMonths
} = require('./diary-presenter');

Page({
  data: {
    showTopMask: false,
    activeFilter: 'all',
    currentRole: '',
    selectedMonth: '',
    activeMonthAnchor: '',
    monthTitle: '----.--',
    monthCaption: '0 篇日记 · 0 位作者',
    monthTabs: [],
    stats: [
      { label: '共享', value: '0' },
      { label: '私密', value: '0' },
      { label: '有照片', value: '0' }
    ],
    filters: [
      { value: 'all', label: '全部' },
      { value: 'mine', label: '我的' },
      { value: 'other', label: '他的' },
      { value: 'private', label: '私密' }
    ],
    entries: [],
    rawEntries: [],
    loading: false,
    message: '',
    loaded: false
  },

  onShow() {
    setActiveTabBar(1);
    if (!this.data.loaded) {
      this.loadDiaryPage();
    }
  },

  onPageScroll({ scrollTop }) {
    const showTopMask = scrollTop > 18;
    if (showTopMask !== this.data.showTopMask) {
      this.setData({ showTopMask });
    }
  },

  onPullDownRefresh() {
    this.setData({ loaded: false });
    this.loadDiaryPage().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadDiaryPage() {
    if (!isLoggedIn()) {
      redirectToLogin({ redirect: routePath(ROUTES.DIARY) });
      return Promise.resolve();
    }

    this.setData({
      loading: true,
      message: ''
    });

    return Promise.all([
      getCurrentUser().catch(() => ({})),
      getDiaryMonths()
    ])
      .then(([user, monthsResponse]) => {
        const monthData = mapDiaryMonths(monthsResponse, this.data.selectedMonth);
        const currentRole = user && user.coupleRole ? user.coupleRole : this.data.currentRole;
        this.setData({
          currentRole,
          selectedMonth: monthData.selectedMonth,
          activeMonthAnchor: monthData.activeMonthAnchor,
          monthTabs: monthData.monthTabs,
          loaded: true
        });
        if (!monthData.selectedMonth) {
          this.setData({
            entries: [],
            rawEntries: [],
            loading: false,
            message: '还没有日记'
          });
          return Promise.resolve();
        }
        return this.loadDiaryMonth(monthData.selectedMonth, { keepLoading: true });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          message: error && error.message ? error.message : '日记加载失败'
        });
      });
  },

  loadDiaryMonth(month, options) {
    if (!month) {
      return Promise.resolve();
    }
    if (!(options && options.keepLoading)) {
      this.setData({
        loading: true,
        message: ''
      });
    }

    return getDiaryMonth(month)
      .then((response) => {
        const page = mapDiaryMonth(response, this.data.activeFilter, this.data.currentRole);
        this.setData({
          selectedMonth: month,
          activeMonthAnchor: month ? `month-${month}` : '',
          monthTabs: this.data.monthTabs.map((item) => ({
            ...item,
            active: item.value === month
          })),
          monthTitle: page.monthTitle,
          monthCaption: page.monthCaption,
          stats: page.stats,
          entries: page.entries,
          rawEntries: page.rawItems,
          loading: false,
          message: ''
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          message: error && error.message ? error.message : '日记列表加载失败'
        });
      });
  },

  handleMonthTap(event) {
    const month = event.currentTarget.dataset.value;
    if (!month || month === this.data.selectedMonth) {
      return;
    }
    this.loadDiaryMonth(month);
  },

  handleFilterTap(event) {
    const value = event.currentTarget.dataset.value;
    if (!value || value === this.data.activeFilter) {
      return;
    }
    const page = mapDiaryMonth({
      month: this.data.selectedMonth,
      items: this.data.rawEntries
    }, value, this.data.currentRole);
    this.setData({
      activeFilter: value,
      entries: page.entries
    });
  },

  handleEntryTap(event) {
    const diaryId = event.currentTarget.dataset.id;
    if (!diaryId) {
      return;
    }
    wx.navigateTo({
      url: withQuery(ROUTES.DIARY_DETAIL, { diaryId })
    });
  },

  handleCreateDiary() {
    wx.navigateTo({
      url: routePath(ROUTES.DIARY_EDIT)
    });
  }
});
