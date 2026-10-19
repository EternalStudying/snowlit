const { ROUTES, routePath } = require('../../constants/routes');
const { createMoment, getMomentDetail, updateMoment, uploadMomentImage } = require('../../services/story');
const { showInfo, showSuccess } = require('../../utils/notify');
const { collectUploadedUrls } = require('../../utils/image-list');
const { pickImages } = require('../../utils/image-picker');
const {
  MAX_STORY_IMAGES,
  appendSelectedImages,
  buildStoryPayload,
  createInitialStoryForm,
  mapStoryEditForm,
  mapStoryEditCategories
} = require('./story-edit-presenter');

Page({
  data: {
    momentId: '',
    isEditing: false,
    loadingMoment: false,
    form: createInitialStoryForm(),
    categories: mapStoryEditCategories('daily'),
    dateSheetVisible: false,
    timeSheetVisible: false,
    activePickerField: '',
    activePickerValue: '',
    activePickerTitle: '',
    images: [],
    canAddImage: true,
    submitting: false,
    message: ''
  },

  onLoad(options) {
    const momentId = options && (options.id || options.momentId) ? String(options.id || options.momentId) : '';
    if (momentId) {
      this.loadMomentForEdit(momentId);
    }
  },

  loadMomentForEdit(momentId) {
    this.setData({
      momentId,
      isEditing: true,
      loadingMoment: true,
      message: ''
    });

    return getMomentDetail(momentId)
      .then((response) => {
        const mapped = mapStoryEditForm(response);
        this.setData({
          form: mapped.form,
          categories: mapStoryEditCategories(mapped.form.category),
          images: mapped.images,
          canAddImage: mapped.images.length < MAX_STORY_IMAGES,
          loadingMoment: false,
          message: ''
        });
      })
      .catch((error) => {
        this.setData({
          loadingMoment: false,
          message: error && error.message ? error.message : '点滴加载失败'
        });
      });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.navigateTo({ url: routePath(ROUTES.STORY) });
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

  openStoryDateSheet(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }
    this.setData({
      activePickerField: field,
      activePickerValue: this.data.form[field] || '',
      activePickerTitle: field === 'endDate' ? '结束日期' : '开始日期',
      dateSheetVisible: true,
      message: ''
    });
  },

  closeStoryDateSheet() {
    this.setData({
      dateSheetVisible: false,
      activePickerField: '',
      activePickerValue: '',
      activePickerTitle: ''
    });
  },

  confirmStoryDateFromSheet(event) {
    const field = this.data.activePickerField;
    if (!field) {
      return;
    }
    this.setData({
      [`form.${field}`]: event.detail && event.detail.value ? event.detail.value : '',
      dateSheetVisible: false,
      activePickerField: '',
      activePickerValue: '',
      activePickerTitle: '',
      message: ''
    });
  },

  openStoryTimeSheet(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }
    this.setData({
      activePickerField: field,
      activePickerValue: this.data.form[field] || '',
      activePickerTitle: field === 'endTime' ? '结束时间' : '开始时间',
      timeSheetVisible: true,
      message: ''
    });
  },

  closeStoryTimeSheet() {
    this.setData({
      timeSheetVisible: false,
      activePickerField: '',
      activePickerValue: '',
      activePickerTitle: ''
    });
  },

  confirmStoryTimeFromSheet(event) {
    const field = this.data.activePickerField;
    if (!field) {
      return;
    }
    this.setData({
      [`form.${field}`]: event.detail && event.detail.value ? event.detail.value : '',
      timeSheetVisible: false,
      activePickerField: '',
      activePickerValue: '',
      activePickerTitle: '',
      message: ''
    });
  },

  clearEndTime() {
    this.setData({
      'form.endDate': '',
      'form.endTime': '',
      message: ''
    });
  },

  handleCategoryTap(event) {
    const value = event.currentTarget.dataset.value;
    this.setData({
      'form.category': value,
      categories: mapStoryEditCategories(value),
      message: ''
    });
  },

  chooseImages() {
    if (this.data.submitting || this.data.loadingMoment) {
      return;
    }
    if (!this.data.canAddImage) {
      showInfo(`最多 ${MAX_STORY_IMAGES} 张`);
      return;
    }

    pickImages({
      count: MAX_STORY_IMAGES - this.data.images.length,
      title: '选择图片',
      message: '需要读取你选中的照片，用于添加点滴图片。',
      isBlocked: () => this.data.submitting || this.data.loadingMoment
    }).then((files) => {
      if (!files.length) {
        return;
      }
      const result = appendSelectedImages(this.data.images, files);
      this.updateImages(result.images);
      if (result.reachedLimit) {
        showInfo(`最多 ${MAX_STORY_IMAGES} 张`);
      }
    });
  },

  removeImage(event) {
    if (this.data.submitting || this.data.loadingMoment) {
      return;
    }
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) {
      return;
    }
    const images = this.data.images.filter((item, itemIndex) => itemIndex !== index);
    this.updateImages(images);
  },

  previewPhoto(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const urls = this.data.images
      .map((item) => item.path || item.url)
      .filter(Boolean);
    if (!urls.length) {
      return;
    }
    wx.previewImage({
      current: urls[index] || urls[0],
      urls
    });
  },

  submitMoment() {
    if (this.data.submitting || this.data.loadingMoment) {
      return;
    }

    const validation = buildStoryPayload(this.data.form, collectUploadedUrls(this.data.images));
    if (!validation.valid) {
      this.showMessage(validation.message);
      return;
    }
    if (this.data.isEditing && !this.data.momentId) {
      this.showMessage('点滴不存在');
      return;
    }

    this.setData({
      submitting: true,
      message: ''
    });

    this.uploadImages()
      .then(() => {
        const payloadResult = buildStoryPayload(this.data.form, collectUploadedUrls(this.data.images));
        if (!payloadResult.valid) {
          throw new Error(payloadResult.message);
        }
        return this.data.isEditing
          ? updateMoment(this.data.momentId, payloadResult.payload)
          : createMoment(payloadResult.payload);
      })
      .then(() => {
        this.refreshStoryPages();
        this.goBackAfterPublish();
      })
      .catch((error) => {
        this.showMessage((error && error.message) || '发布失败，请稍后重试');
      })
      .then(() => {
        this.setData({ submitting: false });
      });
  },

  uploadImages() {
    return this.data.images.reduce((promise, item, index) => {
      return promise.then(() => {
        if (item.status === 'uploaded' && item.url) {
          return Promise.resolve();
        }
        return this.uploadImageAt(index);
      });
    }, Promise.resolve());
  },

  uploadImageAt(index) {
    const image = this.data.images[index];
    if (!image || !image.path) {
      return Promise.resolve();
    }

    this.patchImage(index, {
      status: 'uploading',
      progress: 0,
      message: '上传中 0%'
    });

    return uploadMomentImage(image.path, (progress) => {
      const percent = progress && Number.isFinite(progress.progress) ? progress.progress : 0;
      this.patchImage(index, {
        progress: percent,
        message: `上传中 ${percent}%`
      });
    })
      .then((response) => {
        if (!response || !response.url) {
          throw new Error('图片上传失败');
        }
        this.patchImage(index, {
          url: response.url,
          status: 'uploaded',
          progress: 100,
          message: '已上传'
        });
      })
      .catch((error) => {
        this.patchImage(index, {
          status: 'failed',
          progress: 0,
          message: '上传失败'
        });
        throw error;
      });
  },

  patchImage(index, patch) {
    const images = this.data.images.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    this.updateImages(images);
  },

  updateImages(images) {
    this.setData({
      images,
      canAddImage: images.length < MAX_STORY_IMAGES,
      message: ''
    });
  },

  showMessage(message) {
    const title = message || '操作失败';
    this.setData({ message: title });
    showInfo(title);
  },

  refreshStoryPages() {
    const pages = getCurrentPages();
    pages.forEach((page) => {
      if (page && page.route === ROUTES.STORY && typeof page.loadMoments === 'function') {
        page.loadMoments({ refreshYears: true });
      }
      if (page && page.route === ROUTES.STORY_DETAIL && typeof page.loadMoment === 'function' && this.data.momentId) {
        page.loadMoment();
      }
    });
  },

  goBackAfterPublish() {
    const showSuccessToast = () => {
      showSuccess({
        title: this.data.isEditing ? '点滴已经认真改好啦' : '回忆住进来啦',
        duration: 1800
      });
    };

    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        success: showSuccessToast
      });
      return;
    }
    wx.redirectTo({
      url: routePath(ROUTES.STORY),
      success: showSuccessToast
    });
  }
});
