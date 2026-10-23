const { appendPickedImages } = require('../../utils/image-list');

const MAX_STORY_IMAGES = 3;

const STORY_CATEGORIES = [
  { label: '日常', value: 'daily' },
  { label: '约会', value: 'date' },
  { label: '旅行', value: 'travel' },
  { label: '纪念', value: 'anniversary' },
  { label: '惊喜', value: 'surprise' }
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function clean(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function isValidCategory(value) {
  return STORY_CATEGORIES.some((item) => item.value === value);
}

function normalizeDate(value) {
  const normalized = clean(value).replace(/\./g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function normalizeTime(value) {
  const normalized = clean(value);
  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`;
  }
  return /^\d{2}:\d{2}:\d{2}$/.test(normalized) ? normalized : '';
}

function splitDateTime(value) {
  const text = clean(value);
  if (!text) {
    return { date: '', time: '' };
  }
  const parts = text.split('T');
  const date = normalizeDate(parts[0]);
  const timeSource = parts.length > 1 ? parts[1] : '';
  const time = normalizeTime(timeSource);
  return {
    date,
    time: time ? time.slice(0, 5) : ''
  };
}

function buildDateTime(date, time) {
  const normalizedDate = normalizeDate(date);
  const normalizedTime = normalizeTime(time);
  return normalizedDate && normalizedTime ? `${normalizedDate}T${normalizedTime}` : '';
}

function parseCoordinate(value, min, max) {
  const cleaned = clean(value);
  if (!cleaned) {
    return null;
  }
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

// What wx.chooseLocation returns, as a form patch. Its coordinates are GCJ-02, like every stored moment.
// A picked place fills the name and address; a blank one (a dropped pin) keeps what was typed.
function mapPickedLocation(form, picked) {
  const source = form || {};
  const result = picked || {};
  const longitude = parseCoordinate(result.longitude, -180, 180);
  const latitude = parseCoordinate(result.latitude, -90, 90);
  if (longitude === null || latitude === null) {
    return null;
  }
  return {
    locationName: clean(result.name).slice(0, 30) || clean(source.locationName),
    address: clean(result.address).slice(0, 80) || clean(source.address),
    longitude: longitude.toFixed(6),
    latitude: latitude.toFixed(6)
  };
}

// Search results as the place sheet lists them; ones without a usable point are dropped.
function mapPlaceResults(response) {
  const items = Array.isArray(response && response.items) ? response.items : [];
  return items
    .filter((item) => item && parseCoordinate(item.latitude, -90, 90) !== null && parseCoordinate(item.longitude, -180, 180) !== null)
    .map((item, index) => ({
      key: `${index}-${item.latitude}-${item.longitude}`,
      name: clean(item.name) || '未命名地点',
      address: clean(item.address),
      latitude: Number(item.latitude),
      longitude: Number(item.longitude)
    }));
}

function normalizeImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls)) {
    return [];
  }
  return Array.from(new Set(imageUrls.map(clean).filter(Boolean))).slice(0, MAX_STORY_IMAGES);
}

function createInitialStoryForm(now) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return {
    title: '',
    content: '',
    eventDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    eventTime: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    endDate: '',
    endTime: '',
    locationName: '',
    address: '',
    longitude: '',
    latitude: '',
    category: 'daily'
  };
}

function mapStoryEditCategories(activeCategory) {
  const current = isValidCategory(activeCategory) ? activeCategory : 'daily';
  return STORY_CATEGORIES.map((item) => ({
    ...item,
    active: item.value === current
  }));
}

function buildStoryPayload(form, imageUrls) {
  const source = form || {};
  const title = clean(source.title);
  const eventTime = buildDateTime(source.eventDate || source.startDate, source.eventTime || source.startTime);
  const locationName = clean(source.locationName);
  const longitude = parseCoordinate(source.longitude, -180, 180);
  const latitude = parseCoordinate(source.latitude, -90, 90);
  const category = clean(source.category);
  const hasEndDate = Boolean(clean(source.endDate));
  const hasEndTime = Boolean(clean(source.endTime));
  const endTime = hasEndDate || hasEndTime ? buildDateTime(source.endDate, source.endTime) : null;
  const images = normalizeImageUrls(imageUrls);

  if (!title) {
    return { valid: false, message: '请输入标题' };
  }
  if (!eventTime) {
    return { valid: false, message: '请选择开始时间' };
  }
  if (hasEndDate !== hasEndTime || endTime === '') {
    return { valid: false, message: '请完整选择结束时间' };
  }
  if (!locationName) {
    return { valid: false, message: '请输入地点名称' };
  }
  if (longitude === null || latitude === null) {
    return { valid: false, message: '请在地图上选择地点' };
  }
  if (!isValidCategory(category)) {
    return { valid: false, message: '请选择正确分类' };
  }
  if (Array.isArray(imageUrls) && imageUrls.map(clean).filter(Boolean).length > MAX_STORY_IMAGES) {
    return { valid: false, message: '最多上传 3 张图片' };
  }

  return {
    valid: true,
    payload: {
      title,
      content: clean(source.content),
      eventTime,
      endTime,
      locationName,
      address: clean(source.address),
      longitude,
      latitude,
      category,
      images
    }
  };
}

function storyDraftFields(form) {
  const eventTime = buildDateTime(form.eventDate, form.eventTime);
  const endTime = buildDateTime(form.endDate, form.endTime);
  const longitude = parseCoordinate(form.longitude, -180, 180);
  const latitude = parseCoordinate(form.latitude, -90, 90);
  return {
    title: form.title, content: form.content,
    ...(eventTime ? { eventTime } : {}), ...(endTime ? { endTime } : {}),
    locationName: form.locationName, address: form.address,
    ...(longitude !== null ? { longitude } : {}), ...(latitude !== null ? { latitude } : {}), category: form.category
  };
}

function createLocalImage(path) {
  const imagePath = clean(path);
  return {
    id: imagePath,
    path: imagePath,
    url: '',
    status: 'local',
    progress: 0,
    message: ''
  };
}

function createRemoteImage(url) {
  const imageUrl = clean(url);
  return {
    id: imageUrl,
    path: imageUrl,
    url: imageUrl,
    status: 'uploaded',
    progress: 100,
    message: ''
  };
}

function mapStoryEditForm(response) {
  const moment = response || {};
  const initial = createInitialStoryForm();
  const start = splitDateTime(moment.eventTime);
  const end = splitDateTime(moment.endTime);
  const category = isValidCategory(moment.category) ? moment.category : 'daily';

  return {
    form: {
      title: clean(moment.title),
      content: clean(moment.content),
      eventDate: start.date || initial.eventDate,
      eventTime: start.time || initial.eventTime,
      endDate: end.date,
      endTime: end.time,
      locationName: clean(moment.locationName),
      address: clean(moment.address),
      longitude: moment.longitude === undefined || moment.longitude === null ? '' : String(moment.longitude),
      latitude: moment.latitude === undefined || moment.latitude === null ? '' : String(moment.latitude),
      category
    },
    images: normalizeImageUrls(moment.images).map(createRemoteImage)
  };
}

function appendSelectedImages(currentImages, selectedFiles) {
  return appendPickedImages(currentImages, selectedFiles, MAX_STORY_IMAGES, createLocalImage);
}

module.exports = {
  MAX_STORY_IMAGES,
  storyDraftFields,
  appendSelectedImages,
  buildStoryPayload,
  createInitialStoryForm,
  mapPickedLocation,
  mapPlaceResults,
  mapStoryEditForm,
  mapStoryEditCategories
};
