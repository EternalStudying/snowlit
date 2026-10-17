const { setActiveTabBar } = require('../../utils/tabbar');
const { ROUTES, withQuery } = require('../../constants/routes');
const {
  completeWish: completeWishRequest,
  getWishes,
  reopenWish: reopenWishRequest
} = require('../../services/wish');
const { getToken, isLoggedIn } = require('../../utils/auth');
const { showError, showSuccess } = require('../../utils/notify');
const { mapWishPage } = require('./wish-presenter');

const PAGE_SIZE = 10;
const WISH_TRANSITION_MS = 220;

const SECTION_CONFIG = {
  wantGo: {
    dataKey: 'wantGoWishes',
    countKey: 'wantGo',
    params: { category: 'want_go', completed: false },
    type: 'pending',
    emptyMessage: '还没有想去的地方'
  },
  wantDo: {
    dataKey: 'wantDoWishes',
    countKey: 'wantDo',
    params: { category: 'want_do', completed: false },
    type: 'pending',
    emptyMessage: '还没有想做的事'
  },
  completed: {
    dataKey: 'completedWishes',
    countKey: 'done',
    params: { completed: true },
    type: 'completed',
    emptyMessage: '还没有完成的清单'
  }
};

function initialPageState() {
  return {
    page: 0,
    hasMore: false,
    loading: false,
    message: ''
  };
}

