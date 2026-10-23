const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  appendSelectedImages,
  buildStoryPayload,
  mapPickedLocation,
  mapStoryEditForm,
  mapStoryEditCategories
} = require('../pages/story-edit/story-edit-presenter');

function createValidForm(overrides) {
  return {
    title: ' 第一次看海 ',
    content: ' 晚风很好。\n海很亮 ',
    eventDate: '2026-05-01',
    eventTime: '20:00',
    endDate: '2026-05-02',
    endTime: '21:30',
    locationName: ' 海边 ',
    address: ' 示例城市示例街区 ',
    longitude: '18.6759',
    latitude: '4.8741',
    category: 'travel',
    ...(overrides || {})
  };
}

function runPayloadMappingTest() {
  const result = buildStoryPayload(createValidForm(), [
    'https://cdn.example.com/story/one.webp',
    ' ',
    'https://cdn.example.com/story/two.webp'
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, {
    title: '第一次看海',
    content: '晚风很好。\n海很亮',
    eventTime: '2026-05-01T20:00:00',
    endTime: '2026-05-02T21:30:00',
    locationName: '海边',
    address: '示例城市示例街区',
    longitude: 18.6759,
    latitude: 4.8741,
    category: 'travel',
    images: [
      'https://cdn.example.com/story/one.webp',
      'https://cdn.example.com/story/two.webp'
    ]
  });
}

function runOptionalEndTimeTest() {
  const result = buildStoryPayload(createValidForm({
    endDate: '',
    endTime: ''
  }), []);

  assert.equal(result.valid, true);
  assert.equal(result.payload.endTime, null);
}

function runValidationTest() {
  assert.deepEqual(buildStoryPayload(createValidForm({ title: '' }), []).message, '请输入标题');
  assert.deepEqual(buildStoryPayload(createValidForm({ eventDate: '' }), []).message, '请选择开始时间');
  assert.deepEqual(buildStoryPayload(createValidForm({ locationName: '' }), []).message, '请输入地点名称');
  assert.deepEqual(buildStoryPayload(createValidForm({ longitude: '' }), []).message, '请在地图上选择地点');
  assert.deepEqual(buildStoryPayload(createValidForm({ category: 'other' }), []).message, '请选择正确分类');
}

function runImageSelectionTest() {
  const current = [
    {
      id: 'a',
      path: 'a.jpg',
      url: '',
      status: 'local',
      progress: 0,
      message: ''
    }
  ];
  const result = appendSelectedImages(current, [
    { tempFilePath: 'b.jpg' },
    { path: 'c.jpg' },
    { tempFilePath: 'd.jpg' }
  ]);

  assert.equal(result.reachedLimit, true);
  assert.equal(result.images.length, 3);
  assert.deepEqual(result.images[1], {
    id: 'b.jpg',
    path: 'b.jpg',
    url: '',
    status: 'local',
    progress: 0,
    message: ''
  });
  assert.equal(result.images[2].path, 'c.jpg');
}

function runCategoryMappingTest() {
  assert.deepEqual(mapStoryEditCategories('travel'), [
    { label: '日常', value: 'daily', active: false },
    { label: '约会', value: 'date', active: false },
    { label: '旅行', value: 'travel', active: true },
    { label: '纪念', value: 'anniversary', active: false },
    { label: '惊喜', value: 'surprise', active: false }
  ]);
}

function runEditFormMappingTest() {
  const result = mapStoryEditForm({
    title: ' 第一次看海 ',
    content: ' 晚风很好 ',
    eventTime: '2026-05-01T20:00:00',
    endTime: '2026-05-02T21:30:00',
    locationName: ' 海边 ',
    address: ' 示例城市示例街区 ',
    longitude: 18.6759,
    latitude: 4.8741,
    category: 'travel',
    images: [
      'https://snowlit.example.com/media/story/one.webp',
      'https://snowlit.example.com/media/story/two.webp'
    ]
  });

  assert.deepEqual(result.form, {
    title: '第一次看海',
    content: '晚风很好',
    eventDate: '2026-05-01',
    eventTime: '20:00',
    endDate: '2026-05-02',
    endTime: '21:30',
    locationName: '海边',
    address: '示例城市示例街区',
    longitude: '18.6759',
    latitude: '4.8741',
    category: 'travel'
  });
  assert.deepEqual(result.images, [
    {
      id: 'https://snowlit.example.com/media/story/one.webp',
      path: 'https://snowlit.example.com/media/story/one.webp',
      url: 'https://snowlit.example.com/media/story/one.webp',
      status: 'uploaded',
      progress: 100,
      message: ''
    },
    {
      id: 'https://snowlit.example.com/media/story/two.webp',
      path: 'https://snowlit.example.com/media/story/two.webp',
      url: 'https://snowlit.example.com/media/story/two.webp',
      status: 'uploaded',
      progress: 100,
      message: ''
    }
  ]);
}

function runTemplateBindingTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/story-edit/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/story-edit/index.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../pages/story-edit/index.js'), 'utf8');
  const backButtonRule = wxss.match(/\.back-button\s*\{[\s\S]*?\n\}/);
  const basicSectionRule = wxss.match(/\.edit-section--basic\s*\{[\s\S]*?\n\}/);

  assert.equal(wxml.includes('bindtap="chooseImages"'), true);
  assert.equal(wxml.includes('bindtap="submitMoment"'), true);
  assert.equal(wxml.includes("{{isEditing ? '保存修改' : '发布点滴'}}"), true);
  assert.equal(wxml.includes('disabled="{{submitting || loadingMoment || draftLocked || removingImage}}"'), true);
  assert.equal(wxml.includes('bindinput="handleInput"'), true);
  assert.equal(wxml.includes('class="edit-section edit-section--words"'), true);
  assert.equal(wxml.includes('class="words-row"'), false);
  assert.equal(wxml.includes('class="words-label"'), false);
  assert.equal(wxml.includes('<view class="words-label">内容</view>'), false);
  assert.equal(wxml.includes('data-field="content"'), true);
  assert.equal(wxml.includes('class="page-head"'), false);
  assert.equal(wxml.includes('class="story-brand"'), false);
  assert.equal(wxml.includes('class="story-title"'), false);
  assert.equal(wxml.includes('class="story-subtitle"'), false);
  assert.equal(wxml.includes('把这一刻轻轻记下'), false);
  // Writing first; time and place together in one card, with manual coordinates tucked away.
  assert.ok(wxml.indexOf('class="title-input"') < wxml.indexOf('class="edit-section edit-section--words"'));
  assert.ok(wxml.indexOf('class="edit-section edit-section--words"') < wxml.indexOf('class="detail-card"'));
  assert.match(wxml, /class="detail-row detail-row--end"[\s\S]*catchtap="clearEndTime"/);
  assert.match(wxml, /bindtap="addEndTime"/);
  assert.match(wxml, /class="detail-row detail-row--place"[^>]*bindtap="handleOpenPlaceSheet"/);
  assert.match(wxml, /bindtap="toggleManualPlace"/);
  assert.match(wxml, /<view class="manual-place" wx:if="\{\{manualPlace\}\}">[\s\S]*data-field="latitude"[\s\S]*data-field="longitude"/);
  assert.equal(wxml.includes('经纬度'), false);
  assert.equal(js.includes('回忆住进来啦'), true);
  assert.equal(js.includes("title: this.data.isEditing ? '点滴已经认真改好啦' : '回忆住进来啦'"), true);
  assert.equal(js.includes("title: '已发布'"), false);
  assert.equal(js.includes('loadMomentForEdit'), true);
  assert.equal(js.includes('updateMoment(this.data.momentId'), true);
  assert.ok(backButtonRule, 'back button style should exist');
  assert.ok(basicSectionRule, 'basic section style should exist');
  assert.match(backButtonRule[0], /top:\s*94rpx;/);
  assert.match(basicSectionRule[0], /padding-top:\s*183rpx;/);
  assert.equal(wxml.includes('handleAddPhoto'), false);
  assert.equal(wxml.includes('handlePublish'), false);
  assert.equal(wxml.includes('handleFieldTap'), false);
  assert.equal(wxml.includes('form.contentLines'), false);
}

