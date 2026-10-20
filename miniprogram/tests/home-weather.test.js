const assert = require('node:assert/strict');
const path = require('node:path');
const { test, afterEach } = require('node:test');

function createHome({ atmosphere, privacyAgreed = true, locationError = false, confirm = true } = {}) {
  const root = path.resolve(__dirname, '..') + path.sep;
  Object.keys(require.cache).forEach((file) => {
    if (file.startsWith(root) && !file.includes(`${path.sep}tests${path.sep}`)) {
      delete require.cache[file];
    }
  });
  let definition;
  const requests = [];
  const messages = [];
  const locations = [];
  const dialogs = [];
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => [{
    selectComponent(selector) {
      if (selector === '#snowlit-privacy') return { authorize: () => Promise.resolve(privacyAgreed) };
      if (selector === '#snowlit-toast') return { show: (value) => messages.push(value.title) };
      return null;
    }
  }];
  global.wx = {
    getStorageSync: () => 'test-business-session',
    showModal: (options) => { dialogs.push(options); options.success({ confirm }); },
    getLocation(options) {
      locations.push(options);
      if (locationError) options.fail({ errMsg: 'getLocation:fail auth deny' });
      else options.success({ latitude: 12.0603, longitude: 18.7969 });
    },
    request(options) {
      requests.push(options);
      const pathname = new URL(options.url).pathname;
      if (pathname === '/api/weather/atmosphere/browser') {
        options.success({ statusCode: 200, data: atmosphere });
      } else if (pathname === '/api/home/location') {
        options.success({ statusCode: 204 });
      } else if (pathname === '/api/home') {
        options.success({ statusCode: 200, data: {
          personStatuses: [{ city: atmosphere.city, weather: atmosphere.rawWeather, temperature: atmosphere.temperature }]
        } });
      } else {
        assert.fail(`Unexpected request: ${pathname}`);
      }
    }
  };
  require('../pages/index/index.js');
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) { Object.assign(this.data, patch); }
  };
  return { page, requests, messages, locations, dialogs };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
});

test('missing temperatures and unknown location labels stay placeholders, while zero remains valid', () => {
  const { mapHomeData, buildHomeLocationPayload } = require('../pages/index/home-presenter');
  for (const temperature of [null, undefined, '', '   ']) {
    const result = mapHomeData({ personStatuses: [{ city: 'unknown', weather: 'unknown', temperature }] });
    assert.equal(result.weather.temperatureText, '--°');
    assert.equal(result.weather.name, '天气待更新');
    assert.equal(result.weather.place, '位置待更新');
    assert.equal(buildHomeLocationPayload({ latitude: 12, longitude: 18 }, { temperature }).temperature, null);
  }
  assert.equal(mapHomeData({ personStatuses: [{ city: '示例城市', temperature: 0 }] }).weather.temperatureText, '0°');
  assert.equal(buildHomeLocationPayload({ latitude: 12, longitude: 18 }, { temperature: 0 }).temperature, 0);
});

test('an empty first person status does not hide the other person weather', () => {
  const { mapHomeData } = require('../pages/index/home-presenter');
  const result = mapHomeData({ personStatuses: [
    { city: 'unknown', weather: '', temperature: null },
    { city: '示例城市', weather: '多云', temperature: 20 }
  ] });
  assert.equal(result.weather.temperatureText, '20°');
  assert.equal(result.weather.name, '多云');
  assert.match(result.weather.place, /^示例城市/);
});

test('weather fallback does not overwrite the saved location or show update success', async () => {
  const { page, requests, messages } = createHome({ atmosphere: {
    city: 'unknown', district: 'unknown', province: 'unknown', country: 'unknown',
    temperature: null, rawWeather: '', weatherState: 'cloudy', weatherVariant: 'unknown'
  } });
  const previousWeather = { temperatureText: '21°', name: '晴', place: '原有城市' };
  page.setData({ weather: previousWeather });
  page.handleLocationTap();
  await settle();
  assert.equal(requests.filter((request) => new URL(request.url).pathname === '/api/home/location').length, 0);
  assert.deepEqual(page.data.weather, previousWeather);
  assert.equal(page.data.locationUpdating, false);
  assert.ok(messages.includes('暂时无法获取位置和天气，请稍后重试'));
  assert.equal(messages.includes('位置已更新'), false);
});

test('location update sends coordinates with the business session and preserves a real zero temperature', async () => {
  const { page, requests, locations, messages } = createHome({ atmosphere: {
    city: '示例城市', district: '示例街区', province: '示例地区', country: '示例国家',
    temperature: 0, rawWeather: '晴', weatherState: 'clear', weatherVariant: 'clear'
  } });
  page.handleLocationTap();
  await settle();
  assert.equal(locations.length, 1);
  assert.equal(locations[0].type, 'wgs84');
  const weatherRequest = requests[0];
  assert.equal(new URL(weatherRequest.url).searchParams.get('latitude'), '12.0603');
  assert.equal(new URL(weatherRequest.url).searchParams.get('longitude'), '18.7969');
  assert.equal(weatherRequest.header.Authorization, 'Bearer test-business-session');
  const update = requests.find((request) => new URL(request.url).pathname === '/api/home/location');
  assert.equal(update.data.temperature, 0);
  assert.equal(update.data.weather, '晴');
  assert.equal(page.data.weather.temperatureText, '0°');
  assert.equal(page.data.locationUpdating, false);
  assert.ok(messages.includes('位置已更新'));
});

