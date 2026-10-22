const { appendPickedImages } = require('../../utils/image-list');

const MAX_ALBUM_PHOTOS = 50;
const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开' },
  { value: 'private', label: '私密' }
];

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function formatAlbumDateText(value) {
  return clean(value).replace(/-/g, '.');
}

function visibilityLabel(value) {
  const option = VISIBILITY_OPTIONS.find((item) => item.value === value);
  return option ? option.label : VISIBILITY_OPTIONS[0].label;
}

function createInitialAlbumForm(date) {
  const eventDate = date || '';
  return {
    title: '',
    visibility: 'public',
    visibilityText: visibilityLabel('public'),
    privatePassword: '',
    pinned: false,
    eventDate,
    eventDateText: eventDate ? formatAlbumDateText(eventDate) : '从照片读取或手动选择',
    location: '',
    description: ''
  };
}

function buildAlbumDraftPayload(form, originalVisibility) {
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
  if (albumPasswordRequired(visibility, originalVisibility) && !privatePassword) {
    return { valid: false, message: '请输入私密相册密码' };
  }

  return {
    valid: true,
    payload: {
      title,
      description: clean(source.description),
      eventDate,
      location: clean(source.location),
      visibility,
      privatePassword: visibility === 'private' ? privatePassword : '',
      pinned: Boolean(source.pinned)
    }
  };
}

function albumDraftFields(form) {
  const { title, description, eventDate, location, visibility, pinned } = form;
  return { title, description, ...(eventDate ? { eventDate } : {}), location, visibility, pinned: Boolean(pinned) };
}

function mapAlbumDraft(draft) {
  const form = { ...createInitialAlbumForm(), ...draft.fields, privatePassword: '' };
  form.eventDateText = form.eventDate ? formatAlbumDateText(form.eventDate) : '从照片读取或手动选择';
  form.visibilityText = visibilityLabel(form.visibility);
  return form;
}

function albumPasswordRequired(visibility, originalVisibility) {
  return visibility === 'private' && originalVisibility !== 'private';
}

function canRemoveAlbumPhoto(count, editMode) {
  return !editMode || count > 1;
}

function mapAlbumEdit(response) {
  const form = mapAlbumDraft({ fields: response.album });
  return {
    form,
    photos: response.photos.map((photo) => ({ ...photo, id: `photo-${photo.id}`, photoId: photo.id,
      path: photo.previewUrl, url: photo.previewUrl, status: 'uploaded', progress: 100, message: '已上传' }))
  };
}

function albumPhotoReferences(photos) {
  return photos.map((photo) => photo.photoId ? { photoId: photo.photoId } : { draftImageId: photo.draftImageId });
}

function buildAlbumSavePayload(form, photos, originalVisibility) {
  const result = buildAlbumDraftPayload(form, originalVisibility);
  if (!result.valid) return result;
  if (!photos.length) return { valid: false, message: '相册至少保留 1 张照片' };
  const { privatePassword, ...fields } = result.payload;
  return { valid: true, payload: { ...fields, ...(privatePassword ? { privatePassword } : {}), photos: albumPhotoReferences(photos) } };
}

function albumGridItems(photos) {
  return photos.map((photo, index) => ({ key: photo.id, src: photo.path, badge: index === 0 ? '封面' : '', message: photo.message, progress: photo.progress }));
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
  if (Array.isArray(existing) && existing.length >= MAX_ALBUM_PHOTOS) {
    return { photos: existing.slice(), reachedLimit: Boolean(selected && selected.length) };
  }
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
    ...(clean(source.takenAt) ? { takenAt: clean(source.takenAt) } : {}),
    location: clean(source.location),
    width: positiveNumber(source.width, 1),
    height: positiveNumber(source.height, 1)
  };
}

module.exports = {
  albumPasswordRequired, canRemoveAlbumPhoto, mapAlbumEdit, albumPhotoReferences, buildAlbumSavePayload, albumGridItems,
  MAX_ALBUM_PHOTOS,
  albumDraftFields,
  mapAlbumDraft,
  VISIBILITY_OPTIONS,
  appendSelectedAlbumPhotos,
  buildAlbumDraftPayload,
  createAlbumPhotoMetadata,
  createInitialAlbumForm,
  formatAlbumDateText,
  visibilityLabel
};
