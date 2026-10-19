function readPercent(progress) {
  const value = Number(progress && progress.progress);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

/**
 * Uploads a page's image list one file at a time, from `from` onwards, and keeps each item's
 * status, progress, message and url current through `patch(index, patch)`.
 *
 * - `read()` returns the current list; items already uploaded, or without a path, are skipped.
 * - `upload(item, index, onProgress)` sends one file and resolves with a response that has a `url`.
 * - `onUploaded(response, index)` runs after an item is marked uploaded (e.g. to insert it).
 * - The first failure stops the queue and rejects, unless `continueOnFailure` is set: then the
 *   rest still upload and the queue rejects afterwards with the first error.
 */
function uploadQueue(options) {
  const {
    read,
    patch,
    upload,
    from = 0,
    continueOnFailure = false,
    failureMessage = '图片上传失败',
    uploadedMessage = '已上传',
    onUploaded = () => {}
  } = options;
  const count = read().length;
  let firstError = null;

  function uploadAt(index) {
    const item = read()[index];
    if (!item || !item.path || (item.status === 'uploaded' && item.url)) {
      return Promise.resolve();
    }
    patch(index, { status: 'uploading', progress: 0, message: '上传中 0%' });
    return Promise.resolve()
      .then(() => upload(item, index, (progress) => {
        const percent = readPercent(progress);
        patch(index, { progress: percent, message: `上传中 ${percent}%` });
      }))
      .then((response) => {
        if (!response || !response.url) {
          throw new Error(failureMessage);
        }
        patch(index, { url: response.url, status: 'uploaded', progress: 100, message: uploadedMessage });
        onUploaded(response, index);
      })
      .catch((error) => {
        patch(index, { status: 'failed', progress: 0, message: '上传失败' });
        throw error;
      });
  }

  let queue = Promise.resolve();
  for (let index = from; index < count; index += 1) {
    queue = queue.then(() => uploadAt(index).catch((error) => {
      if (!continueOnFailure) {
        throw error;
      }
      firstError = firstError || error;
    }));
  }
  return queue.then(() => {
    if (firstError) {
      throw firstError;
    }
  });
}

/** Replaces the item at `index` with `patch` merged in. */
function patchItem(list, index, patch) {
  return list.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

module.exports = {
  patchItem,
  uploadQueue
};
