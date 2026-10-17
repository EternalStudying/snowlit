const { routePath, ROUTES } = require('../../constants/routes');
const { updateProfile } = require('../../services/profile');
const { getStoredUser, setStoredUser } = require('../../utils/auth');
const { showError, showSuccess } = require('../../utils/notify');
const { mapCurrentUser } = require('../profile/profile-presenter');

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function createForm(user) {
  const currentUser = user || {};
  return {
    displayName: currentUser.displayName || '',
    mood: currentUser.mood === '未设置' ? '' : (currentUser.mood || ''),
    bio: currentUser.bio === '还没有简介' ? '' : (currentUser.bio || '')
  };
}

function createProfileUser(user) {
  return mapCurrentUser(user);
}

function createPayload(form) {
  const source = form || {};
  return {
    displayName: clean(source.displayName),
    mood: clean(source.mood),
    bio: clean(source.bio)
  };
}

function refreshGlobalUser(user) {
  const app = typeof getApp === 'function' ? getApp({ allowDefault: true }) : null;
  if (app && app.globalData) {
    app.globalData.user = user;
  }
}

Page({
  data: {
    user: mapCurrentUser(),
    form: createForm(),
    saving: false
  },

  onLoad() {
    this.loadProfile();
  },

  loadProfile() {
    const storedUser = getStoredUser();
    const user = createProfileUser(storedUser);
    this.setData({
      user,
      form: createForm(user)
    });
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: routePath(ROUTES.PROFILE) });
      }
    });
  },

  handleDisplayNameInput(event) {
    this.setData({ 'form.displayName': event.detail.value });
  },

  handleMoodInput(event) {
    this.setData({ 'form.mood': event.detail.value });
  },

  handleBioInput(event) {
    this.setData({ 'form.bio': event.detail.value });
  },

  saveProfile() {
    if (this.data.saving) {
      return Promise.resolve(false);
    }

    const payload = createPayload(this.data.form);
    if (!payload.displayName) {
      showError('请输入昵称');
      return Promise.resolve(false);
    }

    this.setData({ saving: true });

    return updateProfile(payload)
      .then((userResponse) => {
        const user = createProfileUser(userResponse);
        setStoredUser(userResponse);
        refreshGlobalUser(userResponse);
        this.setData({
          user,
          form: createForm(user),
          saving: false
        });
        showSuccess('资料已保存');
        this.goBack();
        return userResponse;
      })
      .catch((error) => {
        this.setData({ saving: false });
        return Promise.reject(error);
      });
  }
});
