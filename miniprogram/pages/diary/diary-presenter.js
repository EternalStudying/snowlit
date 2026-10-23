const { formatDateTime, formatMonthDay } = require('../../utils/date');
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
// Each load keeps going, month after month, until this many entries match the filter.
const BATCH_ENTRIES = 8;

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

function padMonth(value) {
  return String(value).padStart(2, '0');
}

function normalizeMonth(value) {
  const text = clean(value);
  return MONTH_PATTERN.test(text) ? text : '';
}

function monthCounts(response) {
  const years = Array.isArray(response && response.years) ? response.years : [];
  const counts = {};
  years.forEach((year) => {
    (year && Array.isArray(year.months) ? year.months : []).forEach((item) => {
      const month = normalizeMonth(item && item.month);
      if (month) {
        counts[month] = Math.max(0, Number(item.count) || 0);
      }
    });
  });
  return counts;
}

// The timeline's spine: every month with a visible diary, newest first.
function buildMonthIndex(response) {
  const counts = monthCounts(response);
  return Object.keys(counts)
    .filter((month) => counts[month] > 0)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((month) => ({ month, count: counts[month] }));
}

function buildJumpYears(response, activeMonth) {
  const counts = monthCounts(response);
  // Only years with at least one diary; an empty account comes back as this year, all zeros.
  const years = Array.from(new Set(buildMonthIndex(response).map((item) => item.month.slice(0, 4))));
  return years.map((year) => ({
    year,
    months: Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
      const month = `${year}-${padMonth(index + 1)}`;
      const count = counts[month] || 0;
      return {
        month,
        label: padMonth(index + 1),
        count,
        disabled: count === 0,
        active: month === activeMonth
      };
    })
  }));
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

// One month of the timeline. The heading count is the month's total, so it matches the jump sheet.
function mapTimelineSection(month, items, total, filter, currentRole) {
  const rawItems = Array.isArray(items) ? items : [];
  const entries = filterEntries(rawItems, filter || 'all', currentRole || '').map(mapEntry);
  return {
    month,
    anchorId: `month-${month}`,
    yearText: month.slice(0, 4),
    monthText: month.slice(5, 7),
    total: total || rawItems.length,
    countText: `${total || rawItems.length} 篇`,
    entries,
    rawItems
  };
}

function applyFilter(sections, filter, currentRole) {
  const next = sections.map((section) => mapTimelineSection(
    section.month,
    section.rawItems,
    section.total,
    filter,
    currentRole
  ));
  return {
    sections: next,
    matching: next.reduce((sum, section) => sum + section.entries.length, 0)
  };
}

// The next month to fetch, or '' when the goal is met or the index is exhausted.
// goal is { untilMonth } (jump) or { minEntries } (scroll); progress counts matches since the load began.
function nextMonthToLoad(index, loadedMonths, goal, matchedSinceStart) {
  const loaded = new Set(loadedMonths);
  const next = index.find((item) => !loaded.has(item.month));
  if (!next) {
    return '';
  }
  if (goal && goal.untilMonth) {
    return loaded.has(goal.untilMonth) ? '' : next.month;
  }
  const minEntries = goal && goal.minEntries ? goal.minEntries : BATCH_ENTRIES;
  return matchedSinceStart >= minEntries ? '' : next.month;
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
  BATCH_ENTRIES,
  applyFilter,
  buildJumpYears,
  buildMonthIndex,
  mapDiaryDetail,
  mapTimelineSection,
  nextMonthToLoad
};
