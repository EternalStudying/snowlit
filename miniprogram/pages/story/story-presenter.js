const { formatDate, formatDateTime, formatMonthDay, toDate } = require('../../utils/date');

const FILTERS = [
  { label: '全部', value: 'all' },
  { label: '日常', value: 'daily' },
  { label: '约会', value: 'date' },
  { label: '旅行', value: 'travel' },
  { label: '纪念', value: 'anniversary' },
  { label: '惊喜', value: 'surprise' }
];

const CATEGORY_LABELS = {
  daily: '日常',
  date: '约会',
  travel: '旅行',
  anniversary: '纪念',
  surprise: '惊喜'
};

const MAP_PIN_ICON = '/assets/icons/story/map-pin-filled.png';
const STORY_MARKER_SIZE = 26;
const STORY_CLUSTER_SIZE = 40;
const EMPTY_STORY_MAP_SCALE = 3;
const DEFAULT_STORY_MAP_CENTER = {
  // This is an empty map viewport, never a saved person or moment location.
  latitude: 0,
  longitude: 0
};

function firstText() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function isFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number);
}

function isFiniteCoordinate(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string' && !value.trim()) {
    return false;
  }
  return isFiniteNumber(value);
}

function momentKey(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function isSameMomentId(left, right) {
  const leftKey = momentKey(left);
  return Boolean(leftKey) && leftKey === momentKey(right);
}

function timeText(value) {
  const date = toDate(value);
  if (!date) {
    return '--:--';
  }
  return formatDateTime(date).slice(-5);
}

function dotDate(value) {
  return formatDate(value).replace(/-/g, '.');
}

function dotDateTime(value) {
  return formatDateTime(value).replace(/-/g, '.');
}

function normalizeImages(images) {
  return Array.isArray(images) ? images.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function splitContent(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : ['还没有记录文字。'];
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || '点滴';
}

function mapStoryFilters(activeFilter) {
  const active = FILTERS.some((filter) => filter.value === activeFilter) ? activeFilter : 'all';
  return FILTERS.map((filter) => ({
    ...filter,
    active: filter.value === active
  }));
}

function momentDate(item) {
  return toDate(item && item.eventTime) || toDate(item && item.createdAt);
}

function hasCoordinates(item) {
  return Boolean(item) && isFiniteCoordinate(item.latitude) && isFiniteCoordinate(item.longitude);
}

// A drop as the list and the map card show it. Only real photos: no stand-in images.
function mapStoryMoment(item, index) {
  const moment = item || {};
  const images = normalizeImages(moment.images);
  const contentLines = splitContent(moment.content);
  const date = momentDate(moment);
  return {
    id: moment.id || `moment-${index}`,
    month: date ? formatDate(date).slice(0, 7) : '',
    date: date ? formatMonthDay(formatDate(date)) : '--.--',
    title: firstText(moment.title, '未命名点滴'),
    locationName: firstText(moment.locationName, moment.address),
    categoryLabel: categoryLabel(moment.category),
    time: timeText(moment.eventTime),
    summary: contentLines[0] === '还没有记录文字。' ? '' : contentLines[0],
    image: images[0] || '',
    placed: hasCoordinates(moment)
  };
}

// Newest first, grouped by month. Drops without any date go last, under "未注明日期".
function mapStoryTimeline(items) {
  const moments = (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index, time: momentDate(item) }))
    .sort((a, b) => {
      if (!a.time || !b.time) {
        return a.time ? -1 : (b.time ? 1 : a.index - b.index);
      }
      return b.time.getTime() - a.time.getTime() || a.index - b.index;
    })
    .map(({ item, index }) => mapStoryMoment(item, index));

  const sections = [];
  moments.forEach((moment) => {
    const key = moment.month || 'undated';
    let section = sections[sections.length - 1];
    if (!section || section.month !== key) {
      section = {
        month: key,
        anchorId: `month-${key}`,
        yearText: moment.month ? moment.month.slice(0, 4) : '',
        monthText: moment.month ? moment.month.slice(5, 7) : '未注明日期',
        dated: Boolean(moment.month),
        moments: []
      };
      sections.push(section);
    }
    section.moments.push(moment);
  });
  sections.forEach((section) => {
    section.countText = `${section.moments.length} 个`;
  });
  return sections;
}

