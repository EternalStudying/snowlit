const { ROUTES, routePath } = require('../../constants/routes');
const { cancelAlbumDraft, createAlbumDraft, getCurrentAlbumDraft, publishAlbumDraft, uploadAlbumDraftPhoto } = require('../../services/album');
const { showConfirm } = require('../../utils/dialog');
const { showInfo, showSuccess } = require('../../utils/notify');
const { authorizePrivacy } = require('../../utils/privacy');
const {
  MAX_ALBUM_PHOTOS,
  VISIBILITY_OPTIONS,
  appendSelectedAlbumPhotos,
  buildAlbumDraftPayload,
  createAlbumPhotoMetadata,
  createInitialAlbumForm,
  formatAlbumDateText
} = require('./album-edit-presenter');

Page({
  data: {
    form: createInitialAlbumForm(),
    visibilityOptions: VISIBILITY_OPTIONS,
    photos: [],
    canAddPhoto: true,
    draftId: '',
    visibilitySheetVisible: false,
    dateSheetVisible: false,
    submitting: false,
    message: ''
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.ALBUMS) });
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

  openVisibilitySheet() {
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
    const value = event.detail && event.detail.value;
    const option = VISIBILITY_OPTIONS.find((item) => item.value === value) || VISIBILITY_OPTIONS[0];
    this.setData({
      'form.visibility': option.value,
      'form.visibilityText': option.label,
      'form.privatePassword': option.value === 'private' ? this.data.form.privatePassword : '',
      visibilitySheetVisible: false,
      message: ''
    });
  },

  togglePinned() {
    this.setData({
      'form.pinned': !this.data.form.pinned,
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
    const value = event.detail && event.detail.value ? event.detail.value : createInitialAlbumForm().eventDate;
    this.setData({
      'form.eventDate': value,
      'form.eventDateText': formatAlbumDateText(value),
      dateSheetVisible: false,
      message: ''
    });
  },

  choosePhotos() {
    if (this.data.submitting) {
      return;
    }
    if (!this.data.canAddPhoto) {
      showInfo(`最多 ${MAX_ALBUM_PHOTOS} 张`);
      return;
    }

    authorizePrivacy({
      title: '选择照片',
      message: '需要读取你选中的照片，用于添加相册照片。'
    }).then((agreed) => {
      if (!agreed) {
        showInfo('同意隐私指引后才能选择照片');
        return;
      }
      if (this.data.submitting) {
        return;
      }

      wx.chooseMedia({
        count: MAX_ALBUM_PHOTOS - this.data.photos.length,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (response) => {
          if (this.data.submitting) {
            return;
          }
          const selected = Array.isArray(response.tempFiles) ? response.tempFiles : [];
          const result = appendSelectedAlbumPhotos(this.data.photos, selected);
          this.updatePhotos(result.photos);
          if (result.reachedLimit) {
            showInfo(`最多 ${MAX_ALBUM_PHOTOS} 张`);
          }
        },
        fail: (error) => {
          if (!/cancel/i.test((error && error.errMsg) || '')) {
            showInfo('选择照片失败，请检查权限后重试');
          }
        }
      });
    });
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
    if (this.data.submitting) {
      return;
    }
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) {
      return;
    }
    this.updatePhotos(this.data.photos.filter((item, itemIndex) => itemIndex !== index));
  },

  updatePhotos(photos) {
    const list = Array.isArray(photos) ? photos.slice(0, MAX_ALBUM_PHOTOS) : [];
    this.setData({
      photos: list,
      canAddPhoto: list.length < MAX_ALBUM_PHOTOS,
      message: ''
    });
  },

  patchPhoto(index, patch) {
    const photos = this.data.photos.slice();
    if (!photos[index]) {
      return;
    }
    photos[index] = {
      ...photos[index],
      ...(patch || {})
    };
    this.updatePhotos(photos);
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

  uploadPhoto(albumId, photo, index) {
    if (photo.status === 'uploaded' && photo.url) {
      return Promise.resolve(photo);
    }

    return this.resolvePhotoSize(photo).then((size) => {
      const resolvedPhoto = {
        ...photo,
        width: photo.width || size.width,
        height: photo.height || size.height
      };
      this.patchPhoto(index, {
        width: resolvedPhoto.width,
        height: resolvedPhoto.height,
        status: 'uploading',
        progress: 0,
        message: '上传中'
      });

      return uploadAlbumDraftPhoto(
        albumId,
        resolvedPhoto.path,
        createAlbumPhotoMetadata(resolvedPhoto, index, this.data.form),
        (progress) => {
          const value = Math.max(0, Math.min(100, Number(progress && progress.progress) || 0));
          this.patchPhoto(index, {
            progress: value,
            message: value ? `上传中 ${value}%` : '上传中'
          });
        }
      );
    }).then((uploaded) => {
      if (!uploaded || !uploaded.url) {
        throw new Error('有照片没有上传成功，请稍后再试');
      }
      this.patchPhoto(index, {
        status: 'uploaded',
        progress: 100,
        message: '已上传',
        url: uploaded.url
      });
      return uploaded;
    }).catch((error) => {
      this.patchPhoto(index, {
        status: 'failed',
        message: '上传失败'
      });
      throw error;
    });
  },

  uploadPhotos(albumId) {
    return this.data.photos.reduce((task, photo, index) => {
      return task.then(() => this.uploadPhoto(albumId, photo, index));
    }, Promise.resolve());
  },

  resetUploadedPhotoState() {
    this.updatePhotos(this.data.photos.map((photo) => ({
      ...photo,
      status: '',
      progress: 0,
      message: '',
      url: ''
    })));
  },

  cleanupDraft(albumId) {
    if (!albumId) {
      return Promise.resolve();
    }

    return cancelAlbumDraft(albumId)
      .catch(() => null)
      .then(() => {
        if (this.data.draftId === albumId) {
          this.setData({ draftId: '' });
        }
        this.resetUploadedPhotoState();
      });
  },

  handleDraftExists(error, payload) {
    if (!error || error.code !== 'ALBUM_DRAFT_EXISTS') {
      return Promise.reject(error);
    }

    return getCurrentAlbumDraft({ silent: true }).then((current) => {
      const draft = current && current.draft;
      const albumId = draft && draft.album && draft.album.id;
      if (!albumId) {
        throw error;
      }

      return showConfirm({
        title: '发现未完成相册',
        content: '之前有一份未完成的相册保存记录。清理后会重新保存当前内容。',
        confirmText: '清理并保存',
        cancelText: '先不保存'
      }).then((result) => {
        if (!result || !result.confirm) {
          throw new Error('已取消保存');
        }
        return cancelAlbumDraft(albumId).then(() => {
          this.setData({ draftId: '' });
          this.resetUploadedPhotoState();
          return createAlbumDraft(payload, { silent: true });
        });
      });
    });
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
    if (this.data.submitting) {
      return;
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

    let albumId = this.data.draftId;
    this.setData({
      submitting: true,
      message: ''
    });

    const draftTask = albumId
      ? Promise.resolve({ album: { id: albumId } })
      : createAlbumDraft(validation.payload, { silent: true })
        .catch((error) => this.handleDraftExists(error, validation.payload));

    draftTask
      .then((draft) => {
        albumId = albumId || (draft && draft.album && draft.album.id);
        if (!albumId) {
          throw new Error('相册保存准备失败，请稍后再试');
        }
        this.setData({ draftId: albumId });
        return this.uploadPhotos(albumId);
      })
      .then(() => publishAlbumDraft(albumId))
      .then(() => {
        this.refreshAlbumPages();
        showSuccess({
          title: '相册已经轻轻收好啦',
          duration: 1200
        });
        setTimeout(() => this.goBack(), 700);
      })
      .catch((error) => {
        const message = error && error.message ? error.message : '相册保存失败，请稍后再试';
        return this.cleanupDraft(albumId).then(() => {
          this.setData({ message });
          showInfo(message);
        });
      })
      .then(() => {
        this.setData({ submitting: false });
      });
  }
});
