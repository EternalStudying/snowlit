const { ROUTES, routePath } = require('../../constants/routes');
const { uploadDraftImage, removeDraftImage, publishDraft } = require('../../services/draft');
const { createDraftAutosave, loadDraft } = require('../../utils/draft-autosave');
const { beginRequest } = require('../../utils/request-guard');
const { resolveMediaUrl } = require('../../utils/media');
const { getPhotoPlaceName } = require('../../services/weather');
const { showInfo, showSuccess } = require('../../utils/notify');
const { pickImages } = require('../../utils/image-picker');
const { readPhotoMetadata, summarizePhotoMetadata } = require('../../utils/photo-metadata');
const { patchItem, uploadQueue } = require('../../utils/upload-queue');
const {
  MAX_ALBUM_PHOTOS,
  albumDraftFields,
  mapAlbumDraft,
  VISIBILITY_OPTIONS,
  appendSelectedAlbumPhotos,
  buildAlbumDraftPayload,
  createAlbumPhotoMetadata,
  createInitialAlbumForm,
  formatAlbumDateText
} = require('./album-edit-presenter');

const NO_PHOTO_DETAILS_HINT = '照片里没有拍摄时间和地点，可以手动填写';

// Originals are picked so their EXIF can be read; what gets uploaded is re-encoded without it.
function compressForUpload(path) {
  return new Promise((resolve, reject) => {
    if (typeof wx.compressImage !== 'function') {
      reject(new Error('照片处理失败，请重试'));
      return;
    }
    wx.compressImage({
      src: path,
      quality: 80,
      success: (result) => resolve(result.tempFilePath),
      fail: () => reject(new Error('照片处理失败，请重试'))
    });
  });
}