// Markers for MapContext.addMarkers. joinCluster hands clustering to the native map.
function mapStoryMarkers(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => hasCoordinates(item))
    .map(({ item, index }) => {
      const id = Number(item.id);
      return {
        id: Number.isInteger(id) && id > 0 ? id : index + 1,
        momentId: item.id || `moment-${index}`,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        iconPath: MAP_PIN_ICON,
        width: STORY_MARKER_SIZE,
        height: STORY_MARKER_SIZE,
        anchor: { x: 0.5, y: 1 },
        joinCluster: true
      };
    });
}

// The bubble the native map draws for a cluster: an ink circle with the count, in Snowlit's palette.
function mapClusterMarker(cluster) {
  const count = Array.isArray(cluster && cluster.markerIds) ? cluster.markerIds.length : 0;
  const half = STORY_CLUSTER_SIZE / 2;
  return {
    ...cluster.center,
    clusterId: cluster.clusterId,
    iconPath: MAP_PIN_ICON,
    width: 1,
    height: 1,
    joinCluster: true,
    label: {
      content: String(count),
      color: '#ffffff',
      fontSize: 14,
      width: STORY_CLUSTER_SIZE,
      height: STORY_CLUSTER_SIZE,
      borderRadius: half,
      bgColor: '#1d2433',
      textAlign: 'center',
      anchorX: -half,
      anchorY: -half
    }
  };
}

function mapStoryPage(response) {
  const items = Array.isArray(response && response.items) ? response.items : [];
  const markers = mapStoryMarkers(items);
  const sections = mapStoryTimeline(items);
  return {
    sections,
    months: sections.filter((section) => section.dated).flatMap((section) => section.moments.map(() => section.month)),
    markers,
    mapCenter: markers.length ? { latitude: markers[0].latitude, longitude: markers[0].longitude } : DEFAULT_STORY_MAP_CENTER,
    mapScale: markers.length ? 10 : EMPTY_STORY_MAP_SCALE,
    mapIncludePoints: markers.map((marker) => ({ latitude: marker.latitude, longitude: marker.longitude })),
    unplacedCount: items.length - markers.length,
    canManage: Boolean(response && response.canManage),
    hasMoments: items.length > 0
  };
}

function findStoryMoment(sections, momentId) {
  for (const section of Array.isArray(sections) ? sections : []) {
    const moment = section.moments.find((item) => isSameMomentId(item.id, momentId));
    if (moment) {
      return moment;
    }
  }
  return null;
}

function formatCoordinate(longitude, latitude) {
  if (!isFiniteCoordinate(longitude) || !isFiniteCoordinate(latitude)) {
    return '暂无坐标';
  }
  return `${Number(longitude).toFixed(3)}, ${Number(latitude).toFixed(3)}`;
}

function formatTimeRange(start, end) {
  const startText = timeText(start);
  const endText = timeText(end);
  if (startText === '--:--') {
    return '待补充';
  }
  return endText === '--:--' ? startText : `${startText} - ${endText}`;
}

function mapStoryDetail(response, currentUser) {
  const moment = response || {};
  const images = normalizeImages(moment.images);

  return {
    id: moment.id || '',
    canManage: Boolean(currentUser && currentUser.canManage),
    title: firstText(moment.title, '点滴详情'),
    date: dotDate(moment.eventTime) || '待补充',
    timeRange: formatTimeRange(moment.eventTime, moment.endTime),
    categoryLabel: categoryLabel(moment.category),
    locationName: firstText(moment.locationName, '地点待补充'),
    address: firstText(moment.address, '地址待补充'),
    coordinate: formatCoordinate(moment.longitude, moment.latitude),
    updatedAt: dotDateTime(moment.updatedAt) || '待补充',
    contentLines: splitContent(moment.content),
    images,
    hasImages: images.length > 0,
    photoMain: images[0] || '',
    photoThumbs: images.slice(1, 3).map((url, index) => ({
      index: index + 1,
      url
    }))
  };
}

function buildStoryQuery(activeFilter) {
  const filter = FILTERS.some((item) => item.value === activeFilter) ? activeFilter : 'all';
  return filter === 'all' ? {} : { category: filter };
}

module.exports = {
  buildStoryQuery,
  DEFAULT_STORY_MAP_CENTER,
  EMPTY_STORY_MAP_SCALE,
  findStoryMoment,
  mapClusterMarker,
  mapStoryDetail,
  mapStoryFilters,
  mapStoryMarkers,
  mapStoryPage,
  mapStoryTimeline
};
