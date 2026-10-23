const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

// Loads the Drops edit page with a fake wx; `privacy` answers the privacy prompt, `pick` plays wx.chooseLocation.
function loadEditPage({ privacy = true, pick, respond }) {
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(`${root}${path.sep}`) && key !== __filename) {
      delete require.cache[key];
    }
  });
  let definition;
  const toasts = [];
  const chooseCalls = [];
  const requests = [];
  global.Page = (value) => { definition = value; };
  global.getCurrentPages = () => [{
    selectComponent: (selector) => (selector === '#snowlit-privacy' ? { authorize: () => Promise.resolve(privacy) } : null)
  }];
  global.wx = {
    getStorageSync: (key) => (key === 'snowlit_token' ? 'token' : ''),
    request: (options) => {
      requests.push(options);
      if (respond) respond(options);
    },
    showToast: (options) => toasts.push(options.title),
    chooseLocation: (options) => {
      chooseCalls.push(options);
      pick(options);
    }
  };
  require(path.join(root, 'pages/story-edit/index.js'));
  const page = {
    ...definition,
    data: {
      ...JSON.parse(JSON.stringify(definition.data)),
      draftLocked: false,
      submitting: false,
      form: { ...JSON.parse(JSON.stringify(definition.data.form)), locationName: '手写', address: '', longitude: '', latitude: '' }
    },
    setData(patch) {
      Object.keys(patch).forEach((key) => {
        const keys = key.split('.');
        let target = this.data;
        keys.slice(0, -1).forEach((part) => { target = target[part]; });
        target[keys[keys.length - 1]] = patch[key];
      });
    }
  };
  return { page, toasts, chooseCalls, requests };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test.afterEach(() => {
  delete global.Page;
  delete global.wx;
  delete global.getCurrentPages;
});

test('picking a place fills the name, address and coordinates', async () => {
  const { page, chooseCalls } = loadEditPage({
    pick: (options) => options.success({ name: '西湖', address: '杭州市西湖区', latitude: 30.25, longitude: 120.16 })
  });
  page.handleChooseLocation();
  await settle();

  assert.equal(chooseCalls.length, 1);
  assert.equal(chooseCalls[0].latitude, undefined, 'no starting point when the drop has none');
  assert.deepEqual(
    [page.data.form.locationName, page.data.form.address, page.data.form.longitude, page.data.form.latitude],
    ['西湖', '杭州市西湖区', '120.160000', '30.250000']
  );

  // Picking again opens the picker at the current place.
  page.handleChooseLocation();
  await settle();
  assert.equal(chooseCalls[1].latitude, 30.25);
  assert.equal(chooseCalls[1].longitude, 120.16);
});

test('cancelling the picker changes nothing and says nothing', async () => {
  const { page, toasts } = loadEditPage({ pick: (options) => options.fail({ errMsg: 'chooseLocation:fail cancel' }) });
  page.handleChooseLocation();
  await settle();
  assert.equal(page.data.form.locationName, '手写');
  assert.equal(page.data.form.longitude, '');
  assert.deepEqual(toasts, []);
});

test('declining the privacy prompt never opens the picker', async () => {
  const { page, chooseCalls, toasts } = loadEditPage({ privacy: false, pick: () => assert.fail('picker opened') });
  page.handleChooseLocation();
  await settle();
  assert.equal(chooseCalls.length, 0);
  assert.deepEqual(toasts, ['同意隐私指引后才能选择地点']);
});

test('a picker failure points to manual entry', async () => {
  const { page, toasts } = loadEditPage({ pick: (options) => options.fail({ errMsg: 'chooseLocation:fail auth deny' }) });
  page.handleChooseLocation();
  await settle();
  assert.deepEqual(toasts, ['暂时无法打开地图，可以手动填写经纬度']);
});

test('searching by name lists places from anywhere, and choosing one fills the form', async () => {
  const { page, requests } = loadEditPage({
    pick: () => assert.fail('picker opened'),
    respond: (options) => options.success({
      statusCode: 200,
      data: { items: [
        { name: '埃菲尔铁塔', address: '巴黎, 法国', latitude: 48.85826, longitude: 2.294499, countryCode: 'fr' },
        { name: '没有坐标' }
      ] }
    })
  });

  page.handleOpenPlaceSheet();
  assert.equal(page.data.placeSheetVisible, true);
  await page.handlePlaceSearch({ detail: { query: ' 埃菲尔铁塔 ' } });
  assert.match(requests[0].url, /\/api\/story\/places\?q=%E5%9F%83%E8%8F%B2%E5%B0%94%E9%93%81%E5%A1%94$/);
  assert.deepEqual(page.data.placeResults.map((place) => place.name), ['埃菲尔铁塔']);

  page.handlePlaceSelect({ detail: { place: page.data.placeResults[0] } });
  assert.equal(page.data.placeSheetVisible, false);
  assert.deepEqual(
    [page.data.form.locationName, page.data.form.address, page.data.form.latitude, page.data.form.longitude],
    ['埃菲尔铁塔', '巴黎, 法国', '48.858260', '2.294499']
  );
});

test('a failed search says so in the sheet and leaves the form alone', async () => {
  const { page } = loadEditPage({
    pick: () => {},
    respond: (options) => options.success({ statusCode: 502, data: { code: 'STORY_PLACE_SEARCH_UNAVAILABLE', message: '地点搜索暂时不可用，可以在地图上选点' } })
  });
  page.handleOpenPlaceSheet();
  await page.handlePlaceSearch({ detail: { query: '西湖' } });
  assert.equal(page.data.placeSearched, true);
  assert.deepEqual(page.data.placeResults, []);
  assert.ok(page.data.placeMessage);
  assert.equal(page.data.form.locationName, '手写');
});

test('choosing the map from the sheet closes it and opens the pin picker', async () => {
  const { page, chooseCalls } = loadEditPage({ pick: () => {} });
  page.handleOpenPlaceSheet();
  page.handlePlaceMap();
  await settle();
  assert.equal(page.data.placeSheetVisible, false);
  assert.equal(chooseCalls.length, 1);
});

test('a place without a name opens manual entry so it can be named', async () => {
  const { page } = loadEditPage({ pick: (options) => options.success({ name: '', address: '', latitude: 48.1, longitude: 11.5 }) });
  page.data.form.locationName = '';
  page.handleChooseLocation();
  await settle();
  assert.equal(page.data.form.latitude, '48.100000');
  assert.equal(page.data.manualPlace, true);

  page.toggleManualPlace();
  assert.equal(page.data.manualPlace, false);
  page.handlePlaceSelect({ detail: { place: { name: '慕尼黑', address: '', latitude: 48.137, longitude: 11.575 } } });
  assert.equal(page.data.manualPlace, false, 'a named place leaves manual entry closed');
});

test('adding an end time starts it at the start time, and clearing removes it', () => {
  const { page } = loadEditPage({ pick: () => {} });
  page.data.form.eventDate = '2026-10-22';
  page.data.form.eventTime = '20:56';
  page.addEndTime();
  assert.equal(page.data.form.endDate, '2026-10-22');
  assert.equal(page.data.form.endTime, '20:56');
  page.clearEndTime();
  assert.equal(page.data.form.endDate, '');
  assert.equal(page.data.form.endTime, '');
});
