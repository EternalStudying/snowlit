const { setActiveTabBar } = require('../../utils/tabbar');
const { ROUTES, routePath } = require('../../constants/routes');
const { getCurrentUser, logout } = require('../../services/auth');
const { getUpdateNotice } = require('../../services/update-notice');
const { clearAuthSession, isLoggedIn, redirectToLogin, setStoredUser } = require('../../utils/auth');
const { showAlert, showConfirm } = require('../../utils/dialog');
const { mapAccountRows, mapCurrentUser, mapNotice } = require('./profile-presenter');

const initialUser = mapCurrentUser();
const initialNotice = mapNotice();

Page({
  data: {
    user: initialUser,
    accountRows: mapAccountRows(initialUser),
    notice: initialNotice,
    loading: false,
    message: '',
    logoutLoading: false,
    actionRows: [
      {
        key: 'notice',
        label: '更新公告',
        icon: '../../assets/icons/profile/megaphone.svg'
      },
      {
        key: 'feedback',
        label: '反馈与截图',
        icon: '../../assets/icons/profile/pencil.svg'
      },
      {
        key: 'logout',
        label: '退出登录',
        icon: '../../assets/icons/profile/log-out.svg'
      }
    ]
  },

  onShow() {
    setActiveTabBar(4);
    this.loadProfileData();
  },

  onPullDownRefresh() {
    this.loadProfileData().finally(() => {
      if (wx.stopPullDownRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  loadProfileData() {
    if (!isLoggedIn()) {
      redirectToLogin();
      return Promise.resolve();
    }

    this.setData({
      loading: true,
      message: ''
    });

    return Promise.all([
      getCurrentUser(),
      getUpdateNotice().catch(() => null)
    ])
      .then(([userResponse, noticeResponse]) => {
        const user = mapCurrentUser(userResponse);
        setStoredUser(userResponse);
        this.setData({
          user,
          accountRows: mapAccountRows(userResponse),
          notice: mapNotice(noticeResponse),
          loading: false
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          message: error && error.message ? error.message : '账号信息加载失败'
        });
      });
  },

  handleProfileTap() {
    wx.navigateTo({ url: routePath(ROUTES.PROFILE_EDIT) });
  },

  handleNoticeTap() {
    showAlert({
      title: this.data.notice.title,
      content: this.data.notice.modalContent,
      confirmText: '知道了'
    });
  },

  handleActionTap(event) {
    const key = event.currentTarget.dataset.key;
    if (key === 'feedback') {
      wx.navigateTo({ url: routePath(ROUTES.FEEDBACK) });
      return;
    }
    if (key === 'logout') {
      this.confirmLogout();
      return;
    }
    this.handleNoticeTap();
  },

  confirmLogout() {
    if (this.data.logoutLoading) {
      return;
    }

    showConfirm({
      title: '退出登录',
      content: '退出后需要重新微信登录才能查看私密内容。',
      confirmText: '退出'
    }).then((result) => {
        if (result.confirm) {
          this.submitLogout();
        }
    });
  },

  submitLogout() {
    this.setData({ logoutLoading: true });

    return logout()
      .catch(() => {})
      .then(() => {
        clearAuthSession();
        this.setData({ logoutLoading: false });
        redirectToLogin({ redirect: routePath(ROUTES.PROFILE) });
      });
  }
});
