const { ROUTES, routePath } = require('../../constants/routes');
const { getDiaryDetail, updateDiary, uploadDiaryImage } = require('../../services/diary');
const { uploadDraftImage, removeDraftImage, publishDraft } = require('../../services/draft');
const { createDraftAutosave, loadDraft } = require('../../utils/draft-autosave');
const { beginRequest } = require('../../utils/request-guard');
const { resolveMediaUrl } = require('../../utils/media');
const { parseDiaryMarkdown } = require('../../utils/diary-markdown');
const { showInfo, showSuccess } = require('../../utils/notify');
const { pickImages } = require('../../utils/image-picker');
const { patchItem, uploadQueue } = require('../../utils/upload-queue');
const {
  MAX_DIARY_IMAGES,
  diaryDraftFields,
  mapDiaryDraft,
  appendSelectedDiaryImages,
  buildDiaryCreatePayload,
  buildDiaryUpdatePayload,
  createInitialDiaryForm,
  formatDiaryDateText,
  insertBlockMarkdown,
  insertDiaryImageMarkdown,
  removeDiaryImageMarkdown,
  insertInlineMarkdown,
  mapDiaryEditForm,
  mapDiaryMoods,
  moodLabel
} = require('./diary-edit-presenter');

function previewMarkdown(content) {
  return parseDiaryMarkdown(content, {}).map((block) => block.type === 'image' ? { ...block, url: resolveMediaUrl(block.url) } : block);
}

