function readPickedPath(file) {
  if (!file) {
    return '';
  }
  const value = typeof file === 'string' ? file : file.tempFilePath || file.path;
  return String(value || '').trim();
}

/**
 * Adds picked files to an image list of at most `max` items. `toItem(path, file)` builds each entry;
 * files without a path are skipped. `reachedLimit` says some picked files did not fit.
 */
function appendPickedImages(current, files, max, toItem) {
  const base = (Array.isArray(current) ? current : []).slice(0, max);
  const picked = (Array.isArray(files) ? files : [])
    .map((file) => ({ file, path: readPickedPath(file) }))
    .filter((item) => item.path);
  const freeSlots = Math.max(0, max - base.length);
  return {
    images: base.concat(picked.slice(0, freeSlots).map((item) => toItem(item.path, item.file))),
    reachedLimit: picked.length > freeSlots
  };
}

/** The business URLs of the images that finished uploading, in list order. */
function collectUploadedUrls(images) {
  return (Array.isArray(images) ? images : [])
    .filter((item) => item && item.status === 'uploaded')
    .map((item) => String(item.url || '').trim())
    .filter(Boolean);
}

module.exports = {
  appendPickedImages,
  collectUploadedUrls,
  readPickedPath
};
