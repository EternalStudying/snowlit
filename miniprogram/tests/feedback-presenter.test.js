const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_FEEDBACK_IMAGES,
  appendSelectedFeedbackImages,
  buildFeedbackPayload,
  createInitialFeedbackForm,
  createFeedbackImageSlots,
  mapFeedbackTypes
} = require('../pages/feedback/feedback-presenter');

function runInitialFormTest() {
  const form = createInitialFeedbackForm();

  assert.equal(form.type, 'bug');
  assert.equal(mapFeedbackTypes(form.type)[0].active, true);
}

function runPayloadMappingTest() {
  const result = buildFeedbackPayload(
    {
      type: 'feature',
      title: ' 想要反馈入口更明显 ',
      content: ' 首页找反馈有点慢。\n希望能更好找一点。 ',
      contact: ' wx: snowlit '
    },
    [' https://cdn.example.com/feedback/one.webp ', '', 'https://cdn.example.com/feedback/two.webp'],
    {
      pageUrl: '/pages/profile/index',
      userAgent: 'iOS 17.0 / WeChat 8.0.0'
    }
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, {
    type: 'feature',
    title: '想要反馈入口更明显',
    content: '首页找反馈有点慢。\n希望能更好找一点。',
    contact: 'wx: snowlit',
    imageUrls: [
      'https://cdn.example.com/feedback/one.webp',
      'https://cdn.example.com/feedback/two.webp'
    ],
    pageUrl: '/pages/profile/index',
    userAgent: 'iOS 17.0 / WeChat 8.0.0'
  });
}

function runValidationTest() {
  const base = {
    type: 'experience',
    title: '加载慢',
    content: '相册详情加载慢',
    contact: ''
  };

  assert.equal(buildFeedbackPayload({ ...base, type: 'oops' }, [], {}).message, '请选择反馈类型');
  assert.equal(buildFeedbackPayload({ ...base, title: '' }, [], {}).message, '请输入反馈标题');
  assert.equal(buildFeedbackPayload({ ...base, content: '' }, [], {}).message, '请输入反馈内容');
  assert.equal(
    buildFeedbackPayload(base, ['a', 'b', 'c', 'd'], {}).message,
    `最多只能上传 ${MAX_FEEDBACK_IMAGES} 张截图`
  );
}

function runScreenshotSelectionTest() {
  const result = appendSelectedFeedbackImages(
    [
      {
        id: 'a.jpg',
        path: 'a.jpg',
        url: '',
        status: 'local',
        progress: 0,
        message: ''
      }
    ],
    [
      { tempFilePath: 'b.jpg' },
      { path: 'c.jpg' },
      { tempFilePath: 'd.jpg' }
    ]
  );

  assert.equal(result.reachedLimit, true);
  assert.equal(result.images.length, MAX_FEEDBACK_IMAGES);
  assert.equal(result.images[1].path, 'b.jpg');
  assert.equal(result.images[2].path, 'c.jpg');
}

function runTypesAndSlotsTest() {
  assert.deepEqual(mapFeedbackTypes('bug').map((item) => ({ value: item.value, active: item.active })), [
    { value: 'bug', active: true },
    { value: 'feature', active: false },
    { value: 'experience', active: false },
    { value: 'other', active: false }
  ]);

  const slots = createFeedbackImageSlots([
    {
      id: 'a.jpg',
      path: 'a.jpg',
      status: 'local',
      progress: 0,
      message: ''
    }
  ]);

  assert.equal(slots.length, MAX_FEEDBACK_IMAGES);
  assert.equal(slots[0].empty, false);
  assert.equal(slots[0].path, 'a.jpg');
  assert.equal(slots[1].empty, true);
}

function runTemplateBindingTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/feedback/index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../pages/feedback/index.js'), 'utf8');

  assert.equal(js.includes("require('../../services/feedback')"), true);
  assert.equal(js.includes('uploadFeedbackImage'), true);
  assert.equal(js.includes(['uploadFeedback', 'Screenshot'].join('')), false);
  assert.equal(js.includes(['screen', 'shotUrls'].join('')), false);
  assert.equal(js.includes(['collectUploaded', 'ScreenshotUrls'].join('')), false);
  assert.equal(js.includes('createFeedback'), true);
  assert.equal(js.includes("title: '小纸条送到啦'"), true);
  assert.equal(js.includes('returnAfterSubmitSuccess'), true);
  assert.equal(js.includes('wx.navigateBack({ delta: 1 })'), true);
  assert.equal(js.includes('截图上传稍后接入'), false);
  assert.equal(js.includes('提交接口稍后接入'), false);
  assert.equal(js.includes('相册详情进入时有点慢'), false);
  assert.equal(wxml.includes('class="feedback-head snowlit-subpage-heading"'), true);
  assert.equal(wxml.includes('class="snowlit-subpage-brand">SNOWLIT'), true);
  assert.equal(wxml.includes('class="snowlit-subpage-title">反馈'), true);
  assert.equal(wxml.includes('class="snowlit-subpage-subtitle">把不好用的地方告诉我'), true);
  assert.equal(wxml.includes('snowlit-page-heading'), false);
  assert.equal(wxml.includes('class="feedback-brand"'), false);
  assert.equal(wxml.includes('class="feedback-hero"'), false);
  assert.equal(wxml.includes('class="feedback-title"'), false);
  assert.equal(wxml.includes('class="feedback-subtitle"'), false);
  assert.equal(wxml.includes('<text class="required-star">*</text>'), true);
  assert.equal(wxml.includes('form.type === item.value'), false);
  assert.equal(wxml.includes('item.active'), true);
  assert.equal(wxml.includes('catchtap="removeScreenshot"'), true);
  assert.equal(wxml.includes('bindtap="previewScreenshot"'), true);
  assert.equal(wxml.includes('disabled="{{submitting}}"'), true);
}

function runSystemCardStyleTest() {
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/feedback/index.wxss'), 'utf8');

  assert.match(wxss, /\.system-row\s*\{[\s\S]*grid-template-columns:\s*128rpx minmax\(0,\s*1fr\);/);
  assert.match(wxss, /\.system-label\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(wxss, /\.system-value\s*\{[\s\S]*min-width:\s*0;[\s\S]*word-break:\s*break-all;/);
}

runInitialFormTest();
runPayloadMappingTest();
runValidationTest();
runScreenshotSelectionTest();
runTypesAndSlotsTest();
runTemplateBindingTest();
runSystemCardStyleTest();

console.log('feedback-presenter tests passed');