Page({
  data: {
    diaryId: '',
    draftLocked: false,
    draftStatus: '',
    removingImage: false,
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
      return this.loadDiaryForEdit(diaryId);
    }
    this.startAutosave();
    this.setData({ draftLocked: true });
    return loadDraft(this, 'diary').then((result) => {
      if (!result.current || this.disposed) return;
      if (result.draft) {
        const form = mapDiaryDraft(result.draft);
        this.setData({ form, moods: mapDiaryMoods(form.moodKey) });
        this.updateContent(form.content, form.content.length, false);
        this.updateImages(result.draft.images.map((image) => ({ ...image, serverId: image.id, path: resolveMediaUrl(image.url), preview: resolveMediaUrl(image.url), status: 'uploaded', progress: 100, message: '已插入' })));
      }
      this.setData({ draftLocked: false });
    }).catch((error) => { if (!this.disposed) this.setData({ message: error.message || '草稿加载失败，请重新打开页面' }); });
  },

  startAutosave() {
    if (this.autosave) this.autosave.stop();
    this.autosave = createDraftAutosave({ page: this, kind: 'diary', read: () => diaryDraftFields(this.data.form),
      view: (draftStatus) => { if (!this.disposed) this.setData({ draftStatus }); },
      sessionChanged: () => {
        this.disposed = true;
        this.setData({ form: createInitialDiaryForm(), images: [], previewBlocks: [], previewEmpty: true, cursor: 0, draftStatus: '', removingImage: false, draftLocked: true, submitting: false, message: '', moodPanelOpen: false, diaryDateSheetVisible: false });
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
          previewBlocks: previewEmpty ? [] : previewMarkdown(form.content),
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
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
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
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
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
    this.changed();
  },

  handleTitleInput(event) {
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
    this.setData({
      'form.title': event.detail.value,
      message: ''
    });
    this.changed();
  },

  toggleVisibility(event) {
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
    const value = event.currentTarget.dataset.value || 'shared';
    this.setData({
      'form.visibility': value,
      message: ''
    });
    this.changed();
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
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
    this.setData({
      moodPanelOpen: !this.data.moodPanelOpen
    });
  },

  selectMood(event) {
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
    const value = event.currentTarget.dataset.value || 'happy';
    this.setData({
      'form.moodKey': value,
      'form.moodText': moodLabel(value),
      moods: mapDiaryMoods(value),
      moodPanelOpen: false,
      message: ''
    });
    this.changed();
  },

  updateContent(content, cursor, changed = true) {
    if (this.data.draftLocked && changed || this.disposed || this.data.submitting && changed) return;
    const previewEmpty = !String(content || '').trim();
    this.setData({
      'form.content': content,
      cursor: Number.isFinite(cursor) ? cursor : String(content || '').length,
      previewEmpty,
      previewBlocks: previewEmpty ? [] : previewMarkdown(content),
      message: ''
    });
    if (changed) this.changed();
  },

  handleToolTap(event) {
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
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
    if (this.data.draftLocked || this.disposed || this.data.submitting) return;
    const mode = event.currentTarget.dataset.mode || 'edit';
    const previewEmpty = !String(this.data.form.content || '').trim();
    this.setData({
      mode,
      previewEmpty,
      previewBlocks: previewEmpty ? [] : previewMarkdown(this.data.form.content)
    });
  },

  chooseImages() {
    if (this.data.removingImage) return;
    if (this.data.submitting || this.data.loadingDiary || this.data.draftLocked || this.disposed) {
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

    const isBlocked = () => this.data.submitting || this.data.loadingDiary || this.data.draftLocked || this.disposed || this.hasPendingImageUploads();
    return pickImages({
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
      this.changed();
      return this.uploadImagesFrom(startIndex).catch((error) => {
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
    if (this.uploadTask) return this.uploadTask;
    const isCurrent = beginRequest(this, 'draft-upload');
    const active = () => isCurrent() && !this.disposed;
    this.uploadTask = uploadQueue({
      read: () => active() ? this.data.images : [],
      patch: (index, patch) => { if (active()) this.patchImage(index, patch); },
      from: startIndex, continueOnFailure: true, uploadedMessage: '已插入',
      upload: (image, index, onProgress) => this.data.isEditing
        ? uploadDiaryImage(image.path, onProgress)
        : uploadDraftImage('diary', image.path, null, onProgress),
      onUploaded: (response, index) => {
        if (!active()) return;
        this.patchImage(index, { preview: resolveMediaUrl(response.url), serverId: response.id });
        this.applyMarkdownInsertion(insertDiaryImageMarkdown(this.data.form.content, response.url, this.data.cursor));
      }
    }).catch((error) => {
      if (active()) this.updateImages(this.data.images.filter((item) => item.status !== 'failed'));
      throw error || new Error('有图片没上传成功');
    }).finally(() => { this.uploadTask = null; });
    return this.uploadTask;
  },

  patchImage(index, patch) {
    this.updateImages(patchItem(this.data.images, index, patch));
  },

  removeImage(event) {
    if (this.data.removingImage || this.data.isEditing || this.data.submitting || this.data.loadingDiary || this.data.draftLocked || this.disposed || this.hasPendingImageUploads()) return;
    const index = Number(event.currentTarget.dataset.index);
    const image = this.data.images[index];
    if (!Number.isInteger(index) || !image || !image.serverId) return;
    const isCurrent = beginRequest(this, 'draft-remove');
    this.setData({ removingImage: true });
    return removeDraftImage('diary', image.serverId).then(() => {
      if (!isCurrent() || this.disposed) return;
      this.updateImages(this.data.images.filter((item) => item.id !== image.id));
      const content = removeDiaryImageMarkdown(this.data.form.content, image.url);
      this.updateContent(content, Math.min(this.data.cursor, content.length));
    }).catch((error) => { if (isCurrent() && !this.disposed) this.showMessage(error.message || '图片删除失败'); }).finally(() => { if (isCurrent() && !this.disposed) this.setData({ removingImage: false }); });
  },

  updateImages(images) {
    this.setData({
      images,
      canAddImage: images.length < MAX_DIARY_IMAGES,
      message: ''
    });
  },

  saveDiary() {
    if (this.data.removingImage) return;
    if (this.data.submitting || this.data.loadingDiary || this.data.draftLocked || this.disposed) {
      return;
    }
    if (this.uploadTask) {
      if (!this.queuedSave) this.queuedSave = this.uploadTask.then(() => {
        this.queuedSave = null;
        return this.saveDiary();
      }).catch((error) => { this.queuedSave = null; if (!this.disposed) this.showMessage(error.message); });
      return this.queuedSave;
    }
    if (this.data.images.some((item) => item.status === 'local' || item.status === 'failed')) {
      this.showMessage('有图片没有上传成功，请重新选择');
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

    const isCurrent = beginRequest(this, 'draft-publish');
    const request = this.data.isEditing
      ? updateDiary(this.data.diaryId, validation.payload)
      : (this.autosave ? this.autosave.flush() : Promise.resolve()).then(() => {
        if (!isCurrent() || this.disposed) return null;
        if (this.autosave) this.autosave.pause();
        return publishDraft('diary', diaryDraftFields(this.data.form));
      });

    return request.then((result) => {
      if (!isCurrent() || this.disposed || result === null) return;
      if (this.autosave) this.autosave.stop();
      this.setData({ submitting: false });
      this.refreshDiaryPages(this.data.form.date.slice(0, 7));
      this.goBackAfterSave();
    }).catch((error) => {
      if (!isCurrent() || this.disposed) return;
      if (!this.data.isEditing) {
        if (this.autosave) this.autosave.resume();
        else this.startAutosave();
        this.changed();
      }
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
