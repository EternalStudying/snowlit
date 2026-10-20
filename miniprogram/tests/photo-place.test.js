const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { getPhotoPlaceName } = require('../services/weather');

let atmosphere;
let failed = false;
global.wx = {
  getStorageSync: () => 'test-business-session',
  request(options) {
    if (failed) options.fail({ errMsg: 'request:fail' });
    else options.success({ statusCode: 200, data: atmosphere });
  }
};
after(() => { delete global.wx; });

test('photo places prefer district and city over country', async () => {
  atmosphere = { district: 'Camden', city: 'London', province: 'England', country: 'United Kingdom' };
  assert.equal(await getPhotoPlaceName({ latitude: 1, longitude: 2 }), 'Camden，London');
  atmosphere = { district: '北区', city: '大阪市', province: '大阪府', country: '日本' };
  assert.equal(await getPhotoPlaceName({ latitude: 1, longitude: 2 }), '北区，大阪');
});

test('photo place fallbacks skip duplicates and unknown components', async () => {
  for (const [value, expected] of [
    [{ city: 'Paris', province: 'Île-de-France', country: 'France' }, 'Paris，Île-de-France'],
    [{ district: 'Berlin', city: 'Berlin', province: 'Berlin', country: 'Germany' }, 'Berlin，Germany'],
    [{ city: 'unknown', district: '未知', province: 'Example Region', country: 'Example Country' }, 'Example Region，Example Country'],
    [{ country: 'Example Country' }, 'Example Country'],
    [{ city: 'unknown', country: 'unknown' }, ''],
    [null, '']
  ]) {
    atmosphere = value;
    assert.equal(await getPhotoPlaceName({ latitude: 1, longitude: 2 }), expected);
  }
});

test('photo place lookup failure still leaves the place unknown', async () => {
  failed = true;
  assert.equal(await getPhotoPlaceName({ latitude: 1, longitude: 2 }), '');
  failed = false;
});
