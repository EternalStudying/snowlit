const assert = require('node:assert/strict');

const {
  buildWishCreatePayload,
  createWishFormFromDetail,
  createInitialWishForm,
  formatWishDateText,
  mapWishCategories,
  wishCategoryLabel
} = require('../pages/wish-edit/wish-edit-presenter');

function runInitialFormTest() {
  assert.deepEqual(createInitialWishForm('want_do'), {
    title: '',
    category: 'want_do',
    categoryText: '想做',
    expectedDate: '',
    expectedDateText: '选择日期',
    locationName: '',
    description: '',
    note: ''
  });
  assert.equal(createInitialWishForm('unknown').category, 'want_go');
}

function runCategoryMappingTest() {
  assert.deepEqual(mapWishCategories('want_go'), [
    { label: '想去', value: 'want_go', active: true },
    { label: '想做', value: 'want_do', active: false }
  ]);
  assert.equal(wishCategoryLabel('want_do'), '想做');
  assert.equal(wishCategoryLabel('other'), '想去');
}

function runDateFormatTest() {
  assert.equal(formatWishDateText('2026-06-14'), '2026.06.14');
  assert.equal(formatWishDateText(''), '选择日期');
}

function runPayloadTest() {
  const result = buildWishCreatePayload({
    title: '  春天一起赏樱  ',
    category: 'want_go',
    expectedDate: '2026-06-14',
    locationName: '  悉尼邦迪海滩  ',
    description: '  把想法轻轻写下  ',
    note: '  带相机  '
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, {
    title: '春天一起赏樱',
    category: 'want_go',
    description: '把想法轻轻写下',
    locationName: '悉尼邦迪海滩',
    expectedCompletedAt: '2026-06-14T00:00:00',
    note: '带相机'
  });
}

function runEditFormMappingTest() {
  const result = createWishFormFromDetail({
    title: '  春天一起赏樱  ',
    category: 'want_do',
    description: '  一起去很漂亮的地方  ',
    locationName: '  示例城市植物园  ',
    note: '  带一瓶水  ',
    expectedCompletedAt: '2026-06-14T00:00:00'
  });

  assert.deepEqual(result, {
    title: '春天一起赏樱',
    category: 'want_do',
    categoryText: '想做',
    expectedDate: '2026-06-14',
    expectedDateText: '2026.06.14',
    locationName: '示例城市植物园',
    description: '一起去很漂亮的地方',
    note: '带一瓶水'
  });
}

function runOptionalDateTest() {
  const result = buildWishCreatePayload({
    title: '一起做蛋糕',
    category: 'want_do',
    expectedDate: '',
    description: ''
  });

  assert.equal(result.valid, true);
  assert.equal(result.payload.expectedCompletedAt, null);
}

function runValidationTest() {
  assert.equal(buildWishCreatePayload({ title: '', category: 'want_go' }).message, '请输入标题');
  assert.equal(buildWishCreatePayload({ title: '去海边', category: 'done' }).message, '请选择类型');
}

runInitialFormTest();
runCategoryMappingTest();
runDateFormatTest();
runPayloadTest();
runEditFormMappingTest();
runOptionalDateTest();
runValidationTest();

console.log('wish-edit-presenter tests passed');
