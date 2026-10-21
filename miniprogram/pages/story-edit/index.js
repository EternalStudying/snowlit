const { ROUTES, routePath } = require('../../constants/routes');
const { getMomentDetail, updateMoment, uploadMomentImage } = require('../../services/story');
const { uploadDraftImage, removeDraftImage, publishDraft } = require('../../services/draft');
const { createDraftAutosave, loadDraft } = require('../../utils/draft-autosave');
const { beginRequest } = require('../../utils/request-guard');
const { resolveMediaUrl } = require('../../utils/media');
const { showInfo, showSuccess } = require('../../utils/notify');
const { collectUploadedUrls } = require('../../utils/image-list');
const { pickImages } = require('../../utils/image-picker');
const { patchItem, uploadQueue } = require('../../utils/upload-queue');
const {
  MAX_STORY_IMAGES,
  storyDraftFields,
  appendSelectedImages,
  buildStoryPayload,
  createInitialStoryForm,
  mapStoryEditForm,
  mapStoryEditCategories
} = require('./story-edit-presenter');

Page({
  data: {
    momentId: '',
    draftLocked: false,
    draftStatus: '',
    removingImage: false,
    uploading: false,
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
      return this.loadMomentForEdit(momentId);
    }
    this.startAutosave();
    this.setData({ draftLocked: true });
    return loadDraft(this, 'moment').then((result) => {
      if (!result.current || this.disposed) return;
      if (result.draft) {
        const mapped = mapStoryEditForm(result.draft.fields);
        this.setData({ form: mapped.form, categories: mapStoryEditCategories(mapped.form.category) });
        this.updateImages(result.draft.images.map((image) => ({ ...image, serverId: image.id, path: resolveMediaUrl(image.url), status: 'uploaded', progress: 100, message: '已上传' })));
      }
      this.setData({ draftLocked: false });
    }).catch((error) => { if (!this.disposed) this.setData({ message: error.message || '草稿加载失败，请重新打开页面' }); });
  },

  startAutosave() {
    if (this.autosave) this.autosave.stop();
    this.autosave = createDraftAutosave({ page: this, kind: 'moment', read: () => storyDraftFields(this.data.form),
      view: (draftStatus) => { if (!this.disposed) this.setData({ draftStatus }); },
      sessionChanged: () => {
        this.sessionEnded = true;
        this.disposed = true;
        this.setData({ form: createInitialStoryForm(), images: [], draftStatus: '', removingImage: false, draftLocked: true, submitting: false, uploading: false, message: '', dateSheetVisible: false, timeSheetVisible: false, activePickerField: '', activePickerValue: '', activePickerTitle: '' });
      }
    });
  },

  changed() {
    if (!this.data.isEditing && this.autosave && !this.data.draftLocked) this.autosave.changed();
  },

  onHide() {
    return this.autosave ? this.autosave.flush() : Promise.resolve();
  },

  onUnload() {
    this.disposed = true;
    if (this.autosave) return this.autosave.flush().finally(() => this.autosave.stop());
    return Promise.resolve();
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
    if (this.data.draftLocked || this.data.submitting) return;
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }
    this.setData({
      [`form.${field}`]: event.detail.value,
      message: ''
    });
    this.changed();
  },

  openStoryDateSheet(event) {
    if (this.data.draftLocked || this.data.submitting) return;
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
    if (this.data.draftLocked || this.data.submitting) return;
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
    this.changed();
  },

  openStoryTimeSheet(event) {
    if (this.data.draftLocked || this.data.submitting) return;
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
    if (this.data.draftLocked || this.data.submitting) return;
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
    this.changed();
  },

  clearEndTime() {
    if (this.data.draftLocked || this.data.submitting) return;
    this.setData({
      'form.endDate': '',
      'form.endTime': '',
      message: ''
    });
    this.changed();
  },

  handleCategoryTap(event) {
    if (this.data.draftLocked || this.data.submitting) return;
    const value = event.currentTarget.dataset.value;
    this.setData({
      'form.category': value,
      categories: mapStoryEditCategories(value),
      message: ''
    });
    this.changed();
  },

  chooseImages() {
    if (this.data.removingImage || this.data.submitting || this.data.loadingMoment || this.data.draftLocked) {
      return;
    }
    if (!this.data.canAddImage) {
      showInfo(`最多 ${MAX_STORY_IMAGES} 张`);
      return;
    }

    if (this.data.uploading) return;
    return pickImages({
      count: MAX_STORY_IMAGES - this.data.images.length,
      title: '选择图片',
      message: '需要读取你选中的照片，用于添加点滴图片。',
      isBlocked: () => this.data.submitting || this.data.loadingMoment || this.data.draftLocked || this.data.uploading
    }).then((files) => {
      if (!files.length) {
        return;
      }
      const result = appendSelectedImages(this.data.images, files);
      this.updateImages(result.images);
      this.changed();
      if (result.reachedLimit) {
        showInfo(`最多 ${MAX_STORY_IMAGES} 张`);
      }
      if (!this.data.isEditing) return this.uploadImages().catch((error) => this.showMessage(error.message));
      return undefined;
    });
  },

  removeImage(event) {
    if (this.data.removingImage || this.data.submitting || this.data.loadingMoment || this.data.uploading || this.data.draftLocked) return;
    const index = Number(event.currentTarget.dataset.index);
    const image = this.data.images[index];
    if (!Number.isInteger(index) || !image) return;
    if (this.data.isEditing || !image.serverId) {
      this.updateImages(this.data.images.filter((item) => item.id !== image.id));
      return Promise.resolve();
    }
    const isCurrent = beginRequest(this, 'draft-remove');
    this.setData({ removingImage: true });
    const remove = removeDraftImage('moment', image.serverId);
    return remove.then(() => {
      if (isCurrent() && !this.disposed) this.updateImages(this.data.images.filter((item) => item.id !== image.id));
    }).catch((error) => { if (isCurrent() && !this.disposed) this.showMessage(error.message); }).finally(() => { if (isCurrent() && !this.disposed) this.setData({ removingImage: false }); });
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
    if (this.data.removingImage || this.data.submitting || this.data.loadingMoment || this.data.draftLocked) {
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

    const isCurrent = beginRequest(this, 'draft-publish');
    return this.uploadImages()
      .then(() => {
        const payloadResult = buildStoryPayload(this.data.form, collectUploadedUrls(this.data.images));
        if (!payloadResult.valid) {
          throw new Error(payloadResult.message);
        }
        if (!isCurrent() || this.disposed) return null;
        if (this.data.isEditing) return updateMoment(this.data.momentId, payloadResult.payload);
        return (this.autosave ? this.autosave.flush() : Promise.resolve()).then(() => {
          if (!isCurrent() || this.disposed) return null;
          if (this.autosave) this.autosave.pause();
          return publishDraft('moment', storyDraftFields(this.data.form));
        });
      })
      .then((result) => {
        if (!isCurrent() || this.disposed || result === null) return;
        if (this.autosave) this.autosave.stop();
        this.refreshStoryPages();
        this.goBackAfterPublish();
      })
      .catch((error) => {
        if (!isCurrent() || this.disposed) return;
        if (!this.data.isEditing) {
          if (this.autosave) this.autosave.resume();
          else this.startAutosave();
          this.changed();
        }
        this.showMessage((error && error.message) || '发布失败，请稍后重试');
      })
      .then(() => {
        if (isCurrent() && !this.disposed) this.setData({ submitting: false });
      });
  },

  uploadImages() {
    if (this.uploadTask) return this.uploadTask;
    const isCurrent = beginRequest(this, 'draft-upload');
    // Uploads continue after the page closes; only a member change stops them.
    const active = () => isCurrent() && !this.sessionEnded;
    this.setData({ uploading: true });
    this.uploadTask = uploadQueue({
      read: () => active() ? this.data.images : [],
      patch: (index, patch) => { if (active()) this.updateImages(patchItem(this.data.images, index, patch)); },
      upload: (image, index, onProgress) => this.data.isEditing
        ? uploadMomentImage(image.path, onProgress) : uploadDraftImage('moment', image.path, null, onProgress),
      onUploaded: (response, index) => { if (active() && !this.data.isEditing) this.updateImages(patchItem(this.data.images, index, { serverId: response.id })); }
    }).finally(() => {
      this.uploadTask = null;
      if (active() && !this.disposed) this.setData({ uploading: false });
    });
    return this.uploadTask;
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
