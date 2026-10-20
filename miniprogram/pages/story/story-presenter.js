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

const FALLBACK_IMAGES = [
  '../../assets/story/moment-cafe.png',
  '../../assets/story/moment-evening.png',
  '../../assets/home/album-spring.png'
];

const MAP_PIN_ICON = '/assets/icons/story/map-pin-filled.png';
const MAP_CLUSTER_ICON = '/assets/icons/story/map-cluster.png';
const STORY_MARKER_SIZE = 22;
const STORY_CLUSTER_MARKER_SIZE = 30;
const STORY_CLUSTER_BASE_DISTANCE_METERS = 500;
const STORY_CLUSTER_MARKER_ID_BASE = 1000000000;
const DEFAULT_STORY_MAP_SCALE = 10;
const EMPTY_STORY_MAP_SCALE = 3;
const STORY_CLUSTER_EXPANDED_SCALE = 16;
const STORY_MAP_TOP_OFFSET_RPX = 160;
const STORY_FILTER_HEIGHT_RPX = 76;
const STORY_MIN_SHEET_HEIGHT_RPX = 0;
const STORY_MIN_MAP_HEIGHT_RPX = 0;
const STORY_COLLAPSE_SCROLL_RPX = 760;
const STORY_SNAP_KEYS = ['fullMap', 'largeMap', 'balanced', 'largeList', 'fullList'];
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

function roundCoordinate(value) {
  return Math.round(Number(value) * 1000000) / 1000000;
}

function degreesToRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function distanceBetweenMarkers(left, right) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }
  const earthRadiusMeters = 6371000;
  const leftLatitude = degreesToRadians(left.latitude);
  const rightLatitude = degreesToRadians(right.latitude);
  const deltaLatitude = degreesToRadians(right.latitude - left.latitude);
  const deltaLongitude = degreesToRadians(right.longitude - left.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * (Math.sin(deltaLongitude / 2) ** 2);
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeViewportHeightRpx(value) {
  const height = Number(value);
  return Number.isFinite(height) && height > 0 ? height : 1334;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSheetPanOffset(value) {
  return clamp(Number(value) || 0, 0, STORY_COLLAPSE_SCROLL_RPX);
}

function normalizeStoryMapScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) ? clamp(scale, 3, 20) : DEFAULT_STORY_MAP_SCALE;
}

function clusterDistanceForMapScale(scale) {
  return Math.max(
    0.5,
    STORY_CLUSTER_BASE_DISTANCE_METERS * (2 ** (DEFAULT_STORY_MAP_SCALE - normalizeStoryMapScale(scale)))
  );
}

function createStoryMapSnapPoints(viewportHeightRpx) {
  const viewportHeight = normalizeViewportHeightRpx(viewportHeightRpx);
  const maxMapHeight = Math.max(
    520,
    Math.round(viewportHeight - STORY_MAP_TOP_OFFSET_RPX - STORY_FILTER_HEIGHT_RPX - STORY_MIN_SHEET_HEIGHT_RPX)
  );
  const minMapHeight = STORY_MIN_MAP_HEIGHT_RPX;
  const total = STORY_SNAP_KEYS.length - 1;

  return STORY_SNAP_KEYS.map((key, index) => {
    const progress = total === 0 ? 0 : index / total;
    return {
      key,
      index,
      scrollTop: Math.round(STORY_COLLAPSE_SCROLL_RPX * progress),
      mapHeightRpx: Math.round(maxMapHeight - ((maxMapHeight - minMapHeight) * progress))
    };
  });
}

