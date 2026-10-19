const { ROUTES, routePath } = require('../../constants/routes');
const { createDiary, getDiaryDetail, updateDiary, uploadDiaryImage } = require('../../services/diary');
const { parseDiaryMarkdown } = require('../../utils/diary-markdown');
const { showInfo, showSuccess } = require('../../utils/notify');
const { pickImages } = require('../../utils/image-picker');
const { patchItem, uploadQueue } = require('../../utils/upload-queue');
const {
  MAX_DIARY_IMAGES,
  appendSelectedDiaryImages,
  buildDiaryCreatePayload,
  buildDiaryUpdatePayload,
  createInitialDiaryForm,
  formatDiaryDateText,
  insertBlockMarkdown,
  insertDiaryImageMarkdown,
  insertInlineMarkdown,
  mapDiaryEditForm,
  mapDiaryMoods,
  moodLabel
} = require('./diary-edit-presenter');

Page({
  data: {
    diaryId: '',
    isEditing: false,
    loadingDiary: false,
    form: createInitialDiaryForm(),
    moods: mapDiaryMoods('happy'),
    moodPanelOpen: false,
    diaryDateSheetVisible: false,
    mode: 'edit',
    cursor: 0,
    images: [],
    canAddImage: true,
    previewEmpty: true,
    previewBlocks: parseDiaryMarkdown('', {}),
    submitting: false,
    message: ''
  },

  onLoad(options) {
    const diaryId = options && options.diaryId ? String(options.diaryId) : '';
    if (diaryId) {
      this.loadDiaryForEdit(diaryId);
    }
  },

  loadDiaryForEdit(diaryId) {
    this.setData({
      diaryId,
      isEditing: true,
      loadingDiary: true,
      message: ''
    });

    return getDiaryDetail(diaryId)
      .then((response) => {
        const form = mapDiaryEditForm(response);
        const previewEmpty = !String(form.content || '').trim();
        this.setData({
          form,
          moods: mapDiaryMoods(form.moodKey),
          cursor: form.content.length,
          previewEmpty,
          previewBlocks: previewEmpty ? [] : parseDiaryMarkdown(form.content, {}),
          loadingDiary: false,
          message: ''
        });
      })
      .catch((error) => {
        this.setData({
          loadingDiary: false,
          message: error && error.message ? error.message : '日记加载失败'
        });
      });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.DIARY) });
  },

  openDiaryDateSheet() {
    if (this.data.isEditing) {
      return;
    }
    this.setData({
      diaryDateSheetVisible: true,
      message: ''
    });
  },

  closeDiaryDateSheet() {
    this.setData({
      diaryDateSheetVisible: false
    });
  },

  confirmDiaryDateFromSheet(event) {
    if (this.data.isEditing) {
      return;
    }
    const value = event.detail && event.detail.value ? event.detail.value : '';
    this.setData({
      'form.date': value,
      'form.dateText': formatDiaryDateText(value),
      diaryDateSheetVisible: false,
      message: ''
    });
  },

  handleTitleInput(event) {
    this.setData({
      'form.title': event.detail.value,
      message: ''
    });
  },

  toggleVisibility(event) {
    const value = event.currentTarget.dataset.value || 'shared';
    this.setData({
      'form.visibility': value,
      message: ''
    });
  },

  handleInput(event) {
    const cursor = Number.isFinite(event.detail.cursor) ? event.detail.cursor : this.data.cursor;
    this.updateContent(event.detail.value, cursor);
  },

  handleTextareaBlur(event) {
    if (Number.isFinite(event.detail.cursor)) {
      this.setData({ cursor: event.detail.cursor });
    }
  },

  toggleMoodPanel() {
    this.setData({
      moodPanelOpen: !this.data.moodPanelOpen
    });
  },

  selectMood(event) {
    const value = event.currentTarget.dataset.value || 'happy';
    this.setData({
      'form.moodKey': value,
      'form.moodText': moodLabel(value),
      moods: mapDiaryMoods(value),
      moodPanelOpen: false,
      message: ''
    });
  },

  updateContent(content, cursor) {
    const previewEmpty = !String(content || '').trim();
    this.setData({
      'form.content': content,
      cursor: Number.isFinite(cursor) ? cursor : String(content || '').length,
      previewEmpty,
      previewBlocks: previewEmpty ? [] : parseDiaryMarkdown(content, {}),
      message: ''
    });
  },

  handleToolTap(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'image') {
      this.chooseImages();
      return;
    }
    if (action === 'bold') {
      this.applyMarkdownInsertion(insertInlineMarkdown(this.data.form.content, '**', '**', '重点', this.data.cursor, this.data.cursor));
      return;
    }
    if (action === 'heading') {
      this.applyMarkdownInsertion(insertBlockMarkdown(this.data.form.content, '## 小标题\n\n', this.data.cursor));
      return;
    }
    if (action === 'quote') {
      this.applyMarkdownInsertion(insertBlockMarkdown(this.data.form.content, '> 想留下的一句话\n\n', this.data.cursor));
      return;
    }
    if (action === 'list') {
      this.applyMarkdownInsertion(insertBlockMarkdown(this.data.form.content, '- 一件小事\n', this.data.cursor));
    }
  },

  applyMarkdownInsertion(result) {
    this.updateContent(result.content, result.cursor);
  },

  switchMode(event) {
    const mode = event.currentTarget.dataset.mode || 'edit';
    const previewEmpty = !String(this.data.form.content || '').trim();
    this.setData({
      mode,
      previewEmpty,
      previewBlocks: previewEmpty ? [] : parseDiaryMarkdown(this.data.form.content, {})
    });
  },

  chooseImages() {
    if (this.data.submitting || this.data.loadingDiary) {
      return;
    }
    if (this.hasPendingImageUploads()) {
      showInfo('请等待图片上传完成');
      return;
    }
    if (!this.data.canAddImage) {
      showInfo(`最多 ${MAX_DIARY_IMAGES} 张`);
      return;
    }

    const isBlocked = () => this.data.submitting || this.data.loadingDiary || this.hasPendingImageUploads();
    pickImages({
      count: MAX_DIARY_IMAGES - this.data.images.length,
      title: '选择图片',
      message: '需要读取你选中的照片，用于插入日记图片。',
      isBlocked
    }).then((files) => {
      if (!files.length) {
        return;
      }
      const startIndex = this.data.images.length;
      const result = appendSelectedDiaryImages(this.data.images, files);
      this.updateImages(result.images);
      if (result.reachedLimit) {
        showInfo(`最多 ${MAX_DIARY_IMAGES} 张`);
      }
      this.uploadImagesFrom(startIndex).catch((error) => {
        this.showMessage((error && error.message) || '有图片没上传成功');
      });
    });
  },

  hasPendingImageUploads() {
    return this.data.images.some((item) => item.status === 'uploading' || item.status === 'local');
  },

  previewContentImage(event) {
    const url = event.currentTarget.dataset.url;
    const urls = this.data.previewBlocks
      .filter((item) => item.type === 'image')
      .map((item) => item.url)
      .filter(Boolean);
    if (!url || !urls.length) {
      return;
    }
    wx.previewImage({
      current: url,
      urls
    });
  },

  uploadImagesFrom(startIndex) {
    return uploadQueue({
      read: () => this.data.images,
      patch: (index, patch) => this.patchImage(index, patch),
      from: startIndex,
      continueOnFailure: true,
      uploadedMessage: '已插入',
      upload: (image, index, onProgress) => uploadDiaryImage(image.path, onProgress),
      onUploaded: (response, index) => {
        this.patchImage(index, { preview: response.url });
        this.applyMarkdownInsertion(insertDiaryImageMarkdown(this.data.form.content, response.url, this.data.cursor));
      }
    }).catch((error) => {
      this.updateImages(this.data.images.filter((item) => item.status !== 'failed'));
      throw error || new Error('有图片没上传成功');
    });
  },

  patchImage(index, patch) {
    this.updateImages(patchItem(this.data.images, index, patch));
  },

  updateImages(images) {
    this.setData({
      images,
      canAddImage: images.length < MAX_DIARY_IMAGES,
      message: ''
    });
  },

  saveDiary() {
    if (this.data.submitting || this.data.loadingDiary) {
      return;
    }
    if (this.data.images.some((item) => item.status === 'uploading')) {
      this.showMessage('图片还在上传中');
      return;
    }
    if (this.data.images.some((item) => item.status === 'local')) {
      this.showMessage('图片还在准备上传');
      return;
    }
    const validation = this.data.isEditing
      ? buildDiaryUpdatePayload(this.data.form)
      : buildDiaryCreatePayload(this.data.form);
    if (!validation.valid) {
      this.showMessage(validation.message);
      return;
    }
    if (this.data.isEditing && !this.data.diaryId) {
      this.showMessage('日记不存在');
      return;
    }

    this.setData({
      submitting: true,
      message: ''
    });

    const request = this.data.isEditing
      ? updateDiary(this.data.diaryId, validation.payload)
      : createDiary(validation.payload);

    request
      .then(() => {
        this.setData({ submitting: false });
        this.refreshDiaryPages(this.data.form.date.slice(0, 7));
        this.goBackAfterSave();
      })
      .catch((error) => {
        this.setData({ submitting: false });
        this.showMessage((error && error.message) || '日记保存失败，请稍后重试');
      });
  },

  showMessage(message) {
    const title = message || '操作失败';
    this.setData({ message: title });
    showInfo(title);
  },

  refreshDiaryPages(month) {
    const pages = getCurrentPages();
    pages.forEach((page) => {
      if (page && page.route === ROUTES.DIARY && typeof page.loadDiaryPage === 'function') {
        page.setData({
          selectedMonth: month || page.data.selectedMonth,
          loaded: false
        });
        page.loadDiaryPage();
      }
      if (page && page.route === ROUTES.DIARY_DETAIL && typeof page.loadDiary === 'function' && this.data.diaryId) {
        page.loadDiary(this.data.diaryId);
      }
    });
  },

  goBackAfterSave() {
    const showSaved = () => {
      showSuccess({
        title: this.data.isEditing ? '日记已经认真改好啦' : '日记已经悄悄收好啦',
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
      url: routePath(ROUTES.DIARY),
      success: showSaved
    });
  }
});
