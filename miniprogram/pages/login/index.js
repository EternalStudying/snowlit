const authService = require('../../services/auth');
const { ROUTES, routePath, isTabRoute, tabRoutePath } = require('../../constants/routes');
const {
  getAndClearLoginRedirect,
  isLoggedIn,
  persistLoginSession
} = require('../../utils/auth');
const { showAlert } = require('../../utils/dialog');
const { showError } = require('../../utils/notify');

const AGREEMENT_REQUIRED_MESSAGE = '请先阅读并同意用户服务协议和隐私政策';

const SERVICE_AGREEMENT_CONTENT = [
  'Snowlit 是情侣私密记录工具。你需要使用已存在的 Snowlit 账号或完成微信绑定后登录。',
  '你应妥善保管账号信息，不上传违法、侵权或与当前关系空间无关的内容。',
  '日记、点滴、相册、清单和反馈内容仅用于 Snowlit 功能展示、同步和问题处理，具体数据使用以隐私政策为准。',
  '如不同意本协议，可以暂不登录，仍可进入首页浏览公开点滴。'
].join('\n');

const PRIVACY_POLICY_CONTENT = [
  '1. 登录与账号绑定：当你使用微信登录或绑定 Snowlit 账号时，我们会确认你的微信身份与 Snowlit 账号的绑定关系，用于登录、识别当前账号和保护私密内容。',
  '2. 账号资料：登录后会展示和编辑你的账号名、昵称、心情、简介等资料，用于我的页、资料编辑和内容作者展示。',
  '3. 位置：首次同意自动定位说明并授权后，首页打开或登录后自动定位，前台每 20 分钟更新，离开首页或切到后台暂停，用于首页天气、城市和距离；你也可以主动点击更新位置。后端将原始经纬度发给 Geoapify 和 Open-Meteo，用于城市、行政区和天气查询；不会附带姓名、微信身份或记录内容。服务商可能保留查询日志。地点可解析时，Snowlit 会保存本次位置和天气；拒绝授权不影响其他浏览。',
  '4. 图片：点滴、日记、相册、清单完成照片和反馈截图只会在你主动选择或拍摄图片时读取，并上传到 Snowlit，用于对应内容展示或反馈处理。',
  '5. 反馈与设备信息：你提交的反馈标题、内容、联系方式、图片，以及手机型号、系统版本、微信版本等基础信息，仅用于定位、复现和处理问题。',
  '6. 本地存储：为了保持登录状态和必要的页面访问状态，Snowlit 会在你的微信本地保存少量必要信息；退出登录会清理登录状态。'
].join('\n');

Page({
  data: {
    loggingIn: false,
    binding: false,
    showBindForm: false,
    bindUsername: '',
    bindPassword: '',
    bindMessage: '',
    privacyAgreed: false
  },

  onLoad() {
    if (isLoggedIn()) {
      this.navigateAfterLogin();
    }
  },

  handleWechatLogin() {
    if (this.data.loggingIn) {
      return;
    }
    if (!this.ensurePrivacyAgreed()) {
      return;
    }
    this.setData({ loggingIn: true, showBindForm: false, bindMessage: '' });
    wx.login({
      success: (result) => {
        if (!result.code) {
          this.handleLoginError(new Error('微信登录失败'));
          return;
        }
        authService.wechatLogin(result.code)
          .then((response) => {
            persistLoginSession(response);
            this.navigateAfterLogin();
          })
          .catch((error) => this.handleLoginError(error));
      },
      fail: () => {
        this.handleLoginError(new Error('微信登录失败'));
      }
    });
  },

  handleBindUsernameInput(event) {
    this.setData({
      bindUsername: event && event.detail ? event.detail.value : ''
    });
  },

  handleBindPasswordInput(event) {
    this.setData({
      bindPassword: event && event.detail ? event.detail.value : ''
    });
  },

  handleAgreementChange(event) {
    const values = event && event.detail && Array.isArray(event.detail.value) ? event.detail.value : [];
    this.setData({
      privacyAgreed: values.indexOf('agree') >= 0
    });
  },

  handleBindSubmit() {
    if (this.data.binding) {
      return;
    }
    if (!this.ensurePrivacyAgreed()) {
      return;
    }
    const username = (this.data.bindUsername || '').trim();
    const password = (this.data.bindPassword || '').trim();
    if (!username || !password) {
      showError({
        title: '请输入账号和密码',
        duration: 2200
      });
      return;
    }

    this.setData({
      binding: true,
      bindUsername: username,
      bindPassword: password,
      bindMessage: '正在绑定微信账号'
    });
    wx.login({
      success: (result) => {
        if (!result.code) {
          this.handleBindError(new Error('微信登录失败'));
          return;
        }
        authService.wechatBindLogin({
          code: result.code,
          username,
          password
        })
          .then((response) => {
            persistLoginSession(response);
            this.navigateAfterLogin();
          })
          .catch((error) => this.handleBindError(error));
      },
      fail: () => {
        this.handleBindError(new Error('微信登录失败'));
      }
    });
  },

  ensurePrivacyAgreed() {
    if (this.data.privacyAgreed) {
      return true;
    }
    showError({
      title: AGREEMENT_REQUIRED_MESSAGE,
      duration: 2400
    });
    return false;
  },

  handlePublicHome() {
    wx.switchTab({
      url: routePath(ROUTES.INDEX)
    });
  },

  handleServiceAgreement() {
    showAlert({
      title: '用户服务协议',
      content: SERVICE_AGREEMENT_CONTENT,
      confirmText: '知道了'
    });
  },

  handlePrivacy() {
    showAlert({
      title: '隐私政策',
      content: PRIVACY_POLICY_CONTENT,
      confirmText: '知道了'
    });
  },

  handleLoginError(error) {
    if (error && error.code === 'WECHAT_ACCOUNT_NOT_BOUND') {
      this.setData({
        loggingIn: false,
        showBindForm: true,
        bindMessage: '微信账号未绑定，请输入 Snowlit 账号密码完成绑定'
      });
      return;
    }
    this.setData({ loggingIn: false, showBindForm: false });
    showError({
      title: error && error.message ? error.message : '登录失败',
      duration: 2200
    });
  },

  handleBindError(error) {
    this.setData({
      binding: false,
      bindMessage: '微信账号未绑定，请输入 Snowlit 账号密码完成绑定'
    });
    showError({
      title: error && error.message ? error.message : '绑定失败',
      duration: 2200
    });
  },

  navigateAfterLogin() {
    this.setData({ loggingIn: false, binding: false });
    const redirect = getAndClearLoginRedirect();
    if (redirect) {
      if (isTabRoute(redirect)) {
        wx.switchTab({
          url: tabRoutePath(redirect),
          fail: () => {
            wx.switchTab({ url: routePath(ROUTES.INDEX) });
          }
        });
        return;
      }
      wx.redirectTo({
        url: redirect,
        fail: () => {
          wx.switchTab({ url: routePath(ROUTES.INDEX) });
        }
      });
      return;
    }
    wx.switchTab({
      url: routePath(ROUTES.INDEX)
    });
  }
});