function nearestStoryMapSnapIndex(points, mapHeightRpx) {
  const source = Array.isArray(points) && points.length ? points : createStoryMapSnapPoints();
  const target = Number(mapHeightRpx);
  return source.reduce((best, point, index) => {
    const distance = Math.abs(point.mapHeightRpx - target);
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
}

function createStoryMapLayout(viewportHeightRpx, mapHeightRpx, snapIndex, sheetPanOffsetRpx) {
  const viewportHeight = normalizeViewportHeightRpx(viewportHeightRpx);
  const sheetHeight = Math.max(
    STORY_MIN_SHEET_HEIGHT_RPX,
    Math.round(viewportHeight - STORY_MAP_TOP_OFFSET_RPX - STORY_FILTER_HEIGHT_RPX - mapHeightRpx)
  );
  const points = createStoryMapSnapPoints(viewportHeight);
  const index = clamp(Number.isInteger(snapIndex) ? snapIndex : 0, 0, points.length - 1);
  const panOffset = normalizeSheetPanOffset(sheetPanOffsetRpx);

  return {
    mapTopOffsetRpx: STORY_MAP_TOP_OFFSET_RPX,
    mapHeightRpx,
    sheetHeightRpx: sheetHeight,
    mapSnapIndex: index,
    mapSnapKey: points[index].key,
    sheetPanOffsetRpx: panOffset,
    sheetScrollEnabled: panOffset >= STORY_COLLAPSE_SCROLL_RPX
  };
}

function mapStoryLayoutByIndex(viewportHeightRpx, snapIndex) {
  const points = createStoryMapSnapPoints(viewportHeightRpx);
  const index = clamp(Number.isInteger(snapIndex) ? snapIndex : 0, 0, points.length - 1);
  return createStoryMapLayout(viewportHeightRpx, points[index].mapHeightRpx, index, points[index].scrollTop);
}

function mapStoryLayoutByScroll(viewportHeightRpx, scrollTop) {
  const points = createStoryMapSnapPoints(viewportHeightRpx);
  const maxMapHeight = points[0].mapHeightRpx;
  const minMapHeight = points[points.length - 1].mapHeightRpx;
  const normalizedScrollTop = normalizeSheetPanOffset(scrollTop);
  const progress = normalizedScrollTop / STORY_COLLAPSE_SCROLL_RPX;
  const mapHeight = Math.round(maxMapHeight - ((maxMapHeight - minMapHeight) * progress));
  const snapIndex = nearestStoryMapSnapIndex(points, mapHeight);
  return createStoryMapLayout(viewportHeightRpx, mapHeight, snapIndex, normalizedScrollTop);
}

function mapStoryLayoutByDrag(viewportHeightRpx, currentOffsetRpx, deltaYRpx) {
  const nextOffset = normalizeSheetPanOffset(
    normalizeSheetPanOffset(currentOffsetRpx) - (Number(deltaYRpx) || 0)
  );
  return mapStoryLayoutByScroll(viewportHeightRpx, nextOffset);
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

function normalizeYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1970 && year <= 2100 ? year : null;
}

function mapStoryFilters(activeFilter) {
  const active = FILTERS.some((filter) => filter.value === activeFilter) ? activeFilter : 'all';
  return FILTERS.map((filter) => ({
    ...filter,
    active: filter.value === active
  }));
}

function extractYears(responseYears, items) {
  const years = Array.isArray(responseYears) && responseYears.length
    ? responseYears
    : (items || []).map((item) => {
      const date = toDate(item && item.eventTime);
      return date ? date.getFullYear() : null;
    });
  return Array.from(new Set(years.map(normalizeYear).filter(Boolean))).sort((a, b) => b - a);
}

function mapStoryYears(years, activeYear) {
  const current = normalizeYear(activeYear);
  return [
    { label: '全部', value: 'all', active: !current },
    ...extractYears(years, []).map((year) => ({
      label: String(year),
      value: year,
      active: year === current
    }))
  ];
}

function mapStoryMoment(item, index, selectedMomentId) {
  const moment = item || {};
  const images = normalizeImages(moment.images);
  const contentLines = splitContent(moment.content);
  const id = moment.id || `moment-${index}`;

  return {
    id,
    selected: id === selectedMomentId,
    date: formatMonthDay(moment.eventTime || moment.createdAt) || '--.--',
    title: firstText(moment.title, '未命名点滴'),
    locationName: firstText(moment.locationName, moment.address, '地点待补充'),
    category: moment.category || '',
    categoryLabel: categoryLabel(moment.category),
    time: timeText(moment.eventTime),
    summary: contentLines[0] === '还没有记录文字。' ? '' : contentLines[0],
    image: images[0] || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]
  };
}

function mapMarkerCallout(label, active) {
  return {
    content: label,
    color: active ? '#1d2433' : '#555e70',
    fontSize: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: active ? '#1d2433' : '#dce2ea',
    bgColor: '#ffffff',
    padding: 8,
    display: 'ALWAYS',
    textAlign: 'center'
  };
}

function mapClusterCallout(count) {
  return {
    content: `${count}个点滴`,
    color: '#1d2433',
    fontSize: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d2433',
    bgColor: '#ffffff',
    padding: 8,
    display: 'ALWAYS',
    textAlign: 'center'
  };
}

function normalizeMarkerId(item, index) {
  const id = Number(item && item.id);
  return Number.isInteger(id) ? id : index + 1;
}

function markStoryMarkers(markers, selectedMomentId) {
  return (Array.isArray(markers) ? markers : []).map((marker) => {
    const active = marker && marker.cluster
      ? (marker.clusterMomentIds || []).some((id) => isSameMomentId(id, selectedMomentId))
      : isSameMomentId(marker && marker.momentId, selectedMomentId);
    const locationLabel = firstText(marker && marker.locationLabel, marker && marker.title, '点滴');
    return {
      ...marker,
      locationLabel,
      title: locationLabel,
      width: marker && marker.cluster ? STORY_CLUSTER_MARKER_SIZE : STORY_MARKER_SIZE,
      height: marker && marker.cluster ? STORY_CLUSTER_MARKER_SIZE : STORY_MARKER_SIZE,
      active,
      callout: marker && marker.cluster
        ? mapClusterCallout(marker.clusterCount || 0)
        : mapMarkerCallout(locationLabel, active)
    };
  });
}

function mapRawMarkers(items, selectedMomentId) {
  const source = (items || []).filter((item) => (
    item && isFiniteCoordinate(item.longitude) && isFiniteCoordinate(item.latitude)
  ));
  if (!source.length) {
    return [];
  }

  return markStoryMarkers(source.map((item, index) => {
    const label = firstText(item.locationName, item.address, '点滴');
    return {
      id: normalizeMarkerId(item, index),
      momentId: item.id || `moment-${index}`,
      locationLabel: label,
      title: label,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      iconPath: MAP_PIN_ICON
    };
  }), selectedMomentId);
}

function createClusterMarker(group, clusterIndex) {
  const latitude = roundCoordinate(
    group.reduce((total, marker) => total + Number(marker.latitude), 0) / group.length
  );
  const longitude = roundCoordinate(
    group.reduce((total, marker) => total + Number(marker.longitude), 0) / group.length
  );
  const label = `${group.length}个点滴`;

  return {
    id: STORY_CLUSTER_MARKER_ID_BASE + clusterIndex,
    cluster: true,
    clusterCount: group.length,
    clusterMomentIds: group.map((marker) => marker.momentId),
    clusterIncludePoints: mapIncludePoints(group),
    locationLabel: label,
    title: label,
    latitude,
    longitude,
    iconPath: MAP_CLUSTER_ICON
  };
}

function clusterStoryMarkers(markers, selectedMomentId, mapScale) {
  const source = Array.isArray(markers) ? markers : [];
  const threshold = clusterDistanceForMapScale(mapScale);
  const visited = new Set();
  const result = [];

  source.forEach((marker, index) => {
    if (visited.has(index)) {
      return;
    }
    const group = [marker];
    visited.add(index);

    source.forEach((candidate, candidateIndex) => {
      if (visited.has(candidateIndex)) {
        return;
      }
      if (group.some((groupMarker) => distanceBetweenMarkers(groupMarker, candidate) <= threshold)) {
        group.push(candidate);
        visited.add(candidateIndex);
      }
    });

    result.push(group.length > 1 ? createClusterMarker(group, result.length) : marker);
  });

  return markStoryMarkers(result, selectedMomentId);
}

function mapIncludePoints(markers) {
  return (Array.isArray(markers) ? markers : []).map((marker) => ({
    latitude: marker.latitude,
    longitude: marker.longitude
  }));
}

function mapCenter(markers) {
  const source = Array.isArray(markers) ? markers : [];
  const selected = source.find((marker) => marker && marker.active) || source[0];
  if (!selected) {
    return DEFAULT_STORY_MAP_CENTER;
  }
  return {
    latitude: selected.latitude,
    longitude: selected.longitude
  };
}

function mapStoryPage(response, selectedMomentId, activeYear) {
  const items = Array.isArray(response && response.items) ? response.items : [];
  const ids = items.map((item, index) => (item && item.id) || `moment-${index}`);
  const selected = ids.includes(selectedMomentId) ? selectedMomentId : (ids[0] || '');
  const itemYears = extractYears(null, items);
  const years = itemYears.length ? itemYears : extractYears(response && response.years, []);
  const rawMarkers = mapRawMarkers(items, selected);
  const markers = clusterStoryMarkers(rawMarkers, selected, DEFAULT_STORY_MAP_SCALE);

  return {
    moments: items.map((item, index) => mapStoryMoment(item, index, selected)),
    markers,
    rawMarkers,
    mapCenter: mapCenter(markers),
    mapIncludePoints: mapIncludePoints(rawMarkers),
    mapScale: rawMarkers.length ? DEFAULT_STORY_MAP_SCALE : EMPTY_STORY_MAP_SCALE,
    years: mapStoryYears(years, activeYear),
    canManage: Boolean(response && response.canManage),
    selectedMomentId: selected,
    hasMoments: items.length > 0
  };
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

function buildStoryQuery(activeFilter, activeYear) {
  const query = {};
  const filter = FILTERS.some((item) => item.value === activeFilter) ? activeFilter : 'all';
  const year = normalizeYear(activeYear);
  if (filter !== 'all') {
    query.category = filter;
  }
  if (year) {
    query.year = year;
  }
  return query;
}

module.exports = {
  buildStoryQuery,
  clusterStoryMarkers,
  createStoryMapSnapPoints,
  DEFAULT_STORY_MAP_CENTER,
  DEFAULT_STORY_MAP_SCALE,
  EMPTY_STORY_MAP_SCALE,
  mapStoryLayoutByDrag,
  mapStoryLayoutByIndex,
  mapStoryLayoutByScroll,
  markStoryMarkers,
  mapStoryDetail,
  mapStoryFilters,
  mapStoryPage,
  mapStoryYears,
  STORY_CLUSTER_EXPANDED_SCALE
};
