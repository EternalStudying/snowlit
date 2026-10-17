const assert = require('node:assert/strict');

const {
  MAX_DIARY_IMAGES,
  appendSelectedDiaryImages,
  buildDiaryCreatePayload,
  buildDiaryUpdatePayload,
  collectUploadedDiaryImageUrls,
  createInitialDiaryForm,
  insertDiaryImageMarkdown,
  insertInlineMarkdown,
  mapDiaryEditForm,
  mapDiaryMoods
} = require('../pages/diary-edit/diary-edit-presenter');

function runInitialFormTest() {
  const form = createInitialDiaryForm(new Date(2026, 4, 28, 9, 5));

  assert.equal(form.date, '2026-05-28');
  assert.equal(form.dateText, '2026.05.28');
  assert.equal(form.moodKey, 'happy');
  assert.equal(form.moodText, '开心');
  assert.equal(form.visibility, 'shared');
  assert.equal(form.title, '');
  assert.equal(form.content, '');
}

function runMoodMappingTest() {
  const moods = mapDiaryMoods('sweet');

  assert.equal(moods.length, 10);
  assert.equal(moods.find((item) => item.value === 'sweet').active, true);
  assert.equal(mapDiaryMoods('unknown').find((item) => item.value === 'happy').active, true);
}

function runPayloadMappingTest() {
  const result = buildDiaryCreatePayload({
    title: ' 集市的花 ',
    date: '2026-05-28',
    moodKey: 'touched',
    visibility: 'private',
    content: ' 今天路过集市，买了一束很亮的花。\n\n![图片](https://cdn.example.com/diary/one.webp) '
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, {
    contentMarkdown: '# 集市的花\n\n今天路过集市，买了一束很亮的花。\n\n![图片](https://cdn.example.com/diary/one.webp)',
    date: '2026-05-28',
    moodKey: 'touched',
    visibility: 'private'
  });
}

function runUpdatePayloadMappingTest() {
  const result = buildDiaryUpdatePayload({
    title: ' 改过标题 ',
    date: '2026-05-29',
    moodKey: 'sweet',
    visibility: 'private',
    content: ' 正文 '
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, {
    contentMarkdown: '# 改过标题\n\n正文',
    moodKey: 'sweet',
    visibility: 'private'
  });
}

function runExistingHeadingPayloadTest() {
  const result = buildDiaryCreatePayload({
    title: '标题输入优先',
    date: '2026-05-28',
    moodKey: 'happy',
    visibility: 'shared',
    content: '# 自己写的标题\n\n正文'
  });

  assert.equal(result.valid, true);
  assert.equal(result.payload.contentMarkdown, '# 标题输入优先\n\n正文');
}

function runEditFormMappingTest() {
  const form = mapDiaryEditForm({
    title: '已有日记',
    contentMarkdown: '# 已有日记\n\n正文\n\n![图片](https://cdn.example.com/one.jpg)',
    entryDate: '2026-05-28',
    moodKey: 'touched',
    visibility: 'private'
  });

  assert.deepEqual(form, {
    title: '已有日记',
    date: '2026-05-28',
    dateText: '2026.05.28',
    moodKey: 'touched',
    moodText: '感动',
    visibility: 'private',
    content: '正文\n\n![图片](https://cdn.example.com/one.jpg)'
  });
}

function runValidationTest() {
  assert.equal(buildDiaryCreatePayload({ title: '', content: '正文', date: '2026-05-28', moodKey: 'happy', visibility: 'shared' }).message, '请输入标题');
  assert.equal(buildDiaryCreatePayload({ title: '标题', content: '', date: '2026-05-28', moodKey: 'happy', visibility: 'shared' }).message, '先写一点日记内容吧');
  assert.equal(buildDiaryCreatePayload({ title: '标题', content: '正文', date: '', moodKey: 'happy', visibility: 'shared' }).message, '请选择日记日期');
  assert.equal(buildDiaryCreatePayload({ title: '标题', content: '正文', date: '2026-05-28', moodKey: 'other', visibility: 'shared' }).message, '请选择正确心情');
  assert.equal(buildDiaryCreatePayload({ title: '标题', content: '正文', date: '2026-05-28', moodKey: 'happy', visibility: 'public' }).message, '请选择正确可见范围');
}

function runImageSelectionTest() {
  const selected = Array.from({ length: MAX_DIARY_IMAGES + 2 }, (_, index) => ({
    tempFilePath: `tmp/${index}.jpg`
  }));
  const result = appendSelectedDiaryImages([], selected);

  assert.equal(result.reachedLimit, true);
  assert.equal(result.images.length, MAX_DIARY_IMAGES);
  assert.deepEqual(result.images[0], {
    id: 'tmp/0.jpg',
    path: 'tmp/0.jpg',
    preview: 'tmp/0.jpg',
    url: '',
    status: 'local',
    progress: 0,
    message: ''
  });
}

function runUploadedUrlTest() {
  const urls = collectUploadedDiaryImageUrls([
    { status: 'uploaded', url: 'https://cdn.example.com/diary/one.webp' },
    { status: 'failed', url: 'https://cdn.example.com/diary/two.webp' },
    { status: 'uploaded', url: '  https://cdn.example.com/diary/three.webp  ' }
  ]);

  assert.deepEqual(urls, [
    'https://cdn.example.com/diary/one.webp',
    'https://cdn.example.com/diary/three.webp'
  ]);
}

function runMarkdownInsertTest() {
  assert.deepEqual(insertInlineMarkdown('今天很好', '**', '**', '重点', 2, 4), {
    content: '今天**很好**',
    cursor: 8
  });

  assert.deepEqual(insertDiaryImageMarkdown('今天很好', 'https://cdn.example.com/diary/one.webp', 4), {
    content: '今天很好\n\n![图片](https://cdn.example.com/diary/one.webp)\n\n',
    cursor: 53
  });
}

runInitialFormTest();
runMoodMappingTest();
runPayloadMappingTest();
runUpdatePayloadMappingTest();
runExistingHeadingPayloadTest();
runEditFormMappingTest();
runValidationTest();
runImageSelectionTest();
runUploadedUrlTest();
runMarkdownInsertTest();

console.log('diary-edit-presenter tests passed');
