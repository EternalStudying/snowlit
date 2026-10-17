const { ROUTES, routePath, withQuery } = require('../../constants/routes');
const { getAlbums } = require('../../services/album');
const { isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { setActiveTabBar } = require('../../utils/tabbar');
const { mapAlbumPage } = require('./album-presenter');

const PAGE_SIZE = 5;

Page({
  data: {
    albums: [],
    canManage: false,
    page: 1,
    totalText: '共 0 本相册',
    hasMore: false,
    loading: false,
    loadingMore: false,
    message: ''
  },

  onShow() {
    setActiveTabBar(2);
    this.loadAlbums({ reset: true });
  },

  onPullDownRefresh() {
    this.loadAlbums({ reset: true }).finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadAlbums(options) {
    const reset = Boolean(options && options.reset);
    if (!isLoggedIn()) {
      redirectToLogin({ redirect: routePath(ROUTES.ALBUMS) });
      return Promise.resolve();
    }

    if (this.data.loading || this.data.loadingMore) {
      return Promise.resolve();
    }

    const nextPage = reset ? 1 : this.data.page + 1;
    this.setData({
      loading: reset,
      loadingMore: !reset,
      message: reset ? '' : this.data.message
    });

    return getAlbums({
      page: nextPage,
      size: PAGE_SIZE,
      previewLimit: 9
    }).then((response) => {
      const pageData = mapAlbumPage(response);
      this.setData({
        albums: reset ? pageData.items : this.data.albums.concat(pageData.items),
        canManage: reset ? pageData.canManage : (this.data.canManage || pageData.canManage),
        page: pageData.page,
        totalText: pageData.totalText,
        hasMore: pageData.hasMore,
        loading: false,
        loadingMore: false,
        message: ''
      });
    }).catch((error) => {
      this.setData({
        loading: false,
        loadingMore: false,
        message: error && error.message ? error.message : '相册加载失败'
      });
    });
  },

  loadMoreAlbums() {
    if (!this.data.hasMore) {
      return;
    }
    this.loadAlbums({ reset: false });
  },

  onReachBottom() {
    this.loadMoreAlbums();
  },

  openAlbum(event) {
    const albumId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: withQuery(ROUTES.ALBUM_DETAIL, { albumId })
    });
  },

  goCreate() {
    if (!this.data.canManage) {
      return;
    }
    wx.navigateTo({
      url: routePath(ROUTES.ALBUM_EDIT)
    });
  }
});
