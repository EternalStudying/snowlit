const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildHomeLocationPayload, mapHomeData } = require('../pages/index/home-presenter');
const { mapDiaryDetail } = require('../pages/diary/diary-presenter');
const { mapStoryDetail, mapStoryPage } = require('../pages/story/story-presenter');
const { mapWishDetail } = require('../pages/wishes/wish-presenter');

test('a fresh home uses generic people and no invented relationship date or location', () => {
  const result = mapHomeData();
  assert.deepEqual(result.couple, {
    togetherDays: '--', boyfriendName: '伴侣 A', girlfriendName: '伴侣 B'
  });
  assert.equal(result.weather.place, '位置待更新');
});

test('the empty story map is a world viewport with no location markers', () => {
  for (const items of [[], [{ id: 1, latitude: null, longitude: null }]]) {
    const result = mapStoryPage({ items });
    assert.deepEqual(result.mapCenter, { latitude: 0, longitude: 0 });
    assert.equal(result.mapScale, 3);
    assert.deepEqual(result.markers, []);
    assert.deepEqual(result.mapIncludePoints, []);
  }
});

test('cleared location and temperature fields stay empty rather than becoming zero', () => {
  for (const missing of [null, undefined, '', ' ']) {
    assert.equal(mapDiaryDetail({ latitude: missing, longitude: missing, temperature: missing }).coordinate, '--');
    assert.equal(mapDiaryDetail({ temperature: missing }).weatherText, '--');
    assert.equal(mapStoryDetail({ latitude: missing, longitude: missing }).coordinate, '暂无坐标');
    assert.equal(mapWishDetail({ latitude: missing, longitude: missing }).coordinate, '暂无坐标');
  }
  assert.equal(mapDiaryDetail({ latitude: 0, longitude: 0, temperature: 0 }).coordinate, '0.000 / 0.000');
  assert.equal(mapDiaryDetail({ temperature: 0 }).weatherText, '0°C');
  assert.equal(mapStoryDetail({ latitude: 0, longitude: 0 }).coordinate, '0.000, 0.000');
  assert.equal(mapWishDetail({ latitude: 0, longitude: 0 }).coordinate, '0.000 / 0.000');
});

test('location payload does not promote placeholders or atmospheric fallback into actual data', () => {
  const result = buildHomeLocationPayload({ latitude: 10, longitude: 20 }, {
    city: 'unknown', district: '未知', province: '', country: 'Example Country',
    rawWeather: '', weatherState: 'cloudy', weatherVariant: 'unknown', temperature: null
  });
  assert.deepEqual(result, {
    latitude: 10, longitude: 20, city: '', district: '', province: '', country: 'Example Country',
    weather: null, temperature: null
  });
  assert.match(mapHomeData({ personStatuses: [{ country: 'Example Country' }] }).weather.place, /^Example Country/);
});

// Daily suggestions must not masquerade as measured weather or a resolved place.
{
  const { mapHomeData } = require('../pages/index/home-presenter');
  const assert = require('node:assert/strict');
  const result = mapHomeData({
    personStatuses: [{city: '', district: '', province: '', country: '', weather: '', temperature: null}],
    dailyNote: {weatherHint: '散步建议', activityHint: '相见计划'}
  });
  assert.equal(result.weather.name, '天气待更新');
  assert.equal(result.weather.place, '位置待更新');
}