test('privacy refusal and location failure retain the existing weather without API writes', async () => {
  for (const settings of [{ privacyAgreed: false }, { locationError: true }]) {
    const { page, requests, locations } = createHome(settings);
    const previousWeather = { temperatureText: '21°', name: '晴', place: '原有城市' };
    page.setData({ weather: previousWeather });
    page.handleLocationTap();
    await settle();
    assert.deepEqual(page.data.weather, previousWeather);
    assert.equal(requests.length, 0);
    assert.equal(locations.length, settings.privacyAgreed === false ? 0 : 1);
    assert.equal(page.data.locationUpdating, false);
  }
});

test('an actual overseas location is saved even when weather coverage is unavailable', async () => {
  const { page, requests, messages } = createHome({ atmosphere: {
    city: 'Example City', district: '', province: 'Example Region', country: 'Example Country',
    temperature: null, rawWeather: '', weatherState: 'cloudy', weatherVariant: 'unknown'
  } });
  page.handleLocationTap();
  await settle();
  const update = requests.find((request) => new URL(request.url).pathname === '/api/home/location');
  assert.ok(update, 'actual resolved position must not depend on weather coverage');
  assert.equal(update.data.city, 'Example City');
  assert.equal(update.data.country, 'Example Country');
  assert.equal(update.data.weather, null);
  assert.equal(update.data.temperature, null);
  assert.equal(page.data.weather.temperatureText, '--°');
  assert.match(page.data.weather.place, /^Example City/);
  assert.ok(messages.includes('位置已更新，天气暂不可用'));
});

test('a country-only location stays useful without guessing a city or weather', async () => {
  const { page, requests } = createHome({ atmosphere: {
    city: 'unknown', district: '', province: '', country: 'Example Country',
    temperature: null, rawWeather: '', weatherState: 'cloudy', weatherVariant: 'unknown'
  } });
  page.loadHomeData = () => Promise.resolve();
  page.handleLocationTap();
  await settle();
  const update = requests.find((request) => new URL(request.url).pathname === '/api/home/location');
  assert.equal(update.data.city, '');
  assert.equal(update.data.country, 'Example Country');
  assert.match(page.data.weather.place, /^Example Country/);
  assert.equal(page.data.weather.temperatureText, '--°');
});


test('weather without a resolved place updates only the page and survives a home refresh', async () => {
  const { page, requests, messages } = createHome({ atmosphere: {
    city: 'unknown', district: '', province: '', country: '', temperature: 18,
    rawWeather: '晴', weatherState: 'clear', weatherVariant: 'clear'
  } });
  page.setData({ weather: { temperatureText: '21°', name: '阴', place: '原有城市' } });
  page.handleLocationTap();
  await settle();
  assert.deepEqual(page.data.weather, { temperatureText: '18°', name: '晴', place: '位置待更新' });
  assert.equal(requests.filter((r) => new URL(r.url).pathname === '/api/home/location').length, 0);
  assert.equal(requests.filter((r) => new URL(r.url).pathname === '/api/home').length, 0);
  assert.ok(messages.includes('天气已更新，位置暂不可用'));
  await page.loadHomeData();
  assert.equal(page.data.weather.temperatureText, '18°');
  assert.equal(page.data.weather.place, '位置待更新');
  assert.equal(page.data.locationUpdating, false);
});

test('location confirmation discloses the two providers and original-coordinate sharing before GPS', async () => {
  const { page, locations, requests, dialogs } = createHome({ confirm: false });
  page.handleLocationTap();
  await settle();
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0].content, /Geoapify/);
  assert.match(dialogs[0].content, /Open-Meteo/);
  assert.match(dialogs[0].content, /原始经纬度/);
  assert.match(dialogs[0].content, /日志/);
  assert.equal(locations.length, 0);
  assert.equal(requests.length, 0);
});

test('empty or malformed fallback responses never overwrite saved weather', async () => {
  for (const atmosphere of [null, {}, { city: 'unknown', rawWeather: 'unknown', temperature: ' ' }]) {
    const { page, requests } = createHome({ atmosphere });
    const weather = { temperatureText: '21°', name: '晴', place: '原有城市' };
    page.setData({ weather });
    page.handleLocationTap();
    await settle();
    assert.deepEqual(page.data.weather, weather);
    assert.equal(requests.filter((r) => new URL(r.url).pathname === '/api/home/location').length, 0);
    assert.equal(page.data.locationUpdating, false);
  }
});
