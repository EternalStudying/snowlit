const assert = require('node:assert/strict');

const {
  MAX_ALBUM_PHOTOS,
  appendSelectedAlbumPhotos,
  buildAlbumDraftPayload,
  createAlbumPhotoMetadata,
  createInitialAlbumForm
} = require('../pages/album-edit/album-edit-presenter');

function runInitialFormTest() {
  const unknown = createInitialAlbumForm();
  assert.equal(unknown.eventDate, '', 'an unknown shooting date must not silently default to today');
  assert.equal(unknown.location, '');

  const form = createInitialAlbumForm('2026-05-28');

  assert.equal(form.eventDate, '2026-05-28');
  assert.equal(form.eventDateText, '2026.05.28');
  assert.equal(form.visibility, 'public');
  assert.equal(form.visibilityText, '公开');
  assert.equal(form.privatePassword, '');
}

function runPayloadValidationTest() {
  assert.equal(buildAlbumDraftPayload({ ...createInitialAlbumForm('2026-05-28'), title: '' }).message, '请输入相册标题');
  const undated = buildAlbumDraftPayload({ ...createInitialAlbumForm(), title: 'Undated album' });
  assert.equal(undated.valid, false);
  assert.equal(undated.message, '请选择相册日期');
  assert.equal(
    buildAlbumDraftPayload({
      ...createInitialAlbumForm('2026-05-28'),
      title: '私密',
      visibility: 'private',
      privatePassword: ''
    }).message,
    '请输入私密相册密码'
  );
}

function runPayloadMappingTest() {
  const result = buildAlbumDraftPayload({
    ...createInitialAlbumForm('2026-05-28'),
    title: '  集市相册 ',
    description: ' 今天买了花 ',
    location: '',
    visibility: 'private',
    privatePassword: ' 5201314 ',
    pinned: true
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, {
    title: '集市相册',
    description: '今天买了花',
    eventDate: '2026-05-28',
    location: '',
    visibility: 'private',
    privatePassword: '5201314',
    pinned: true
  });
}

function runPhotoSelectionTest() {
  const result = appendSelectedAlbumPhotos(
    [],
    [
      { tempFilePath: 'a.jpg', width: 900, height: 1200 },
      { path: 'b.jpg' }
    ]
  );

  assert.equal(result.photos.length, 2);
  assert.equal(result.photos[0].path, 'a.jpg');
  assert.equal(result.photos[0].width, 900);
  assert.equal(result.photos[0].height, 1200);
  assert.equal(result.photos[0].status, 'local');
  assert.equal(result.reachedLimit, false);
}

function runPhotoLimitTest() {
  const existing = Array.from({ length: MAX_ALBUM_PHOTOS - 1 }, (_, index) => ({
    id: `old-${index}`,
    path: `${index}.jpg`,
    status: 'local'
  }));
  const result = appendSelectedAlbumPhotos(existing, [
    { tempFilePath: 'new-a.jpg' },
    { tempFilePath: 'new-b.jpg' }
  ]);

  assert.equal(result.photos.length, MAX_ALBUM_PHOTOS);
  assert.equal(result.reachedLimit, true);
}

function runMetadataTest() {
  const metadata = createAlbumPhotoMetadata(
    {
      path: 'wxfile://tmp.jpg',
      width: 900,
      height: 1200
    },
    2,
    {
      title: '集市相册',
      eventDate: '2026-05-28',
      location: ''
    }
  );

  assert.deepEqual(metadata, {
    caption: '集市相册',
    takenAt: '2026-05-28',
    location: '',
    width: 900,
    height: 1200,
    sortOrder: 3
  });

  const unknown = createAlbumPhotoMetadata({}, 0, createInitialAlbumForm());
  assert.equal(unknown.takenAt, '');
  assert.equal(unknown.location, '');
}

runInitialFormTest();
runPayloadValidationTest();
runPayloadMappingTest();
runPhotoSelectionTest();
runPhotoLimitTest();
runMetadataTest();

console.log('album-edit presenter tests passed');
