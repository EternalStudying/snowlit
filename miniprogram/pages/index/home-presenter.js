const { formatMonthDay } = require('../../utils/date');

const FALLBACK_COUPLE = {
  togetherDays: '--',
  boyfriendName: '伴侣 A',
  girlfriendName: '伴侣 B'
};

const FALLBACK_WEATHER = {
  temperatureText: '--°',
  name: '天气待更新',
  place: '位置待更新'
};

const FALLBACK_STORY_IMAGES = [
  '../../assets/story/moment-cafe.png',
  '../../assets/home/moment-evening.png'
];

const FALLBACK_ALBUM_COVER = '../../assets/home/album-spring.png';

const WISH_ROWS = [
  {
    key: 'wantGoCount',
    label: '想去',
    icon: '../../assets/icons/home/map-pin.svg'
  },
  {
    key: 'wantDoCount',
    label: '想做',
    icon: '../../assets/icons/home/star.svg'
  },
  {
    key: 'completedCount',
    label: '已完成',
    icon: '../../assets/icons/home/circle-check.svg'
  }
];

function isFiniteNumber(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    return false;
  }
  const number = Number(value);
  return Number.isFinite(number);
}

function firstText() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function weatherText(value) {
  const text = firstText(value);
  return /^(unknown|未知)$/i.test(text) ? '' : text;
}

function locationText(status) {
  const location = status || {};
  return firstText(...['city', 'district', 'province', 'country'].map((key) => weatherText(location[key])));
}

function pickWeatherStatus(statuses) {
  const list = Array.isArray(statuses) ? statuses : [];
  return list.find((item) => item && (weatherText(item.weather) || isFiniteNumber(item.temperature) || locationText(item))) || null;
}

function mapWeather(status, dailyNote) {
  if (!status) {
    return { ...FALLBACK_WEATHER };
  }

  const note = firstText(status.note, dailyNote && dailyNote.activityHint, '轻风');
  const place = locationText(status);
  return {
    temperatureText: isFiniteNumber(status.temperature) ? `${Math.round(Number(status.temperature))}°` : FALLBACK_WEATHER.temperatureText,
    name: firstText(weatherText(status.weather), FALLBACK_WEATHER.name),
    place: place ? `${place} · ${note}` : FALLBACK_WEATHER.place
  };
}

function mapHomeData(homeData) {
  const couple = (homeData && homeData.couple) || {};
  const dailyNote = (homeData && homeData.dailyNote) || {};
  const weatherStatus = pickWeatherStatus(homeData && homeData.personStatuses);

  return {
    greetingSubtitle: firstText(dailyNote.sentence, '岁月温柔，慢慢收好'),
    couple: {
      togetherDays: isFiniteNumber(couple.togetherDays) ? Number(couple.togetherDays) : FALLBACK_COUPLE.togetherDays,
      boyfriendName: firstText(couple.boyfriendName, FALLBACK_COUPLE.boyfriendName),
      girlfriendName: firstText(couple.girlfriendName, FALLBACK_COUPLE.girlfriendName)
    },
    weather: mapWeather(weatherStatus, dailyNote)
  };
}

function mapStoryMoments(response) {
  const items = Array.isArray(response && response.items) ? response.items : [];
  return items.slice(0, 2).map((item, index) => {
    const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    const location = firstText(item.locationName, item.address, '地点待补充');

    return {
      id: item.id || `moment-${index}`,
      date: formatMonthDay(item.eventTime || item.createdAt) || '--.--',
      title: firstText(item.title, '未命名点滴'),
      meta: `${location} · ${images.length} 张照片`,
      image: images[0] || FALLBACK_STORY_IMAGES[index % FALLBACK_STORY_IMAGES.length]
    };
  });
}

function pickAlbumCover(album) {
  if (!album) {
    return '';
  }
  if (album.coverPhotoUrl) {
    return album.coverPhotoUrl;
  }

  const previews = Array.isArray(album.previewPhotos) ? album.previewPhotos : [];
  const firstPreview = previews.find((item) => item && item.previewUrl);
  return firstPreview ? firstText(firstPreview.previewUrl) : '';
}

function mapAlbums(response) {
  const items = Array.isArray(response && response.items) ? response.items : [];
  return items.slice(0, 2).map((album, index) => {
    const locked = Boolean(album.locked);
    return {
      id: album.id || `album-${index}`,
      title: firstText(album.title, '未命名相册'),
      countText: `${isFiniteNumber(album.photoCount) ? Number(album.photoCount) : 0} 张照片`,
      cover: pickAlbumCover(album) || FALLBACK_ALBUM_COVER,
      locked,
      statusText: locked ? '私密' : ''
    };
  });
}

function mapUpdateNotice(response) {
  const notice = response && response.notice;
  if (!notice) {
    return null;
  }

  const items = Array.isArray(notice.items) ? notice.items.filter(Boolean).slice(0, 2) : [];
  return {
    title: firstText(notice.title, '更新公告'),
    version: firstText(notice.version),
    items
  };
}

function normalizeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function mapWishStats(response) {
  const rows = WISH_ROWS.map((row) => ({
    ...row,
    count: normalizeCount(response && response[row.key])
  }));
  const maxCount = Math.max(1, ...rows.map((row) => row.count));

  return rows.map((row) => ({
    label: row.label,
    count: row.count,
    progress: row.count ? Math.round((row.count / maxCount) * 100) : 0,
    icon: row.icon
  }));
}

function buildHomeLocationPayload(location, atmosphere) {
  const latitude = Number(location && location.latitude);
  const longitude = Number(location && location.longitude);
  const temperature = atmosphere && atmosphere.temperature;

  return {
    latitude,
    longitude,
    city: weatherText(atmosphere && atmosphere.city),
    district: weatherText(atmosphere && atmosphere.district),
    province: weatherText(atmosphere && atmosphere.province),
    country: weatherText(atmosphere && atmosphere.country),
    weather: firstText(weatherText(atmosphere && atmosphere.rawWeather),
      atmosphere && atmosphere.weatherVariant !== 'unknown' ? weatherText(atmosphere && atmosphere.weatherState) : '') || null,
    temperature: isFiniteNumber(temperature) ? Number(temperature) : null
  };
}

module.exports = {
  buildHomeLocationPayload,
  mapAlbums,
  mapHomeData,
  mapStoryMoments,
  mapUpdateNotice,
  mapWishStats
};
