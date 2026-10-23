const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { getCurrentUser } = require('../../services/auth');
const { getDiaryMonth, getDiaryMonths } = require('../../services/diary');
const { isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { setActiveTabBar } = require('../../utils/tabbar');
const {
  BATCH_ENTRIES,
  applyFilter,
  buildJumpYears,
  buildMonthIndex,
  mapTimelineSection,
  nextMonthToLoad
} = require('./diary-presenter');

// Month headings stick just under the custom navigation area (the top mask's height).
const STICKY_TOP_RPX = 128;

Page({
  data: {
    showTopMask: false,
    activeFilter: 'all',
    currentRole: '',
    filters: [
      { value: 'all', label: '全部' },
      { value: 'mine', label: '我的' },
      { value: 'other', label: 'TA的' },
      { value: 'private', label: '私密' }
    ],
    sections: [],
    matching: 0,
    loading: false,
    loadingMore: false,
    failedMonth: '',
    exhausted: false,
    message: '',
    loaded: false,
    jumpVisible: false,
    jumpYears: []
  },

  onLoad() {
    this.monthIndex = [];
    this.monthsResponse = null;
    this.loadToken = 0;
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
    this.loadDiaryPage().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  onReachBottom() {
    return this.loadMore({});
  },

  // Starts the timeline again from the newest month. Also called by diary-edit and diary-detail after a change.
  loadDiaryPage() {
    if (!isLoggedIn()) {
      redirectToLogin({ redirect: routePath(ROUTES.DIARY) });
      return Promise.resolve();
    }

    this.loadToken += 1;
    this.pendingJump = '';
    const token = this.loadToken;
    this.setData({
      loading: true,
      loadingMore: false,
      failedMonth: '',
      exhausted: false,
      message: '',
      sections: [],
      matching: 0
    });

    return Promise.all([
      getCurrentUser().catch(() => ({})),
      getDiaryMonths()
    ])
      .then(([user, monthsResponse]) => {
        if (token !== this.loadToken) {
          return undefined;
        }
        this.monthsResponse = monthsResponse;
        this.monthIndex = buildMonthIndex(monthsResponse);
        this.setData({
          currentRole: user && user.coupleRole ? user.coupleRole : this.data.currentRole,
          loaded: true,
          loading: false,
          exhausted: this.monthIndex.length === 0
        });
        return this.loadMore({});
      })
      .catch((error) => {
        if (token !== this.loadToken) {
          return;
        }
        this.setData({
          loading: false,
          message: error && error.message ? error.message : '日记加载失败'
        });
      });
  },

  // Loads months in order until the goal is met: { untilMonth } for a jump, otherwise a batch of matching entries.
  loadMore(goal) {
    if (this.data.loading || this.data.loadingMore || this.data.exhausted) {
      return Promise.resolve();
    }
    const token = this.loadToken;
    let matched = 0;
    this.setData({ loadingMore: true, failedMonth: '' });

    const step = () => {
      const loadedMonths = this.data.sections.map((section) => section.month);
      const month = nextMonthToLoad(this.monthIndex, loadedMonths, goal, matched);
      if (!month) {
        this.setData({
          loadingMore: false,
          exhausted: loadedMonths.length >= this.monthIndex.length
        });
        // A jump picked while this batch was loading continues from here.
        if (this.pendingJump && !(goal && goal.untilMonth) && !loadedMonths.includes(this.pendingJump)) {
          return this.loadMore({ untilMonth: this.pendingJump }).then(() => this.finishJump());
        }
        return Promise.resolve();
      }
      const total = (this.monthIndex.find((item) => item.month === month) || {}).count;
      return getDiaryMonth(month)
        .then((response) => {
          if (token !== this.loadToken) {
            return undefined;
          }
          const items = response && Array.isArray(response.items) ? response.items : [];
          const section = mapTimelineSection(month, items, total, this.data.activeFilter, this.data.currentRole);
          matched += section.entries.length;
          this.setData({
            [`sections[${this.data.sections.length}]`]: section,
            matching: this.data.matching + section.entries.length
          });
          return step();
        })
        .catch(() => {
          if (token !== this.loadToken) {
            return;
          }
          this.setData({ loadingMore: false, failedMonth: month });
        });
    };

    return step();
  },

  handleRetryTap() {
    this.loadMore(this.pendingJump ? { untilMonth: this.pendingJump } : {})
      .then(() => this.finishJump());
  },

  handleFilterTap(event) {
    const value = event.currentTarget.dataset.value;
    if (!value || value === this.data.activeFilter) {
      return;
    }
    const filtered = applyFilter(this.data.sections, value, this.data.currentRole);
    this.setData({
      activeFilter: value,
      sections: filtered.sections,
      matching: filtered.matching
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    if (filtered.matching < BATCH_ENTRIES) {
      this.loadMore({ minEntries: BATCH_ENTRIES - filtered.matching });
    }
  },

  handleMonthHeadTap(event) {
    const month = event.currentTarget.dataset.month;
    if (!this.monthsResponse) {
      return;
    }
    this.setData({
      jumpYears: buildJumpYears(this.monthsResponse, month),
      jumpVisible: true
    });
  },

  handleJumpCancel() {
    this.setData({ jumpVisible: false });
  },

  handleJumpSelect(event) {
    const month = event.detail && event.detail.month;
    this.setData({ jumpVisible: false });
    if (!month) {
      return;
    }
    this.pendingJump = month;
    this.loadMore({ untilMonth: month }).then(() => this.finishJump());
  },

  finishJump() {
    const month = this.pendingJump;
    if (!month || !this.data.sections.some((section) => section.month === month)) {
      return;
    }
    this.pendingJump = '';
    const windowWidth = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth;
    wx.pageScrollTo({
      selector: `#month-${month}`,
      offsetTop: -Math.round((STICKY_TOP_RPX * windowWidth) / 750),
      duration: 260
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
