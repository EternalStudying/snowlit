const { formatDate, formatDateTime, formatMonthDay } = require('../../utils/date');

const FALLBACK_DONE_IMAGE = '../../assets/story/moment-cafe.png';
const FALLBACK_PENDING_IMAGE = '../../assets/wishes/pending-placeholder.webp';

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
  return (typeof value === 'number' || typeof value === 'string')
    && String(value).trim() !== '' && Number.isFinite(Number(value));
}

function formatDotDate(value) {
  return formatDate(value).replace(/-/g, '.');
}

function formatDotDateTime(value) {
  return formatDateTime(value).replace(/-/g, '.');
}

function formatCoordinate(latitude, longitude) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return '暂无坐标';
  }
  return `${Number(latitude).toFixed(3)} / ${Number(longitude).toFixed(3)}`;
}

function categoryLabel(category) {
  if (category === 'want_go') {
    return 'WANT TO GO';
  }
  if (category === 'want_do') {
    return 'WANT TO DO';
  }
  return 'WISH';
}

function mapWishPage(response, type) {
  const items = Array.isArray(response && response.items) ? response.items : [];
  const total = Number(response && response.total);
  const mappedItems = items.map((item, index) => {
    const title = firstText(item && item.title, '未命名清单');
    const id = item && item.id ? item.id : `wish-${index}`;

    if (type === 'completed') {
      return {
        id,
        title,
        image: firstText(item && item.imageUrl, FALLBACK_DONE_IMAGE),
        completedDate: formatMonthDay(item && item.completedAt) || '--.--'
      };
    }

    return {
      id,
      title,
      createdDate: formatMonthDay(item && item.createdAt) || '--.--'
    };
  });

  return {
    items: mappedItems,
    totalText: `${Number.isFinite(total) ? total : mappedItems.length} 条`,
    page: Number(response && response.page) || 1,
    hasMore: Boolean(response && response.hasMore),
    canManage: Boolean(response && response.canManage)
  };
}

function mapWishDetail(response, user) {
  const wish = response || {};
  const completed = Boolean(wish.completed);

  return {
    id: wish.id || '',
    title: firstText(wish.title, '未命名清单'),
    description: firstText(wish.description, '暂无描述'),
    category: wish.category || '',
    categoryLabel: categoryLabel(wish.category),
    completed,
    completedLabel: completed ? '已完成' : '未完成',
    statusActionText: completed ? '恢复' : '完成',
    image: completed ? firstText(wish.imageUrl) : firstText(wish.imageUrl, FALLBACK_PENDING_IMAGE),
    expectedDate: formatDotDate(wish.expectedCompletedAt) || '待补充',
    completedDateLabel: completed ? '完成时间' : '预计完成时间',
    locationLabel: completed ? '地点' : '预计地点',
    locationName: firstText(wish.locationName, '地点待补充'),
    coordinate: formatCoordinate(wish.latitude, wish.longitude),
    note: firstText(wish.note, '暂无备注'),
    createdDate: formatDotDate(wish.createdAt) || '待补充',
    completedDate: completed ? (formatDotDate(wish.completedAt) || '待补充') : (formatDotDate(wish.expectedCompletedAt) || '待补充'),
    createdTime: formatDotDateTime(wish.createdAt) || '待补充',
    completedTime: completed ? (formatDotDateTime(wish.completedAt) || '待补充') : '待完成',
    canEdit: Boolean(user && user.canManage)
  };
}

module.exports = {
  mapWishDetail,
  mapWishPage
};
