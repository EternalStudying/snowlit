const { createFeedback, uploadFeedbackImage } = require('../../services/feedback');
const { isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { showInfo, showSuccess } = require('../../utils/notify');
const { collectUploadedUrls } = require('../../utils/image-list');
const { pickImages } = require('../../utils/image-picker');
const { patchItem, uploadQueue } = require('../../utils/upload-queue');
const { ROUTES, routePath } = require('../../constants/routes');
const {
  MAX_FEEDBACK_IMAGES,
  appendSelectedFeedbackImages,
  buildFeedbackPayload,
  buildSystemRows,
  createInitialFeedbackForm,
  createFeedbackImageSlots,
  mapFeedbackTypes
} = require('./feedback-presenter');

const initialForm = createInitialFeedbackForm();

Page({
  data: {
    feedbackTypes: mapFeedbackTypes(initialForm.type),
    form: initialForm,
    contentLength: 0,
    screenshots: [],
    screenshotSlots: createFeedbackImageSlots([]),
    canAddScreenshot: true,
    systemRows: buildSystemRows(),
    submitting: false,
    message: ''
  },

  onLoad() {
    if (!isLoggedIn()) {
      redirectToLogin({ redirect: routePath(ROUTES.FEEDBACK) });
      return;
    }
    this.refreshSystemRows();
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: '/pages/profile/index' });
  },

  selectType(event) {
    const type = event.currentTarget.dataset.type;
    this.setData({
      'form.type': type,
      feedbackTypes: mapFeedbackTypes(type),
      message: ''
    });
  },

  handleTitleInput(event) {
    this.setData({
      'form.title': event.detail.value,
      message: ''
    });
  },

  handleContentInput(event) {
    const value = event.detail.value || '';
    this.setData({
      'form.content': value,
      contentLength: value.length,
      message: ''
    });
  },

  handleContactInput(event) {
    this.setData({
      'form.contact': event.detail.value,
      message: ''
    });
  },

  chooseScreenshot() {
    if (this.data.submitting) {
      return;
    }
    if (!this.data.canAddScreenshot) {
      showInfo(`最多 ${MAX_FEEDBACK_IMAGES} 张`);
      return;
    }

    pickImages({
      count: MAX_FEEDBACK_IMAGES - this.data.screenshots.length,
      title: '选择截图',
      message: '需要读取你选中的照片，用于提交反馈截图。',
      noun: '截图',
      isBlocked: () => this.data.submitting
    }).then((files) => {
      if (!files.length) {
        return;
      }
      const result = appendSelectedFeedbackImages(this.data.screenshots, files);
      this.updateScreenshots(result.images);
      if (result.reachedLimit) {
        showInfo(`最多 ${MAX_FEEDBACK_IMAGES} 张`);
      }
    });
  },

  previewScreenshot(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const urls = this.data.screenshots
      .map((item) => item.path || item.url)
      .filter(Boolean);
    if (!urls.length) {
      return;
    }
    wx.previewImage({
      current: urls[index] || urls[0],
      urls
    });
  },

  removeScreenshot(event) {
    if (this.data.submitting) {
      return;
    }
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) {
      return;
    }
    this.updateScreenshots(this.data.screenshots.filter((item, itemIndex) => itemIndex !== index));
  },

  submitFeedback() {
    if (this.data.submitting) {
      return;
    }

    const payloadResult = buildFeedbackPayload(
      this.data.form,
      collectUploadedUrls(this.data.screenshots),
      this.buildSubmitContext()
    );
    if (!payloadResult.valid) {
      this.showMessage(payloadResult.message);
      return;
    }

    this.setData({
      submitting: true,
      message: ''
    });

    this.uploadScreenshots()
      .then(() => {
        const latestPayload = buildFeedbackPayload(
          this.data.form,
          collectUploadedUrls(this.data.screenshots),
          this.buildSubmitContext()
        );
        if (!latestPayload.valid) {
          throw new Error(latestPayload.message);
        }
        return createFeedback(latestPayload.payload);
      })
      .then(() => {
        this.resetForm();
        showSuccess({
          title: '小纸条送到啦',
          duration: 1800
        });
        this.returnAfterSubmitSuccess();
      })
      .catch((error) => {
        this.showMessage((error && error.message) || '反馈提交失败，请稍后重试');
      })
      .then(() => {
        this.setData({ submitting: false });
      });
  },

  uploadScreenshots() {
    return uploadQueue({
      read: () => this.data.screenshots,
      patch: (index, patch) => this.updateScreenshots(patchItem(this.data.screenshots, index, patch)),
      failureMessage: '截图上传失败',
      upload: (screenshot, index, onProgress) => uploadFeedbackImage(screenshot.path, onProgress)
    });
  },

  updateScreenshots(screenshots) {
    this.setData({
      screenshots,
      screenshotSlots: createFeedbackImageSlots(screenshots),
      canAddScreenshot: screenshots.length < MAX_FEEDBACK_IMAGES,
      message: ''
    });
  },

  resetForm() {
    const form = createInitialFeedbackForm();
    this.setData({
      form,
      feedbackTypes: mapFeedbackTypes(form.type),
      contentLength: 0,
      screenshots: [],
      screenshotSlots: createFeedbackImageSlots([]),
      canAddScreenshot: true,
      message: '反馈已送达，会认真看'
    });
  },

  returnAfterSubmitSuccess() {
    setTimeout(() => {
      if (getCurrentPages().length > 1) {
        wx.navigateBack({ delta: 1 });
        return;
      }
      wx.switchTab({ url: '/pages/profile/index' });
    }, 900);
  },

  refreshSystemRows() {
    this.setData({
      systemRows: buildSystemRows(this.buildSubmitContext())
    });
  },

  buildSubmitContext() {
    return {
      pageUrl: this.currentPageUrl(),
      userAgent: this.deviceSummary()
    };
  },

  currentPageUrl() {
    const pages = getCurrentPages();
    const page = pages && pages.length ? pages[pages.length - 1] : null;
    if (!page || !page.route) {
      return routePath(ROUTES.FEEDBACK);
    }
    const options = page.options || {};
    const query = Object.keys(options)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
      .join('&');
    return query ? `/${page.route}?${query}` : `/${page.route}`;
  },

  deviceSummary() {
    const device = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
    const appBase = wx.getAppBaseInfo ? wx.getAppBaseInfo() : {};
    const brand = device.brand || '';
    const model = device.model || '';
    const system = device.system || '';
    const wechatVersion = appBase.version ? `WeChat ${appBase.version}` : '';
    const sdkVersion = appBase.SDKVersion ? `SDK ${appBase.SDKVersion}` : '';
    return [brand, model, system, wechatVersion, sdkVersion]
      .filter(Boolean)
      .join(' / ') || '自动附带';
  },

  showMessage(message) {
    const title = message || '操作失败';
    this.setData({ message: title });
    showInfo(title);
  }
});
