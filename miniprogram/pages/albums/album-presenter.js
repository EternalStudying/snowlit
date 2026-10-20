const { formatDate, formatMonthDay } = require('../../utils/date');
const { resolveMediaUrl } = require('../../utils/media');

const STAT_ICONS = {
  photos: '../../assets/icons/home/image.svg',
  views: '../../assets/icons/albums/eye.svg',
  likes: '../../assets/icons/albums/heart.svg'
};

function compact(values) {
  return values.filter((value) => value !== undefined && value !== null && value !== '');
}

function dotDate(value) {
  return formatDate(value).replace(/-/g, '.');
}

function photoUrl(photo) {
  if (!photo) {
    return '';
  }
  return resolveMediaUrl(photo.previewUrl);
}

function mapStats(album) {
  return [
    { type: 'photos', icon: STAT_ICONS.photos, value: String(album && album.photoCount ? album.photoCount : 0) },
    { type: 'views', icon: STAT_ICONS.views, value: String(album && album.viewCount ? album.viewCount : 0) },
    {
      type: 'likes',
      icon: STAT_ICONS.likes,
      value: String(album && album.likeCount ? album.likeCount : 0),
      active: Boolean(album && album.likedToday)
    }
  ];
}

function mapAlbumRow(album) {
  const previewPhotos = (album.previewPhotos || [])
    .map(photoUrl)
    .filter(Boolean);
  const locked = Boolean(album.locked || album.visibility === 'private');
  const layout = locked ? 'locked' : 'cover';
  const cover = resolveMediaUrl(album.coverPhotoUrl) || previewPhotos[0] || '';

  return {
    id: album.id,
    title: album.title || '未命名相册',
    description: album.description || (locked ? '已锁定' : '还没有描述'),
    meta: compact([
      formatMonthDay(album.eventDate) || '--.--',
      album.location || '地点未记录',
      album.authorName || 'Snowlit'
    ]).join(' · '),
    stats: mapStats(album),
    likedToday: Boolean(album.likedToday),
    pinned: Boolean(album.pinned),
    locked,
    layout,
    isStrip: false,
    cover
  };
}

function mapAlbumPage(page) {
  const safePage = page || {};
  return {
    items: (safePage.items || []).map(mapAlbumRow),
    totalText: `共 ${safePage.total || 0} 本相册`,
    page: safePage.page || 1,
    size: safePage.size || 5,
    hasMore: Boolean(safePage.hasMore),
    canManage: Boolean(safePage.canManage)
  };
}

function mapPhoto(photo) {
  const meta = compact([
    formatMonthDay(photo.takenAt),
    photo.location || ''
  ]).join(' · ');

  return {
    id: photo.id,
    // UI-local field: pages still preview with `url`, mapped from backend `previewUrl`.
    url: resolveMediaUrl(photo.previewUrl),
    previewUrl: resolveMediaUrl(photo.previewUrl),
    originalUrl: resolveMediaUrl(photo.originalUrl),
    caption: photo.caption || '未命名照片',
    meta
  };
}

function mapAlbumDetail(response) {
  const album = (response && response.album) || {};
  const photos = ((response && response.photos) || []).map(mapPhoto);
  const coverPhotos = ((response && response.photos) || [])
    .map(photoUrl)
    .filter(Boolean)
    .slice(0, 3);
  const cover = resolveMediaUrl(album.coverPhotoUrl) || coverPhotos[0] || '';
  const badges = [album.visibility === 'private' || album.locked ? '私密' : '公开'];
  if (album.pinned) {
    badges.push('置顶');
  }

  return {
    id: album.id,
    title: album.title || '未命名相册',
    description: album.description || '还没有描述',
    badges,
    eventDate: dotDate(album.eventDate) || '未记录',
    location: album.location || '地点未记录',
    authorName: album.authorName || 'Snowlit',
    stats: mapStats(album).map((item, index) => ({
      ...item,
      position: index === 0 ? 'left' : (index === 2 ? 'right' : 'center')
    })),
    likedToday: Boolean(album.likedToday),
    cover,
    hasCover: Boolean(cover),
    photos,
    photosCountText: `${album.photoCount || photos.length || 0} 张`,
    hasPhotos: photos.length > 0
  };
}

function updateStat(album, type, value) {
  return {
    ...album,
    stats: (album.stats || []).map((stat) => (
      stat.type === type ? { ...stat, value: String(value || 0) } : stat
    ))
  };
}

function updateAlbumViewCount(album, viewCount) {
  return updateStat(album, 'views', viewCount);
}

function updateAlbumLikeCount(album, likeCount, likedTodayValue) {
  const likedToday = likedTodayValue === undefined ? Boolean(album && album.likedToday) : Boolean(likedTodayValue);
  return {
    ...album,
    likedToday,
    stats: (album.stats || []).map((stat) => (
      stat.type === 'likes'
        ? { ...stat, value: String(likeCount || 0), active: likedToday }
        : stat
    ))
  };
}

module.exports = {
  mapAlbumDetail,
  mapAlbumPage,
  updateAlbumLikeCount,
  updateAlbumViewCount
};
