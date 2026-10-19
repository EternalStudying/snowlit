// Builds a minimal JPEG: SOI, APP1 Exif (IFD0 -> Exif IFD + GPS IFD), then SOS.
function buildJpeg({ little = false, dateTimeOriginal, dateTime, gps } = {}) {
  const tiff = [];
  const u16 = (value) => (little ? [value & 0xff, value >> 8] : [value >> 8, value & 0xff]);
  const u32 = (value) => {
    const bytes = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    return little ? bytes.reverse() : bytes;
  };
  const ascii = (text) => [...Buffer.from(`${text}\0`, 'latin1')];
  const rational3 = (parts) => parts.flatMap(([numerator, denominator]) => [...u32(numerator), ...u32(denominator)]);

  // Layout: header(8) | IFD0 | Exif IFD | GPS IFD | data area
  const ifd0Tags = [];
  if (dateTime) ifd0Tags.push({ tag: 0x0132, type: 2, data: ascii(dateTime) });
  ifd0Tags.push({ tag: 0x8769, type: 4, pointer: 'exif' });
  if (gps) ifd0Tags.push({ tag: 0x8825, type: 4, pointer: 'gps' });
  const exifTags = dateTimeOriginal ? [{ tag: 0x9003, type: 2, data: ascii(dateTimeOriginal) }] : [];
  const gpsTags = gps ? [
    { tag: 0x0001, type: 2, data: ascii(gps.latRef) },
    { tag: 0x0002, type: 5, data: rational3(gps.lat), count: 3 },
    { tag: 0x0003, type: 2, data: ascii(gps.lonRef) },
    { tag: 0x0004, type: 5, data: rational3(gps.lon), count: 3 }
  ] : [];

  const ifdSize = (tags) => 2 + tags.length * 12 + 4;
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(ifd0Tags);
  const gpsAt = exifAt + ifdSize(exifTags);
  let dataAt = gpsAt + ifdSize(gpsTags);
  const dataArea = [];

  function writeIfd(tags) {
    const bytes = [...u16(tags.length)];
    tags.forEach((item) => {
      const count = item.count || (item.data ? item.data.length : 1);
      bytes.push(...u16(item.tag), ...u16(item.type), ...u32(count));
      if (item.pointer) {
        bytes.push(...u32(item.pointer === 'exif' ? exifAt : gpsAt));
      } else if (item.data.length <= 4) {
        bytes.push(...item.data, ...new Array(4 - item.data.length).fill(0));
      } else {
        bytes.push(...u32(dataAt));
        dataArea.push(...item.data);
        dataAt += item.data.length;
      }
    });
    bytes.push(...u32(0));
    return bytes;
  }

  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At));
  tiff.push(...writeIfd(ifd0Tags), ...writeIfd(exifTags), ...writeIfd(gpsTags), ...dataArea);

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const length = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, ...app1, 0xff, 0xda, 0, 2, 0xff, 0xd9];
  return new Uint8Array(bytes).buffer;
}

module.exports = {
  buildJpeg
};
