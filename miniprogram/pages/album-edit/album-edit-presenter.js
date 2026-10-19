const { appendPickedImages } = require('../../utils/image-list');

const MAX_ALBUM_PHOTOS = 9;
const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开' },
  { value: 'private', label: '私密' }
];

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatAlbumDateText(value) {
  return clean(value).replace(/-/g, '.');
}

function visibilityLabel(value) {
  const option = VISIBILITY_OPTIONS.find((item) => item.value === value);
  return option ? option.label : VISIBILITY_OPTIONS[0].label;
}

function createInitialAlbumForm(date) {
  const eventDate = date || today();
  return {
    title: '',
    visibility: 'public',
    visibilityText: visibilityLabel('public'),
    privatePassword: '',
    pinned: false,
    eventDate,
    eventDateText: formatAlbumDateText(eventDate),
    location: '',
    description: ''
  };
}

function buildAlbumDraftPayload(form) {
  const source = form || {};
  const title = clean(source.title);
  const eventDate = clean(source.eventDate);
  const visibility = VISIBILITY_OPTIONS.some((item) => item.value === source.visibility) ? source.visibility : 'public';
  const privatePassword = clean(source.privatePassword);

  if (!title) {
    return { valid: false, message: '请输入相册标题' };
  }
  if (!eventDate) {
    return { valid: false, message: '请选择相册日期' };
  }
  if (visibility === 'private' && !privatePassword) {
    return { valid: false, message: '请输入私密相册密码' };
  }

  return {
    valid: true,
    payload: {
      title,
      description: clean(source.description),
      eventDate,
      location: clean(source.location) || '地球',
      visibility,
      privatePassword: visibility === 'private' ? privatePassword : '',
      pinned: Boolean(source.pinned)
    }
  };
}

function createPhoto(path, file) {
  return {
    id: `${path}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    path,
    width: Number(file.width) || 0,
    height: Number(file.height) || 0,
    size: Number(file.size) || 0,
    takenAt: '',
    status: 'local',
    progress: 0,
    message: '',
    url: ''
  };
}

function appendSelectedAlbumPhotos(existing, selected) {
  const result = appendPickedImages(existing, selected, MAX_ALBUM_PHOTOS, createPhoto);
  return {
    photos: result.images,
    reachedLimit: result.reachedLimit
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createAlbumPhotoMetadata(photo, index, form) {
  const source = photo || {};
  const albumForm = form || {};
  return {
    caption: clean(albumForm.title) || '未命名照片',
    takenAt: clean(source.takenAt) || clean(albumForm.eventDate),
    location: clean(albumForm.location) || '地球',
    width: positiveNumber(source.width, 1),
    height: positiveNumber(source.height, 1),
    sortOrder: index + 1
  };
}

module.exports = {
  MAX_ALBUM_PHOTOS,
  VISIBILITY_OPTIONS,
  appendSelectedAlbumPhotos,
  buildAlbumDraftPayload,
  createAlbumPhotoMetadata,
  createInitialAlbumForm,
  formatAlbumDateText,
  visibilityLabel
};
