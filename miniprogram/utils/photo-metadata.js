// EXIF lives in the first JPEG segments; reading the head of the file is enough.
const HEAD_BYTES = 256 * 1024;

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TIME = 0x0132;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const GPS_LATITUDE_REF = 0x0001;
const GPS_LATITUDE = 0x0002;
const GPS_LONGITUDE_REF = 0x0003;
const GPS_LONGITUDE = 0x0004;

function findExifTiffStart(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return -1;
  }
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      return -1;
    }
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) {
      return -1;
    }
    const length = view.getUint16(offset + 2);
    const isExif = marker === 0xe1 && offset + 10 <= view.byteLength
      && view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0;
    if (isExif) {
      return offset + 10;
    }
    offset += 2 + length;
  }
  return -1;
}

function readIfd(view, tiff, ifdOffset, little) {
  const entries = {};
  const start = tiff + ifdOffset;
  if (ifdOffset <= 0 || start + 2 > view.byteLength) {
    return entries;
  }
  const count = view.getUint16(start, little);
  for (let index = 0; index < count; index += 1) {
    const entry = start + 2 + index * 12;
    if (entry + 12 > view.byteLength) {
      break;
    }
    entries[view.getUint16(entry, little)] = {
      type: view.getUint16(entry + 2, little),
      count: view.getUint32(entry + 4, little),
      valueAt: entry + 8
    };
  }
  return entries;
}

function readLong(view, entry, little) {
  return entry ? view.getUint32(entry.valueAt, little) : 0;
}

function readAscii(view, tiff, entry, little) {
  if (!entry || entry.type !== 2) {
    return '';
  }
  const at = entry.count > 4 ? tiff + view.getUint32(entry.valueAt, little) : entry.valueAt;
  let text = '';
  for (let index = 0; index < entry.count && at + index < view.byteLength; index += 1) {
    const code = view.getUint8(at + index);
    if (code === 0) {
      break;
    }
    text += String.fromCharCode(code);
  }
  return text;
}

function readCoordinate(view, tiff, entry, little) {
  if (!entry || entry.type !== 5 || entry.count < 3) {
    return NaN;
  }
  const at = tiff + view.getUint32(entry.valueAt, little);
  if (at + 24 > view.byteLength) {
    return NaN;
  }
  const parts = [0, 1, 2].map((index) => {
    const denominator = view.getUint32(at + index * 8 + 4, little);
    return denominator ? view.getUint32(at + index * 8, little) / denominator : NaN;
  });
  return parts[0] + parts[1] / 60 + parts[2] / 3600;
}

/** "YYYY:MM:DD HH:MM:SS" (camera local time) to a calendar date "YYYY-MM-DD", or ''. */
function toCalendarDate(exifDateTime) {
  const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(exifDateTime || '');
  if (!match) {
    return '';
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  const valid = year > 1900 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/**
 * Reads the shooting date and GPS position from a JPEG's EXIF block.
 * Returns { takenAt: 'YYYY-MM-DD' | '', latitude, longitude } (coordinates null when absent);
 * anything that is not a JPEG with EXIF yields empty values.
 */
function parseExif(buffer) {
  const empty = { takenAt: '', latitude: null, longitude: null };
  if (!buffer || !buffer.byteLength) {
    return empty;
  }
  try {
    const view = new DataView(buffer);
    const tiff = findExifTiffStart(view);
    if (tiff < 0 || tiff + 8 > view.byteLength) {
      return empty;
    }
    const order = view.getUint16(tiff);
    if (order !== 0x4949 && order !== 0x4d4d) {
      return empty;
    }
    const little = order === 0x4949;
    const ifd0 = readIfd(view, tiff, view.getUint32(tiff + 4, little), little);
    const exifIfd = readIfd(view, tiff, readLong(view, ifd0[TAG_EXIF_IFD], little), little);
    const gps = readIfd(view, tiff, readLong(view, ifd0[TAG_GPS_IFD], little), little);

    const takenAt = toCalendarDate(readAscii(view, tiff, exifIfd[TAG_DATE_TIME_ORIGINAL], little))
      || toCalendarDate(readAscii(view, tiff, ifd0[TAG_DATE_TIME], little));

    let latitude = readCoordinate(view, tiff, gps[GPS_LATITUDE], little);
    let longitude = readCoordinate(view, tiff, gps[GPS_LONGITUDE], little);
    if (readAscii(view, tiff, gps[GPS_LATITUDE_REF], little).toUpperCase() === 'S') latitude = -latitude;
    if (readAscii(view, tiff, gps[GPS_LONGITUDE_REF], little).toUpperCase() === 'W') longitude = -longitude;
    // Cameras without a fix often write 0/0; that is not a place.
    const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude)
      && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0);

    return {
      takenAt,
      latitude: hasPosition ? latitude : null,
      longitude: hasPosition ? longitude : null
    };
  } catch (_) {
    return empty;
  }
}

/** Reads one picked file's EXIF date and position; resolves empty values when it cannot. */
function readPhotoMetadata(filePath) {
  const empty = { takenAt: '', latitude: null, longitude: null };
  if (!filePath || typeof wx === 'undefined' || typeof wx.getFileSystemManager !== 'function') {
    return Promise.resolve(empty);
  }
  return new Promise((resolve) => {
    const read = (options) => wx.getFileSystemManager().readFile({
      filePath,
      ...options,
      success: (result) => resolve(parseExif(result.data)),
      fail: () => (options.length ? read({}) : resolve(empty))
    });
    // A file shorter than the head makes a ranged read fail; then read it whole.
    read({ position: 0, length: HEAD_BYTES });
  });
}

/**
 * Sums up a selection: the earliest shooting date and the first photo's position that has one.
 */
function summarizePhotoMetadata(items) {
  return (Array.isArray(items) ? items : []).reduce((summary, item) => ({
    takenAt: item.takenAt && (!summary.takenAt || item.takenAt < summary.takenAt) ? item.takenAt : summary.takenAt,
    position: summary.position || (item.latitude !== null && item.longitude !== null
      ? { latitude: item.latitude, longitude: item.longitude }
      : null)
  }), { takenAt: '', position: null });
}

module.exports = {
  parseExif,
  readPhotoMetadata,
  summarizePhotoMetadata
};
