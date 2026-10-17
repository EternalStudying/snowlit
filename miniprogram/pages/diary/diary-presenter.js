const { formatDate, formatDateTime, formatMonthDay, toDate } = require('../../utils/date');
const { parseDiaryMarkdown } = require('../../utils/diary-markdown');

const MOOD_LABELS = {
  happy: '开心',
  miss: '想念',
  calm: '平静',
  wronged: '委屈',
  expecting: '期待',
  tired: '疲惫',
  sweet: '甜蜜',
  secret: '秘密',
  angry: '生气',
  touched: '感动'
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const MONTHS_IN_YEAR = 12;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isFiniteNumber(value) {
  return (typeof value === 'number' || typeof value === 'string')
    && String(value).trim() !== '' && Number.isFinite(Number(value));
}

function formatDotDateTime(value) {
  return formatDateTime(value).replace(/-/g, '.');
}

function visibilityLabel(value) {
  return value === 'private' ? '私密' : '共享';
}

function moodLabel(value) {
  return MOOD_LABELS[value] || clean(value) || '心情';
}

function monthLabel(month) {
  const text = clean(month);
  return text.length >= 7 ? text.slice(5, 7) : '--';
}

function monthTitle(month) {
  return clean(month).replace('-', '.') || '----.--';
}

function padMonth(value) {
  return String(value).padStart(2, '0');
}

function currentMonthValue(now) {
  return formatDate(toDate(now) || new Date()).slice(0, 7);
}

function normalizeMonth(value) {
  const text = clean(value);
  return MONTH_PATTERN.test(text) ? text : '';
}

function collectMonthMeta(response) {
  const years = Array.isArray(response && response.years) ? response.years : [];
  const metaByMonth = {};
  years.forEach((year) => {
    (year.months || []).forEach((month) => {
      const value = normalizeMonth(month && month.month);
      if (value) {
        metaByMonth[value] = {
          count: month.count || 0,
          hasEntries: Boolean(month.hasEntries),
          year: year.year || Number(value.slice(0, 4)) || 0
        };
      }
    });
  });
  return metaByMonth;
}

function buildYearMonths(year, metaByMonth, selectedMonth) {
  return Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
    const value = `${String(year).padStart(4, '0')}-${padMonth(index + 1)}`;
    const meta = metaByMonth[value] || {};
    return {
      value,
      label: monthLabel(value),
      active: value === selectedMonth,
      count: meta.count || 0,
      hasEntries: Boolean(meta.hasEntries)
    };
  });
}

function mapDiaryMonths(response, selectedMonth, options) {
  const metaByMonth = collectMonthMeta(response);
  const selectedCandidate = normalizeMonth(selectedMonth);
  const nextSelectedMonth = selectedCandidate || currentMonthValue(options && options.now);
  const selectedYear = Number(nextSelectedMonth.slice(0, 4));

  return {
    selectedMonth: nextSelectedMonth,
    activeMonthAnchor: nextSelectedMonth ? `month-${nextSelectedMonth}` : '',
    monthTabs: buildYearMonths(selectedYear, metaByMonth, nextSelectedMonth)
  };
}

function authorCount(items) {
  const authors = new Set();
  items.forEach((item) => {
    const key = clean(item.role) || clean(item.authorName);
    if (key) {
      authors.add(key);
    }
  });
  return authors.size;
}

function filterEntries(items, filter, currentRole) {
  if (filter === 'mine') {
    return items.filter((item) => item.role === currentRole);
  }
  if (filter === 'other') {
    return items.filter((item) => item.role && item.role !== currentRole);
  }
  if (filter === 'private') {
    return items.filter((item) => item.visibility === 'private');
  }
  return items;
}

function mapEntry(item) {
  const imageUrls = Array.isArray(item.imageUrls) ? item.imageUrls.filter(Boolean) : [];
  const entryDate = item.entryDate;
  return {
    id: item.id,
    date: formatMonthDay(entryDate) || '--.--',
    visibility: visibilityLabel(item.visibility),
    title: clean(item.title) || '未命名日记',
    summary: clean(item.summary) || '这篇日记没有摘要',
    meta: [
      clean(item.authorName) || 'Snowlit',
      moodLabel(item.moodKey),
      clean(item.weather),
      clean(item.locationName)
    ].filter(Boolean).join(' · '),
    role: item.role || '',
    image: imageUrls[0] || ''
  };
}

function mapDiaryMonth(response, filter, currentRole) {
  const rawItems = Array.isArray(response && response.items) ? response.items : [];
  const visibleItems = filterEntries(rawItems, filter || 'all', currentRole || '');
  const sharedCount = rawItems.filter((item) => item.visibility !== 'private').length;
  const privateCount = rawItems.filter((item) => item.visibility === 'private').length;
  const imageCount = rawItems.filter((item) => Array.isArray(item.imageUrls) && item.imageUrls.length).length;

  return {
    monthTitle: monthTitle(response && response.month),
    monthCaption: `${rawItems.length} 篇日记 · ${authorCount(rawItems)} 位作者`,
    stats: [
      { label: '共享', value: String(sharedCount) },
      { label: '私密', value: String(privateCount) },
      { label: '有照片', value: String(imageCount) }
    ],
    entries: visibleItems.map(mapEntry),
    rawItems
  };
}

function coordinateText(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return '--';
  }
  return `${lat.toFixed(3)} / ${lng.toFixed(3)}`;
}

function mapDiaryDetail(response, currentUser) {
  const item = response || {};
  const entryDate = item.entryDate;
  const photos = Array.isArray(item.imageUrls) ? item.imageUrls.filter(Boolean) : [];
  const contentBlocks = parseDiaryMarkdown(item.contentMarkdown, { imageUrls: photos });
  const contentPhotos = contentBlocks
    .filter((block) => block.type === 'image' && block.url)
    .map((block) => block.url);
  const previewPhotos = Array.from(new Set(photos.concat(contentPhotos)));
  const temperature = Number(item.temperature);
  const weatherParts = [
    clean(item.weather),
    isFiniteNumber(item.temperature) ? `${temperature}°C` : ''
  ].filter(Boolean);
  const placeParts = [
    clean(item.province),
    clean(item.city),
    clean(item.district)
  ].filter(Boolean);
  const locationName = clean(item.locationName);

  return {
    id: item.id,
    brand: 'DIARY',
    title: clean(item.title) || '未命名日记',
    rawDate: clean(entryDate),
    canEdit: Boolean(currentUser && clean(currentUser.coupleRole) && clean(currentUser.coupleRole) === clean(item.role)),
    subtitle: [
      formatMonthDay(entryDate) || '--.--',
      clean(item.authorName) || 'Snowlit',
      visibilityLabel(item.visibility)
    ].filter(Boolean).join(' · '),
    moodText: moodLabel(item.moodKey),
    contentBlocks,
    photos: previewPhotos,
    hasPhotos: previewPhotos.length > 0,
    weatherText: weatherParts.join(' · ') || '--',
    placeText: [placeParts.join(' '), locationName].filter(Boolean).join(' · ') || '--',
    coordinate: coordinateText(item.latitude, item.longitude),
    updatedText: formatDotDateTime(item.updatedAt) || '--'
  };
}

module.exports = {
  mapDiaryDetail,
  mapDiaryMonth,
  mapDiaryMonths
};
