const { getToken, getStoredUser } = require('./utils/auth');
const { config } = require('./constants/config');
const { theme } = require('./constants/theme');

const FONT_WEIGHTS = [
  ['light', '300'],
  ['regular', '400'],
  ['medium', '500'],
  ['semibold', '600']
];

function loadSnowlitFonts() {
  if (!wx.loadFontFace || !config.fontFace) {
    return;
  }

  const { family, urls } = config.fontFace;
  if (!family || !urls) {
    return;
  }

  FONT_WEIGHTS.forEach(([key, weight]) => {
    const url = urls[key];
    if (!url) {
      return;
    }

    wx.loadFontFace({
      global: true,
      family,
      source: `url("${url}")`,
      desc: {
        weight
      }
    });
  });
}

App({
  globalData: {
    token: '',
    user: null,
    theme
  },

  onLaunch() {
    loadSnowlitFonts();
    this.globalData.token = getToken();
    this.globalData.user = getStoredUser();
  }
});
