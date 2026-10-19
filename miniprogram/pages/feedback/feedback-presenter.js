const { appendPickedImages } = require('../../utils/image-list');

const MAX_FEEDBACK_IMAGES = 3;

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug 反馈' },
  { value: 'feature', label: '功能建议' },
  { value: 'experience', label: '体验问题' },
  { value: 'other', label: '其他' }
];

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function createInitialFeedbackForm() {
  return {
    type: 'bug',
    title: '',
    content: '',
    contact: ''
  };
}

function mapFeedbackTypes(activeType) {
  const selected = FEEDBACK_TYPES.some((item) => item.value === activeType) ? activeType : 'bug';
  return FEEDBACK_TYPES.map((item) => ({
    ...item,
    active: item.value === selected
  }));
}

function buildFeedbackPayload(form, imageUrls, context) {
  const source = form || {};
  const type = clean(source.type);
  const title = clean(source.title);
  const content = clean(source.content);
  const urls = (imageUrls || [])
    .map(clean)
    .filter(Boolean);

  if (!FEEDBACK_TYPES.some((item) => item.value === type)) {
    return { valid: false, message: '请选择反馈类型' };
  }
  if (!title) {
    return { valid: false, message: '请输入反馈标题' };
  }
  if (!content) {
    return { valid: false, message: '请输入反馈内容' };
  }
  if (urls.length > MAX_FEEDBACK_IMAGES) {
    return {
      valid: false,
      message: `最多只能上传 ${MAX_FEEDBACK_IMAGES} 张截图`
    };
  }

  return {
    valid: true,
    payload: {
      type,
      title,
      content,
      contact: clean(source.contact),
      imageUrls: urls,
      pageUrl: clean(context && context.pageUrl),
      userAgent: clean(context && context.userAgent)
    }
  };
}

function createLocalScreenshot(path) {
  return {
    id: path,
    path,
    url: '',
    status: 'local',
    progress: 0,
    message: ''
  };
}

function appendSelectedFeedbackImages(currentImages, selectedFiles) {
  return appendPickedImages(currentImages, selectedFiles, MAX_FEEDBACK_IMAGES, createLocalScreenshot);
}

function createFeedbackImageSlots(images) {
  const items = Array.isArray(images) ? images.slice(0, MAX_FEEDBACK_IMAGES) : [];
  const slots = items.map((item, index) => ({
    ...item,
    index,
    empty: false,
    displayUrl: item.path || item.url || ''
  }));

  while (slots.length < MAX_FEEDBACK_IMAGES) {
    slots.push({
      index: slots.length,
      empty: true
    });
  }
  return slots;
}

function buildSystemRows(context) {
  const pageUrl = clean(context && context.pageUrl) || '当前页面';
  const userAgent = clean(context && context.userAgent) || '自动附带';
  return [
    { label: '当前页面', value: pageUrl },
    { label: '设备信息', value: userAgent }
  ];
}

module.exports = {
  MAX_FEEDBACK_IMAGES,
  appendSelectedFeedbackImages,
  buildFeedbackPayload,
  buildSystemRows,
  createInitialFeedbackForm,
  createFeedbackImageSlots,
  mapFeedbackTypes
};
