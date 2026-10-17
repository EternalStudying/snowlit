const { ROUTES, routePath } = require('../../constants/routes');
const { createWish, getWishDetail, updateWish } = require('../../services/wish');
const { showInfo, showSuccess } = require('../../utils/notify');
const {
  WISH_CATEGORIES,
  buildWishCreatePayload,
  createWishFormFromDetail,
  createInitialWishForm,
  formatWishDateText,
  mapWishCategories,
  wishCategoryLabel
} = require('./wish-edit-presenter');

Page({
  data: {
    wishId: '',
    editing: false,
    loading: false,
    form: createInitialWishForm('want_go'),
    categories: mapWishCategories('want_go'),
    categorySheetVisible: false,
    dateSheetVisible: false,
    submitting: false,
    message: ''
  },

  onLoad(options) {
    const wishId = options && options.wishId ? String(options.wishId) : '';
    if (wishId) {
      this.loadWishForEdit(wishId);
      return;
    }

    const form = createInitialWishForm(options && options.category);
    this.setData({
      form,
      categories: mapWishCategories(form.category)
    });
  },

  loadWishForEdit(wishId) {
    this.setData({
      wishId,
      editing: true,
      loading: true,
      message: ''
    });

    return getWishDetail(wishId)
      .then((response) => {
        const form = createWishFormFromDetail(response);
        this.setData({
          form,
          categories: mapWishCategories(form.category),
          loading: false
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          message: error && error.message ? error.message : '清单加载失败'
        });
      });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.WISHES) });
  },

  openCategorySheet() {
    this.setData({
      categorySheetVisible: true,
      message: ''
    });
  },

  closeCategorySheet() {
    this.setData({
      categorySheetVisible: false
    });
  },

  selectCategoryFromSheet(event) {
    const value = event.detail && event.detail.value;
    const category = WISH_CATEGORIES.find((item) => item.value === value) || WISH_CATEGORIES[0];
    this.setData({
      'form.category': category.value,
      'form.categoryText': wishCategoryLabel(category.value),
      categories: mapWishCategories(category.value),
      categorySheetVisible: false,
      message: ''
    });
  },

  openDateSheet() {
    this.setData({
      dateSheetVisible: true,
      message: ''
    });
  },

  closeDateSheet() {
    this.setData({
      dateSheetVisible: false
    });
  },

  confirmDateFromSheet(event) {
    const value = event.detail && event.detail.value ? event.detail.value : '';
    this.setData({
      'form.expectedDate': value,
      'form.expectedDateText': formatWishDateText(value),
      dateSheetVisible: false,
      message: ''
    });
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }
    this.setData({
      [`form.${field}`]: event.detail.value,
      message: ''
    });
  },

  saveWish() {
    if (this.data.submitting || this.data.loading) {
      return;
    }

    const result = buildWishCreatePayload(this.data.form);
    if (!result.valid) {
      this.showMessage(result.message);
      return;
    }
    if (this.data.editing && !this.data.wishId) {
      this.showMessage('清单不存在');
      return;
    }

    this.setData({
      submitting: true,
      message: ''
    });

    const request = this.data.editing
      ? updateWish(this.data.wishId, result.payload)
      : createWish(result.payload);

    request
      .then(() => {
        this.setData({ submitting: false });
        this.refreshWishPages();
        this.goBackAfterSave();
      })
      .catch((error) => {
        this.setData({ submitting: false });
        this.showMessage((error && error.message) || '清单保存失败，请稍后重试');
      });
  },

  showMessage(message) {
    const title = message || '操作失败';
    this.setData({ message: title });
    showInfo(title);
  },

  refreshWishPages() {
    getCurrentPages().forEach((page) => {
      if (page && page.route === ROUTES.WISHES && typeof page.loadAllWishes === 'function') {
        page.loadAllWishes();
      }
      if (page && page.route === ROUTES.WISH_DETAIL && typeof page.loadWish === 'function' && this.data.wishId) {
        page.loadWish(this.data.wishId);
      }
    });
  },

  goBackAfterSave() {
    const showSaved = () => {
      showSuccess({
        title: this.data.editing ? '小愿望已经认真改好啦' : '小愿望已经贴到清单上啦',
        duration: 1800
      });
    };

    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        success: showSaved
      });
      return;
    }
    wx.switchTab({
      url: routePath(ROUTES.WISHES),
      success: showSaved
    });
  }
});
