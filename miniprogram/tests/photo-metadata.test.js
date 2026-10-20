const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseExif, readPhotoMetadata, summarizePhotoMetadata } = require('../utils/photo-metadata');
const { buildJpeg } = require('./helpers/exif-jpeg');

const pacific = { latRef: 'S', lat: [[33, 1], [52, 1], [1, 2]], lonRef: 'W', lon: [[151, 1], [12, 1], [36, 1]] };

test('reads the original shooting date and a south-west position (big-endian)', () => {
  const result = parseExif(buildJpeg({ dateTimeOriginal: '2026:05:28 21:14:03', gps: pacific }));
  assert.equal(result.takenAt, '2026-05-28');
  assert.ok(Math.abs(result.latitude - -(33 + 52 / 60 + 0.5 / 3600)) < 1e-9);
  assert.ok(Math.abs(result.longitude - -(151 + 12 / 60 + 36 / 3600)) < 1e-9);
});

test('reads little-endian files and falls back to the IFD0 date', () => {
  const result = parseExif(buildJpeg({ little: true, dateTime: '2025:12:31 23:59:59' }));
  assert.deepEqual(result, { takenAt: '2025-12-31', latitude: null, longitude: null });
});

test('reads signed-rational GPS components in both byte orders', () => {
  for (const little of [false, true]) {
    const result = parseExif(buildJpeg({ little, gps: pacific, gpsType: 10 }));
    assert.ok(Math.abs(result.latitude - -(33 + 52 / 60 + 0.5 / 3600)) < 1e-9);
    assert.ok(Math.abs(result.longitude - -(151 + 12 / 60 + 36 / 3600)) < 1e-9);
  }
});

test('signed-rational GPS reads negative numerators and denominators as signed integers', () => {
  const signed = {
    ...pacific,
    lat: pacific.lat.map(([numerator, denominator]) => [-numerator, -denominator]),
    lon: pacific.lon.map(([numerator, denominator]) => [-numerator, -denominator])
  };
  const result = parseExif(buildJpeg({ gps: signed, gpsType: 10 }));
  assert.ok(Math.abs(result.latitude - -(33 + 52 / 60 + 0.5 / 3600)) < 1e-9);
  assert.ok(Math.abs(result.longitude - -(151 + 12 / 60 + 36 / 3600)) < 1e-9);
});

test('signed-rational GPS with a zero denominator remains unknown', () => {
  const gps = { ...pacific, lat: [[33, 0], [52, 1], [1, 2]] };
  const result = parseExif(buildJpeg({ gps, gpsType: 10 }));
  assert.equal(result.latitude, null);
  assert.equal(result.longitude, null);
});

test('the original date wins over the modification date', () => {
  const result = parseExif(buildJpeg({ dateTimeOriginal: '2024:02:29 08:00:00', dateTime: '2026:01:01 00:00:00' }));
  assert.equal(result.takenAt, '2024-02-29');
});

test('impossible dates, a 0/0 fix, non-JPEG data and EXIF-less JPEGs give empty values', () => {
  const empty = { takenAt: '', latitude: null, longitude: null };
  assert.equal(parseExif(buildJpeg({ dateTimeOriginal: '2025:02:29 08:00:00' })).takenAt, '');
  assert.equal(parseExif(buildJpeg({ dateTimeOriginal: '0000:00:00 00:00:00' })).takenAt, '');
  const zero = { latRef: 'N', lat: [[0, 1], [0, 1], [0, 1]], lonRef: 'E', lon: [[0, 1], [0, 1], [0, 1]] };
  assert.equal(parseExif(buildJpeg({ gps: zero })).latitude, null);
  assert.deepEqual(parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), empty);
  assert.deepEqual(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), empty);
  assert.deepEqual(parseExif(undefined), empty);
});

test('a truncated EXIF block never throws', () => {
  const full = new Uint8Array(buildJpeg({ dateTimeOriginal: '2026:05:28 21:14:03', gps: pacific }));
  for (let size = 0; size < full.length; size += 7) {
    assert.doesNotThrow(() => parseExif(full.slice(0, size).buffer));
  }
});

test('readPhotoMetadata reads the head of the file and retries whole when the range fails', async () => {
  const calls = [];
  const jpeg = buildJpeg({ dateTimeOriginal: '2026:05:28 21:14:03' });
  global.wx = {
    getFileSystemManager: () => ({
      readFile(options) {
        calls.push({ position: options.position, length: options.length });
        if (options.length) {
          options.fail({ errMsg: 'readFile:fail the value of length is out of range' });
        } else {
          options.success({ data: jpeg });
        }
      }
    })
  };
  const result = await readPhotoMetadata('wxfile://tmp/a.jpg');
  assert.equal(result.takenAt, '2026-05-28');
  assert.deepEqual(calls, [{ position: 0, length: 256 * 1024 }, { position: undefined, length: undefined }]);
  delete global.wx;
});

test('summarizePhotoMetadata takes the earliest date and the first position', () => {
  const summary = summarizePhotoMetadata([
    { takenAt: '2026-05-28', latitude: null, longitude: null },
    { takenAt: '2026-05-20', latitude: 1.5, longitude: 2.5 },
    { takenAt: '', latitude: 9, longitude: 9 }
  ]);
  assert.deepEqual(summary, { takenAt: '2026-05-20', position: { latitude: 1.5, longitude: 2.5 } });
  assert.deepEqual(summarizePhotoMetadata([]), { takenAt: '', position: null });
});