Page({
  data: {
    form: createInitialAlbumForm(),
    visibilityOptions: VISIBILITY_OPTIONS,
    maxAlbumPhotos: MAX_ALBUM_PHOTOS,
    photos: [],
    canAddPhoto: true,
    draftLocked: false,
    draftStatus: '',
    removingImage: false,
    uploading: false,
    visibilitySheetVisible: false,
    dateSheetVisible: false,
    metadataReading: false,
    metadataHint: '',
    submitting: false,
    message: ''
  },

  onLoad() {
    this.startAutosave();
    this.setData({ draftLocked: true });
    return loadDraft(this, 'album').then((result) => {
      if (!result.current || this.metadataDisposed) return;
      if (result.draft) {
        this.setData({ form: mapAlbumDraft(result.draft) });
        this.settledFields = { eventDate: Boolean(this.data.form.eventDate), location: Boolean(this.data.form.location) };
        this.updatePhotos(result.draft.images.map((image) => ({
          ...image, serverId: image.id, path: resolveMediaUrl(image.url), status: 'uploaded', progress: 100, message: '已上传'
        })));
      }
      this.setData({ draftLocked: false });
    }).catch((error) => { if (!this.metadataDisposed) this.setData({ message: error.message || '草稿加载失败，请重新打开页面' }); });
  },

  startAutosave() {
    if (this.autosave) this.autosave.stop();
    this.autosave = createDraftAutosave({ page: this, kind: 'album', read: () => albumDraftFields(this.data.form),
      view: (draftStatus) => { if (!this.metadataDisposed) this.setData({ draftStatus }); },
      sessionChanged: () => {
        this.metadataDisposed = true;
        this.setData({ form: createInitialAlbumForm(), photos: [], draftStatus: '', removingImage: false, draftLocked: true, submitting: false, uploading: false, metadataReading: false, metadataHint: '', message: '', dateSheetVisible: false, visibilitySheetVisible: false });
      }
    });
  },

  changed() {
    if (this.autosave && !this.data.draftLocked) this.autosave.changed();
  },

  onHide() {
    return this.autosave ? this.autosave.flush() : Promise.resolve();
  },

  onUnload() {
    this.metadataDisposed = true;
    if (this.autosave) return this.autosave.flush().finally(() => this.autosave.stop());
    return Promise.resolve();
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.ALBUMS) });
  },

  handleInput(event) {
    if (this.data.draftLocked || this.metadataDisposed || this.data.submitting) return;
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }
    if (field === 'location') {
      this.settleField('location');
    }
    this.setData({
      [`form.${field}`]: event.detail.value,
      message: ''
    });
    if (field !== 'privatePassword') this.changed();
  },

  openVisibilitySheet() {
    if (this.data.draftLocked || this.metadataDisposed || this.data.submitting) return;
    this.setData({
      visibilitySheetVisible: true,
      message: ''
    });
  },

  closeVisibilitySheet() {
    this.setData({
      visibilitySheetVisible: false
    });
  },

  selectVisibilityFromSheet(event) {
    if (this.data.draftLocked || this.metadataDisposed || this.data.submitting) return;
    const value = event.detail && event.detail.value;
    const option = VISIBILITY_OPTIONS.find((item) => item.value === value) || VISIBILITY_OPTIONS[0];
    this.setData({
      'form.visibility': option.value,
      'form.visibilityText': option.label,
      'form.privatePassword': option.value === 'private' ? this.data.form.privatePassword : '',
      visibilitySheetVisible: false,
      message: ''
    });
    this.changed();
  },

  togglePinned() {
    if (this.data.draftLocked || this.metadataDisposed || this.data.submitting) return;
    this.setData({
      'form.pinned': !this.data.form.pinned,
      message: ''
    });
    this.changed();
  },

  openDateSheet() {
    if (this.data.draftLocked || this.metadataDisposed || this.data.submitting) return;
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
    if (this.data.draftLocked || this.metadataDisposed || this.data.submitting) return;
    const value = event.detail && event.detail.value;
    if (!value) {
      return;
    }
    this.settleField('eventDate');
    this.setData({
      'form.eventDate': value,
      'form.eventDateText': formatAlbumDateText(value),
      dateSheetVisible: false,
      message: ''
    });
    this.changed();
  },

  choosePhotos() {
    if (this.data.removingImage) return;
    if (this.data.submitting || this.queuedSave || this.data.draftLocked || this.data.uploading || this.metadataDisposed) {
      return;
    }
    if (!this.data.canAddPhoto) {
      showInfo(`最多 ${MAX_ALBUM_PHOTOS} 张`);
      return;
    }

    return pickImages({
      count: Math.min(9, MAX_ALBUM_PHOTOS - this.data.photos.length),
      title: '选择照片',
      message: '需要读取你选中的照片及其中的拍摄时间和地点，用于添加相册照片并自动填写日期和地点。',
      noun: '照片',
      sizeType: ['original'],
      isBlocked: () => this.data.submitting || Boolean(this.queuedSave) || this.data.draftLocked || this.data.uploading || this.metadataDisposed
    }).then((files) => {
      if (!files.length) {
        return;
      }
      const before = this.data.photos.length;
      const result = appendSelectedAlbumPhotos(this.data.photos, files);
      this.updatePhotos(result.photos);
      if (result.reachedLimit) {
        showInfo(`最多 ${MAX_ALBUM_PHOTOS} 张`);
      }
      this.changed();
      return this.fillFromPhotos(result.photos.slice(before)).then(() => {
        if (!this.metadataDisposed) return this.uploadPhotos().catch((error) => {
          this.setData({ message: error.message || '照片上传失败，请重试' });
          showInfo(error.message || '照片上传失败，请重试');
        });
        return undefined;
      });
    });
  },

  /** A field the person set, or one already filled from photos, is never filled again. */
  settleField(field) {
    this.settledFields = { ...(this.settledFields || {}), [field]: true };
  },

  isSettled(field) {
    return Boolean(this.settledFields && this.settledFields[field]);
  },

  /**
   * Reads the new photos' EXIF: each photo keeps its own shooting date, and untouched album fields
   * take the earliest date and the place of the first photo with GPS.
   */
  fillFromPhotos(photos) {
    const active = () => !this.metadataDisposed;
    const retained = (id) => active() && this.data.photos.some((photo) => photo.id === id);
    const updateHint = () => {
      if (!active()) return;
      const missingDate = !this.data.form.eventDate;
      const missingPlace = !this.data.form.location;
      let hint = '照片信息处理完成';
      if (!this.data.photos.length) hint = '';
      else if (missingDate && missingPlace) hint = '未读取到拍摄时间和地点，请手动填写';
      else if (missingDate) hint = '未读取到拍摄时间，请手动选择日期';
      else if (missingPlace) hint = '未读取到拍摄地点，可手动填写';
      if (this.metadataPending > 1) hint = '正在读取照片拍摄信息…';
      this.setData({ metadataHint: hint });
    };
    this.metadataPending = (this.metadataPending || 0) + 1;
    this.setData({ metadataReading: true, metadataHint: '正在读取照片拍摄信息…' });

    const task = photos.reduce((chain, photo) => chain.then((found) => (
      retained(photo.id)
        ? readPhotoMetadata(photo.path).then((metadata) => found.concat({ id: photo.id, ...metadata }))
        : found
    )), Promise.resolve([])).then((found) => {
      if (!active()) return;
      const current = found.filter((item) => retained(item.id));
      const dated = current.filter((item) => item.takenAt);
      if (dated.length) {
        this.updatePhotos(this.data.photos.map((photo) => {
          const match = dated.find((item) => item.id === photo.id);
          return match ? { ...photo, takenAt: match.takenAt } : photo;
        }));
      }

      const summary = summarizePhotoMetadata(current);
      if (!summary.takenAt && !summary.position) {
        if (current.length) showInfo(NO_PHOTO_DETAILS_HINT);
        updateHint();
        return undefined;
      }
      if (summary.takenAt && !this.isSettled('eventDate') && !this.data.submitting) {
        this.settleField('eventDate');
        this.setData({
          'form.eventDate': summary.takenAt,
          'form.eventDateText': formatAlbumDateText(summary.takenAt)
        });
        this.changed();
      }
      const positioned = current.filter((item) => item.latitude !== null && item.longitude !== null);
      return positioned.reduce((chain, item) => chain.then(() => {
        if (!retained(item.id)) return;
        return getPhotoPlaceName({ latitude: item.latitude, longitude: item.longitude }).then((place) => {
          if (!retained(item.id)) return;
          if (place) this.updatePhotos(this.data.photos.map((photo) => photo.id === item.id ? { ...photo, location: place } : photo));
          if (place && !this.isSettled('location') && !this.data.submitting) {
            this.settleField('location');
            this.setData({ 'form.location': place });
            this.changed();
          }
        });
      }), Promise.resolve()).then(updateHint);
    }).catch(() => {
      if (active()) this.setData({ metadataHint: '未能读取照片拍摄信息，请手动填写' });
    }).finally(() => {
      this.metadataPending -= 1;
      if (active() && this.metadataPending === 0) this.setData({ metadataReading: false });
    });
    this.metadataTask = Promise.all([this.metadataTask || Promise.resolve(), task]).then(() => undefined);
    return task;
  },

  previewPhoto(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const urls = this.data.photos.map((item) => item.path).filter(Boolean);
    if (!urls.length) {
      return;
    }
    wx.previewImage({
      current: urls[index] || urls[0],
      urls
    });
  },

  removePhoto(event) {
    if (this.data.removingImage || this.data.submitting || this.data.uploading || this.data.draftLocked || this.metadataDisposed) return;
    const index = Number(event.currentTarget.dataset.index);
    const photo = this.data.photos[index];
    if (!Number.isInteger(index) || !photo) return;
    if (!photo.serverId) {
      this.updatePhotos(this.data.photos.filter((item) => item.id !== photo.id));
      return Promise.resolve();
    }
    const isCurrent = beginRequest(this, 'draft-remove');
    this.setData({ removingImage: true });
    const remove = removeDraftImage('album', photo.serverId);
    return remove.then(() => {
      if (isCurrent() && !this.metadataDisposed) this.updatePhotos(this.data.photos.filter((item) => item.id !== photo.id));
    }).catch((error) => { if (isCurrent() && !this.metadataDisposed) { this.setData({ message: error.message }); showInfo(error.message); } }).finally(() => { if (isCurrent() && !this.metadataDisposed) this.setData({ removingImage: false }); });
  },

  updatePhotos(photos) {
    const list = Array.isArray(photos) ? photos.slice() : [];
    this.setData({
      photos: list,
      canAddPhoto: list.length < MAX_ALBUM_PHOTOS,
      message: ''
    });
  },

  patchPhoto(index, patch) {
    this.updatePhotos(patchItem(this.data.photos, index, patch));
  },

  resolvePhotoSize(photo) {
    if (photo.width > 0 && photo.height > 0) {
      return Promise.resolve({
        width: photo.width,
        height: photo.height
      });
    }
    if (!wx.getImageInfo) {
      return Promise.resolve({ width: 1, height: 1 });
    }
    return new Promise((resolve) => {
      wx.getImageInfo({
        src: photo.path,
        success: (response) => {
          resolve({
            width: response.width || 1,
            height: response.height || 1
          });
        },
        fail: () => {
          resolve({ width: 1, height: 1 });
        }
      });
    });
  },

  uploadPhotos() {
    if (this.data.metadataReading) return this.metadataTask.then(() => this.uploadPhotos());
    if (this.uploadTask) return this.uploadTask;
    const isCurrent = beginRequest(this, 'draft-upload');
    const active = () => isCurrent() && !this.metadataDisposed;
    if (!active()) return Promise.resolve();
    this.setData({ uploading: true });
    this.uploadTask = uploadQueue({
      read: () => active() ? this.data.photos : [],
      patch: (index, patch) => { if (active()) this.patchPhoto(index, patch); },
      failureMessage: '有照片没有上传成功，请稍后再试',
      upload: (photo, index, onProgress) => this.resolvePhotoSize(photo).then((size) => {
        if (!active()) throw new Error('登录状态已变化');
        const resolved = { ...photo, width: photo.width || size.width, height: photo.height || size.height };
        this.patchPhoto(index, { width: resolved.width, height: resolved.height });
        return compressForUpload(resolved.path).then((uploadPath) => {
          if (!active()) throw new Error('登录状态已变化');
          return uploadDraftImage('album', uploadPath, createAlbumPhotoMetadata(resolved, index, this.data.form), onProgress);
        });
      }),
      onUploaded: (response, index) => { if (active()) this.patchPhoto(index, { serverId: response.id }); }
    }).finally(() => {
      this.uploadTask = null;
      if (active()) this.setData({ uploading: false });
    });
    return this.uploadTask;
  },

  refreshAlbumPages() {
    if (typeof getCurrentPages !== 'function') {
      return;
    }
    getCurrentPages().forEach((page) => {
      if (page.route === routePath(ROUTES.ALBUMS).replace(/^\//, '') && typeof page.loadAlbums === 'function') {
        page.loadAlbums({ reset: true });
      }
      if (page.route === routePath(ROUTES.INDEX).replace(/^\//, '') && typeof page.loadHome === 'function') {
        page.loadHome();
      }
    });
  },

  saveAlbum() {
    if (this.data.removingImage) return;
    if (this.data.submitting || this.metadataDisposed || this.data.draftLocked) {
      return;
    }
    if (this.data.metadataReading) {
      if (!this.queuedSave) {
        this.queuedSave = this.metadataTask.then(() => {
          this.queuedSave = null;
          if (!this.metadataDisposed) return this.saveAlbum();
          return undefined;
        });
      }
      return this.queuedSave;
    }

    const validation = buildAlbumDraftPayload(this.data.form);
    if (!validation.valid) {
      showInfo(validation.message);
      this.setData({ message: validation.message });
      return;
    }
    if (!this.data.photos.length) {
      showInfo('请先添加照片');
      this.setData({ message: '请先添加照片' });
      return;
    }

    const isCurrent = beginRequest(this, 'draft-publish');
    this.setData({ submitting: true, message: '' });
    return this.uploadPhotos()
      .then(() => this.autosave ? this.autosave.flush() : undefined)
      .then(() => {
        if (!isCurrent() || this.metadataDisposed) return null;
        if (this.autosave) this.autosave.pause();
        return publishDraft('album', albumDraftFields(this.data.form), { privatePassword: validation.payload.privatePassword });
      })
      .then((result) => {
        if (!result || !isCurrent() || this.metadataDisposed) return;
        this.published = true;
        if (this.autosave) this.autosave.stop();
        this.refreshAlbumPages();
        showSuccess({ title: '相册已经轻轻收好啦', duration: 1200 });
        setTimeout(() => this.goBack(), 700);
      })
      .catch((error) => {
        if (!isCurrent() || this.metadataDisposed) return;
        if (this.autosave) this.autosave.resume();
        else this.startAutosave();
        this.changed();
        const message = error.message || '相册保存失败，请稍后再试';
        this.setData({ message });
        showInfo(message);
      })
      .finally(() => { if (isCurrent() && !this.metadataDisposed) this.setData({ submitting: false }); });
  }
});
