const { createFeedback, uploadFeedbackImage } = require('../../services/feedback');
const { isLoggedIn, redirectToLogin } = require('../../utils/auth');
const { showInfo, showSuccess } = require('../../utils/notify');
const { authorizePrivacy } = require('../../utils/privacy');
const { ROUTES, routePath } = require('../../constants/routes');
const {
  MAX_FEEDBACK_IMAGES,
  appendSelectedFeedbackImages,
  buildFeedbackPayload,
  buildSystemRows,
  collectUploadedFeedbackImageUrls,
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

    authorizePrivacy({
      title: '选择截图',
      message: '需要读取你选中的照片，用于提交反馈截图。'
    }).then((agreed) => {
      if (!agreed) {
        showInfo('同意隐私指引后才能选择截图');
        return;
      }
      if (this.data.submitting) {
        return;
      }

      wx.chooseMedia({
        count: MAX_FEEDBACK_IMAGES - this.data.screenshots.length,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (response) => {
          if (this.data.submitting) {
            return;
          }
          const result = appendSelectedFeedbackImages(this.data.screenshots, response.tempFiles);
          this.updateScreenshots(result.images);
          if (result.reachedLimit) {
            showInfo(`最多 ${MAX_FEEDBACK_IMAGES} 张`);
          }
        },
        fail: (error) => {
          if (!/cancel/i.test((error && error.errMsg) || '')) {
            showInfo('选择截图失败，请检查权限后重试');
          }
        }
      });
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
      collectUploadedFeedbackImageUrls(this.data.screenshots),
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
          collectUploadedFeedbackImageUrls(this.data.screenshots),
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
    return this.data.screenshots.reduce((promise, item, index) => {
      return promise.then(() => {
        if (item.status === 'uploaded' && item.url) {
          return Promise.resolve();
        }
        return this.uploadScreenshotAt(index);
      });
    }, Promise.resolve());
  },

  uploadScreenshotAt(index) {
    const screenshot = this.data.screenshots[index];
    if (!screenshot || !screenshot.path) {
      return Promise.resolve();
    }

    this.patchScreenshot(index, {
      status: 'uploading',
      progress: 0,
      message: '上传中 0%'
    });

    return uploadFeedbackImage(screenshot.path, (progress) => {
      const percent = progress && Number.isFinite(progress.progress) ? progress.progress : 0;
      this.patchScreenshot(index, {
        progress: percent,
        message: `上传中 ${percent}%`
      });
    })
      .then((response) => {
        if (!response || !response.url) {
          throw new Error('截图上传失败');
        }
        this.patchScreenshot(index, {
          url: response.url,
          status: 'uploaded',
          progress: 100,
          message: '已上传'
        });
      })
      .catch((error) => {
        this.patchScreenshot(index, {
          status: 'failed',
          progress: 0,
          message: '上传失败'
        });
        throw error;
      });
  },

  patchScreenshot(index, patch) {
    const screenshots = this.data.screenshots.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    this.updateScreenshots(screenshots);
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