function runPickedLocationTest() {
  const form = { locationName: '手写的名字', address: '手写的地址', longitude: '', latitude: '' };

  // A picked place fills name, address and coordinates (GCJ-02, as stored), rounded to 6 places.
  assert.deepEqual(mapPickedLocation(form, {
    name: '西湖音乐喷泉', address: '浙江省杭州市西湖区湖滨路', latitude: 30.25961234567, longitude: 120.16412345678
  }), {
    locationName: '西湖音乐喷泉', address: '浙江省杭州市西湖区湖滨路', longitude: '120.164123', latitude: '30.259612'
  });
  // A dropped pin has no name or address: keep what was typed.
  assert.deepEqual(mapPickedLocation(form, { name: '', address: '', latitude: 30.1, longitude: 120.2 }), {
    locationName: '手写的名字', address: '手写的地址', longitude: '120.200000', latitude: '30.100000'
  });
  // Long names and addresses are cut to the form's limits.
  const long = mapPickedLocation(form, { name: '名'.repeat(40), address: '址'.repeat(90), latitude: 1, longitude: 2 });
  assert.equal(long.locationName.length, 30);
  assert.equal(long.address.length, 80);
  // Nothing usable picked: no change.
  assert.equal(mapPickedLocation(form, { name: 'x' }), null);
  assert.equal(mapPickedLocation(form, { latitude: 95, longitude: 10 }), null);

  // The picked coordinates satisfy the publish check.
  const picked = mapPickedLocation(form, { name: '公园', address: '', latitude: 30.1, longitude: 120.2 });
  assert.equal(buildStoryPayload(createValidForm(picked), []).payload.latitude, 30.1);

  const wxml = fs.readFileSync(path.join(__dirname, '../pages/story-edit/index.wxml'), 'utf8');
  assert.match(wxml, /<place-search-sheet[\s\S]*bind:search="handlePlaceSearch"[\s\S]*bind:map="handlePlaceMap"/);
  assert.equal(wxml.includes('手动填写坐标'), false);
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.ok(appJson.requiredPrivateInfos.includes('chooseLocation'));
}

runPayloadMappingTest();
runPickedLocationTest();
runOptionalEndTimeTest();
runValidationTest();
runImageSelectionTest();
runCategoryMappingTest();
runEditFormMappingTest();
runTemplateBindingTest();

console.log('story-edit-presenter tests passed');
