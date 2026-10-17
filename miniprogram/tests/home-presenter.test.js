const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildHomeLocationPayload,
  mapAlbums,
  mapHomeData,
  mapStoryMoments,
  mapUpdateNotice,
  mapWishStats
} = require('../pages/index/home-presenter');

function runHomeDataMappingTest() {
  const result = mapHomeData({
    couple: {
      boyfriendName: '伴侣 A',
      girlfriendName: '伴侣 B',
      togetherDays: 1432
    },
    dailyNote: {
      sentence: '今天适合把喜欢说得更认真一点。',
      activityHint: '分享晚风'
    },
    personStatuses: [
      {
        city: '示例城市',
        weather: '多云',
        temperature: 25.6,
        note: '轻风'
      }
    ]
  });

  assert.deepEqual(result.couple, {
    togetherDays: 1432,
    boyfriendName: '伴侣 A',
    girlfriendName: '伴侣 B'
  });
  assert.equal(result.greetingSubtitle, '今天适合把喜欢说得更认真一点。');
  assert.deepEqual(result.weather, {
    temperatureText: '26°',
    name: '多云',
    place: '示例城市 · 轻风'
  });
}

function runStoryMomentMappingTest() {
  const result = mapStoryMoments({
    items: [
      {
        id: 10,
        title: '雨后的散步',
        eventTime: '2026-05-25T20:10:00',
        locationName: '示例公园',
        images: ['https://snowlit.example.com/media/story/10.webp']
      },
      {
        id: 9,
        title: '晚风和路灯',
        eventTime: '2026-05-18T19:20:00',
        address: '家附近',
        images: []
      },
      {
        id: 8,
        title: '不应展示第三条',
        eventTime: '2026-05-01T12:00:00'
      }
    ]
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    id: 10,
    date: '05.25',
    title: '雨后的散步',
    meta: '示例公园 · 1 张照片',
    image: 'https://snowlit.example.com/media/story/10.webp'
  });
  assert.equal(result[1].date, '05.18');
  assert.equal(result[1].meta, '家附近 · 0 张照片');
}

function runAlbumMappingTest() {
  const result = mapAlbums({
    items: [
      {
        id: 21,
        title: '春天的照片',
        photoCount: 42,
        coverPhotoUrl: 'https://snowlit.example.com/media/album/21/cover.webp',
        locked: false
      },
      {
        id: 22,
        title: '私密相册',
        photoCount: 28,
        locked: true,
        previewPhotos: [
          {
            previewUrl: 'https://snowlit.example.com/media/album/22/preview.webp'
          }
        ]
      },
      {
        id: 23,
        title: '不应展示第三条',
        photoCount: 1
      }
    ]
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    id: 21,
    title: '春天的照片',
    countText: '42 张照片',
    cover: 'https://snowlit.example.com/media/album/21/cover.webp',
    locked: false,
    statusText: ''
  });
  assert.equal(result[1].locked, true);
  assert.equal(result[1].statusText, '私密');
  assert.equal(result[1].cover, 'https://snowlit.example.com/media/album/22/preview.webp');
}

function runUpdateNoticeMappingTest() {
  assert.deepEqual(mapUpdateNotice({ shouldShow: false, notice: { title: '保留首页公告' } }), {
    title: '保留首页公告',
    version: '',
    items: []
  });

  const result = mapUpdateNotice({
    shouldShow: true,
    notice: {
      title: 'v2.1.0 完成啦',
      version: '2.1.0',
      items: ['优化了点滴地图体验', '修复了一些已知问题', '不应展示第三条']
    }
  });

  assert.deepEqual(result, {
    title: 'v2.1.0 完成啦',
    version: '2.1.0',
    items: ['优化了点滴地图体验', '修复了一些已知问题']
  });
}

function runWishStatsMappingTest() {
  const result = mapWishStats({
    wantGoCount: 6,
    wantDoCount: 4,
    completedCount: 12,
    canManage: true
  });

  assert.deepEqual(result, [
    {
      label: '想去',
      count: 6,
      progress: 50,
      icon: '../../assets/icons/home/map-pin.svg'
    },
    {
      label: '想做',
      count: 4,
      progress: 33,
      icon: '../../assets/icons/home/star.svg'
    },
    {
      label: '已完成',
      count: 12,
      progress: 100,
      icon: '../../assets/icons/home/circle-check.svg'
    }
  ]);
}

function runHomeLocationPayloadTest() {
  const payload = buildHomeLocationPayload(
    { latitude: 12.0603, longitude: 18.7969 },
    {
      city: '示例城市',
      district: '示例街区',
      province: '示例地区',
      country: '示例国家',
      rawWeather: '多云',
      weatherState: 'cloudy',
      temperature: 25.6
    }
  );

  assert.deepEqual(payload, {
    latitude: 12.0603,
    longitude: 18.7969,
    city: '示例城市',
    district: '示例街区',
    province: '示例地区',
    country: '示例国家',
    weather: '多云',
    temperature: 25.6
  });
}

runHomeDataMappingTest();
runStoryMomentMappingTest();
runAlbumMappingTest();
runUpdateNoticeMappingTest();
runWishStatsMappingTest();
runHomeLocationPayloadTest();

const indexWxml = fs.readFileSync(path.join(__dirname, '../pages/index/index.wxml'), 'utf8');
assert.equal(/wx:else\s+[^>]*wx:for/.test(indexWxml), false, 'wx:else must not share a node with wx:for');

const projectPrivateConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.private.config.json'), 'utf8'));
assert.notEqual(
  projectPrivateConfig.setting && projectPrivateConfig.setting.ignoreDevUnusedFiles,
  true,
  'ignoreDevUnusedFiles should stay disabled so newly added service modules are included by devtools'
);

const weatherServiceJs = fs.readFileSync(path.join(__dirname, '../services/weather.js'), 'utf8');
assert.equal(
  weatherServiceJs.includes('skipAuth: true'),
  false,
  'weather service must send the logged-in token because the backend weather endpoint is protected'
);

console.log('home-presenter tests passed');
