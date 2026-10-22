const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const {
  getAlbumDetail,
  likeAlbum,
  recordAlbumView,
  unlockAlbum,
  deleteAlbum: deleteAlbumEntry
} = require('../../services/album');
const { isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { showConfirm } = require('../../utils/dialog');
const { showInfo } = require('../../utils/notify');
const {
  mapAlbumDetail,
  updateAlbumLikeCount,
  updateAlbumViewCount
} = require('../albums/album-presenter');

Page({
  data: {
    albumId: 0,
    deleting: false,
    notFound: false,
    album: null,
    loading: false,
    message: '',
    locked: false,
    password: '',
    unlockLoading: false,
    actionLoading: false
  },

  onLoad(options) {
    const albumId = Number(options && (options.albumId || options.id));
    if (!albumId) {
      this.setData({ message: '相册不存在' });
      return;
    }
    this.setData({ albumId });
    this.loadAlbumDetail();
  },

  onShow() {
    if (this.albumChanged) {
      this.albumChanged = false;
      return this.loadAlbumDetail();
    }
    return undefined;
  },

  onPullDownRefresh() {
    this.loadAlbumDetail().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadAlbumDetail() {
    if (!isLoggedIn()) {
      redirectToLogin({
        redirect: withQuery(ROUTES.ALBUM_DETAIL, { albumId: this.data.albumId })
      });
      return Promise.resolve();
    }

    this.setData({
      loading: true,
      message: '',
      notFound: false
    });

    return getAlbumDetail(this.data.albumId, '', { silent: true }).then((response) => {
      const album = mapAlbumDetail(response);
      this.setData({
        album,
        loading: false,
        locked: false,
        password: '',
        message: ''
      });
      this.recordView();
    }).catch((error) => {
      const privateError = error && String(error.code || '').indexOf('PRIVATE_ALBUM_') === 0;
      this.setData({
        album: privateError || error.code === 'ALBUM_NOT_FOUND' ? null : this.data.album,
        notFound: error.code === 'ALBUM_NOT_FOUND',
        loading: false,
        locked: privateError,
        message: privateError ? '' : (error.code === 'ALBUM_NOT_FOUND' ? '相册不存在' : (error && error.message ? error.message : '相册详情加载失败'))
      });
    });
  },

  recordView() {
    return recordAlbumView(this.data.albumId).then((response) => {
      if (response && response.viewCount !== undefined && this.data.album) {
        this.setData({
          album: updateAlbumViewCount(this.data.album, response.viewCount)
        });
      }
    }).catch(() => {});
  },

  handlePasswordInput(event) {
    this.setData({
      password: event.detail.value
    });
  },

  submitUnlock() {
    const password = String(this.data.password || '').trim();
    if (!password) {
      showInfo('请输入相册密码');
      return;
    }

    this.setData({
      unlockLoading: true
    });

    unlockAlbum(this.data.albumId, password).then(() => {
      this.setData({
        unlockLoading: false,
        locked: false,
        password: ''
      });
      this.loadAlbumDetail();
    }).catch((error) => {
      this.setData({
        unlockLoading: false,
        message: error && error.message ? error.message : ''
      });
    });
  },

  handleStatTap(event) {
    if (event.currentTarget.dataset.type === 'likes') {
      this.submitLike();
    }
  },

  submitLike() {
    if (this.data.actionLoading || !this.data.album) {
      return Promise.resolve();
    }
    this.setData({ actionLoading: true });
    return likeAlbum(this.data.albumId).then((response) => {
      const likedToday = Boolean(response && response.likedToday);
      this.setData({
        actionLoading: false,
        album: updateAlbumLikeCount(this.data.album, response.likeCount, likedToday)
      });
      showInfo(likedToday ? '已喜欢' : '已取消喜欢');
    }).catch((error) => {
      this.setData({
        actionLoading: false,
        message: error && error.message ? error.message : '喜欢失败'
      });
    });
  },

  editAlbum() {
    if (!this.data.album || !this.data.album.canManage || this.data.deleting) return;
    wx.navigateTo({ url: withQuery(ROUTES.ALBUM_EDIT, { albumId: this.data.albumId }) });
  },

  deleteAlbum() {
    if (!this.data.album || !this.data.album.canManage || this.data.deleting) return Promise.resolve();
    const album = this.data.album;
    return showConfirm({ title: '删除相册', content: `确定删除「${album.title}」吗？其中 ${album.photoCount} 张照片会一起删除，无法恢复。`, confirmText: '删除', cancelText: '取消' })
      .then((result) => {
        if (!result.confirm || this.data.deleting) return;
        this.setData({ deleting: true, message: '' });
        return deleteAlbumEntry(this.data.albumId).catch((error) => {
          if (error.code !== 'ALBUM_NOT_FOUND') throw error;
        }).then(() => {
          this.refreshAlbumPages();
          this.goBack();
        }).catch((error) => this.setData({ deleting: false, message: error.message || '相册删除失败' }));
      });
  },

  refreshAlbumPages() {
    getCurrentPages().forEach((page) => {
      if (page.route === ROUTES.ALBUMS && typeof page.loadAlbums === 'function') page.loadAlbums({ reset: true });
      if (page.route === ROUTES.INDEX && typeof page.loadHome === 'function') page.loadHome();
    });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: routePath(ROUTES.ALBUMS) });
  },

  previewPhoto(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const urls = (this.data.album && this.data.album.photos ? this.data.album.photos : [])
      .map((photo) => photo.url)
      .filter(Boolean);
    if (!urls.length) {
      return;
    }
    wx.previewImage({
      current: urls[index],
      urls
    });
  }
});