Page({
  data: {
    showTopMask: false,
    canManage: false,
    counts: {
      wantGo: '0 条',
      wantDo: '0 条',
      done: '0 条'
    },
    wantGoWishes: [],
    wantDoWishes: [],
    completedWishes: [],
    completionSheetVisible: false,
    completionSubmitting: false,
    completionWishId: '',
    completionSectionKey: '',
    pageState: {
      wantGo: initialPageState(),
      wantDo: initialPageState(),
      completed: initialPageState()
    }
  },

  onLoad() {
    this.updatingWishIds = {};
  },

  onShow() {
    setActiveTabBar(3);
    return this.loadAllWishes();
  },

  onPageScroll({ scrollTop }) {
    const showTopMask = scrollTop > 18;
    if (showTopMask !== this.data.showTopMask) {
      this.setData({ showTopMask });
    }
  },

  onPullDownRefresh() {
    this.loadAllWishes().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadAllWishes() {
    const token = getToken();
    if (this.wishSessionToken !== token) {
      this.wishSessionToken = token;
      this.updatingWishIds = {};
      this.setData({
        canManage: false,
        counts: { wantGo: '0 条', wantDo: '0 条', done: '0 条' },
        wantGoWishes: [],
        wantDoWishes: [],
        completedWishes: [],
        completionSheetVisible: false,
        completionSubmitting: false,
        completionWishId: '',
        completionSectionKey: '',
        pageState: {
          wantGo: initialPageState(),
          wantDo: initialPageState(),
          completed: initialPageState()
        }
      });
    }
    if (!isLoggedIn()) {
      this.setData({
        'pageState.wantGo.message': '登录后查看清单',
        'pageState.wantDo.message': '登录后查看清单',
        'pageState.completed.message': '登录后查看清单'
      });
      return Promise.resolve();
    }

    return Promise.all([
      this.loadWishSection('wantGo', true),
      this.loadWishSection('wantDo', true),
      this.loadWishSection('completed', true)
    ]);
  },

  loadWishSection(sectionKey, reset) {
    const token = getToken();
    const config = SECTION_CONFIG[sectionKey];
    if (!config || this.data.pageState[sectionKey].loading) {
      return Promise.resolve();
    }

    const nextPage = reset ? 1 : this.data.pageState[sectionKey].page + 1;
    this.setData({
      [`pageState.${sectionKey}.loading`]: true,
      [`pageState.${sectionKey}.message`]: ''
    });

    return getWishes({
      ...config.params,
      page: nextPage,
      size: PAGE_SIZE
    })
      .then((response) => {
        if (getToken() !== token) {
          return;
        }
        const mapped = mapWishPage(response, config.type);
        const currentItems = reset ? [] : this.data[config.dataKey];
        const nextItems = currentItems.concat(mapped.items);
        this.setData({
          [config.dataKey]: nextItems,
          canManage: this.data.canManage || mapped.canManage,
          [`counts.${config.countKey}`]: mapped.totalText,
          [`pageState.${sectionKey}.page`]: mapped.page,
          [`pageState.${sectionKey}.hasMore`]: mapped.hasMore,
          [`pageState.${sectionKey}.loading`]: false,
          [`pageState.${sectionKey}.message`]: nextItems.length ? '' : config.emptyMessage
        });
      })
      .catch((error) => {
        if (getToken() !== token) {
          return;
        }
        this.setData({
          [`pageState.${sectionKey}.loading`]: false,
          [`pageState.${sectionKey}.message`]: error && error.message ? error.message : '清单加载失败'
        });
      });
  },

  loadMoreWantGo() {
    this.loadWishSection('wantGo', false);
  },

  loadMoreWantDo() {
    this.loadWishSection('wantDo', false);
  },

  loadMoreCompleted() {
    this.loadWishSection('completed', false);
  },

  openWish(event) {
    const wishId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: withQuery(ROUTES.WISH_DETAIL, { wishId })
    });
  },

  completeWish(event) {
    const wishId = event.currentTarget.dataset.id;
    const sectionKey = event.currentTarget.dataset.section;
    if (!wishId || !SECTION_CONFIG[sectionKey]) {
      return;
    }

    this.openCompletionSheet(wishId, sectionKey);
  },

  openCompletionSheet(wishId, sectionKey) {
    this.setData({
      completionSheetVisible: true,
      completionSubmitting: false,
      completionWishId: String(wishId),
      completionSectionKey: sectionKey
    });
  },

  closeCompletionSheet() {
    if (this.data.completionSubmitting) {
      return;
    }
    this.setData({
      completionSheetVisible: false,
      completionWishId: '',
      completionSectionKey: ''
    });
  },

  handleCompletionImageMissing() {
    showError('请先添加完成图片');
  },

  confirmCompleteWish(event) {
    const wishId = this.data.completionWishId;
    const sectionKey = this.data.completionSectionKey;
    const imagePath = event.detail && event.detail.imagePath;
    if (!wishId || !SECTION_CONFIG[sectionKey] || !imagePath || !this.startWishUpdate(wishId)) {
      return;
    }

    this.setData({
      completionSubmitting: true
    });

    completeWishRequest(wishId, imagePath)
      .then(() => {
        this.setData({
          completionSheetVisible: false,
          completionSubmitting: false,
          completionWishId: '',
          completionSectionKey: ''
        });
        this.markWishLeaving(sectionKey, wishId, {
          checkClass: 'wish-check--done',
          stateClass: 'wish-row--leaving'
        });
        showSuccess('完成啦，轻轻收进 DONE 里~');
        this.refreshAfterWishTransition(wishId);
      })
      .catch((error) => {
        this.finishWishUpdate(wishId);
        this.setData({
          completionSubmitting: false
        });
        showError(error && error.message ? error.message : '完成清单失败');
      });
  },

  reopenWish(event) {
    const wishId = event.currentTarget.dataset.id;
    if (!wishId || !this.startWishUpdate(wishId)) {
      return;
    }

    reopenWishRequest(wishId)
      .then(() => {
        this.markWishLeaving('completed', wishId, {
          stateClass: 'done-row--leaving'
        });
        showSuccess('已经放回未完成清单啦~');
        this.refreshAfterWishTransition(wishId);
      })
      .catch((error) => {
        this.finishWishUpdate(wishId);
        showError(error && error.message ? error.message : '恢复清单失败');
      });
  },

  startWishUpdate(wishId) {
    const key = String(wishId);
    if (this.updatingWishIds && this.updatingWishIds[key]) {
      return false;
    }
    this.updatingWishIds = {
      ...(this.updatingWishIds || {}),
      [key]: true
    };
    return true;
  },

  finishWishUpdate(wishId) {
    const key = String(wishId);
    const nextUpdatingWishIds = { ...(this.updatingWishIds || {}) };
    delete nextUpdatingWishIds[key];
    this.updatingWishIds = nextUpdatingWishIds;
  },

  markWishLeaving(sectionKey, wishId, patch) {
    const config = SECTION_CONFIG[sectionKey];
    if (!config) {
      return;
    }
    const key = String(wishId);
    const nextItems = (this.data[config.dataKey] || []).map((item) => {
      if (String(item.id) !== key) {
        return item;
      }
      return {
        ...item,
        ...(patch || {})
      };
    });
    this.setData({
      [config.dataKey]: nextItems
    });
  },

  refreshAfterWishTransition(wishId) {
    setTimeout(() => {
      this.loadAllWishes().finally(() => {
        this.finishWishUpdate(wishId);
      });
    }, WISH_TRANSITION_MS);
  },

  goCreate() {
    if (!this.data.canManage) {
      return;
    }
    wx.navigateTo({
      url: withQuery(ROUTES.WISH_EDIT, { category: 'want_go' })
    });
  }
});
