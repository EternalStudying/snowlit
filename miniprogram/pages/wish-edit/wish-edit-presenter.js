const WISH_CATEGORIES = [
  { label: '想去', value: 'want_go' },
  { label: '想做', value: 'want_do' }
];

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function isValidCategory(value) {
  return WISH_CATEGORIES.some((item) => item.value === value);
}

function wishCategoryLabel(value) {
  const found = WISH_CATEGORIES.find((item) => item.value === value);
  return found ? found.label : WISH_CATEGORIES[0].label;
}

function formatWishDateText(value) {
  const text = clean(value);
  return text ? text.replace(/-/g, '.') : '选择日期';
}

function createInitialWishForm(category) {
  const value = isValidCategory(category) ? category : WISH_CATEGORIES[0].value;
  return {
    title: '',
    category: value,
    categoryText: wishCategoryLabel(value),
    expectedDate: '',
    expectedDateText: formatWishDateText(''),
    locationName: '',
    description: '',
    note: ''
  };
}

function dateValue(value) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}

function createWishFormFromDetail(detail) {
  const source = detail || {};
  const category = isValidCategory(source.category) ? source.category : WISH_CATEGORIES[0].value;
  const expectedDate = dateValue(source.expectedCompletedAt);

  return {
    title: clean(source.title),
    category,
    categoryText: wishCategoryLabel(category),
    expectedDate,
    expectedDateText: formatWishDateText(expectedDate),
    locationName: clean(source.locationName),
    description: clean(source.description),
    note: clean(source.note)
  };
}

function mapWishCategories(activeCategory) {
  const value = isValidCategory(activeCategory) ? activeCategory : WISH_CATEGORIES[0].value;
  return WISH_CATEGORIES.map((item) => ({
    ...item,
    active: item.value === value
  }));
}

function buildWishCreatePayload(form) {
  const source = form || {};
  const title = clean(source.title);
  const category = clean(source.category);
  const expectedDate = clean(source.expectedDate);

  if (!title) {
    return { valid: false, message: '请输入标题' };
  }
  if (!isValidCategory(category)) {
    return { valid: false, message: '请选择类型' };
  }

  return {
    valid: true,
    payload: {
      title,
      category,
      description: clean(source.description),
      locationName: clean(source.locationName),
      expectedCompletedAt: expectedDate ? `${expectedDate}T00:00:00` : null,
      note: clean(source.note)
    }
  };
}

module.exports = {
  WISH_CATEGORIES,
  buildWishCreatePayload,
  createWishFormFromDetail,
  createInitialWishForm,
  formatWishDateText,
  mapWishCategories,
  wishCategoryLabel
};
