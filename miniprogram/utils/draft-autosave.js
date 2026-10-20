const { getDraft, saveDraft, discardDraft } = require('../services/draft');
const { getToken, onTokenChange } = require('./auth');
const { beginRequest } = require('./request-guard');
const { showConfirm } = require('./dialog');

function savedTime(value) {
  const date = new Date(value || Date.now());
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function createDraftAutosave({ page, kind, read, view, sessionChanged = () => {} }) {
  const token = getToken();
  let stopped = false;
  let paused = false;
  let dirty = false;
  let timer = null;
  let flight = null;
  const unsubscribe = onTokenChange(() => {
    if (getToken() !== token && !stopped) {
      stop();
      sessionChanged();
    }
  });

  function current() {
    if (!stopped && getToken() !== token) {
      stop();
      sessionChanged();
    }
    return !stopped;
  }
  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function run() {
    if (!current() || paused || !dirty) return Promise.resolve(true);
    if (flight) return flight;
    dirty = false;
    const fields = read();
    const isCurrent = beginRequest(page, 'draft-save');
    view('保存中…');
    flight = Promise.resolve().then(() => {
      if (!current()) return null;
      return saveDraft(kind, fields);
    }).then((draft) => {
      if (current() && isCurrent()) view(`已自动保存 ${savedTime(draft && draft.updatedAt)}`);
      return true;
    }).catch(() => {
      if (current() && isCurrent()) {
        dirty = true;
        view('自动保存失败，稍后会重试');
      }
      return false;
    }).then((ok) => {
      flight = null;
      if (ok && dirty && current()) {
        clearTimer();
        return run();
      }
      return ok;
    });
    return flight;
  }
  function changed() {
    if (!current() || paused) return;
    dirty = true;
    clearTimer();
    timer = setTimeout(() => { timer = null; run(); }, 1500);
  }
  function flush() {
    clearTimer();
    if (!current()) return Promise.resolve(false);
    if (flight) return flight.then((ok) => (ok && dirty ? run() : ok));
    return run();
  }
  function stop() {
    stopped = true;
    clearTimer();
    unsubscribe();
  }
  function pause() {
    paused = true;
    dirty = false;
    clearTimer();
  }
  function resume() {
    paused = false;
  }
  return { changed, flush, pause, resume, stop };
}

async function loadDraft(page, kind) {
  const isCurrent = beginRequest(page, 'draft-load');
  const response = await getDraft(kind);
  if (!isCurrent()) return { current: false };
  const draft = response && response.draft;
  if (!draft) return { current: true, draft: null };
  const date = new Date(draft.updatedAt);
  const choice = await showConfirm({
    title: '继续上次的草稿？',
    content: `上次保存于 ${date.getMonth() + 1}月${date.getDate()}日 ${savedTime(draft.updatedAt)}`,
    confirmText: '继续编辑', cancelText: '放弃草稿'
  });
  if (!isCurrent()) return { current: false };
  if (choice && choice.confirm) return { current: true, draft };
  await discardDraft(kind);
  return { current: isCurrent(), draft: null };
}

module.exports = { createDraftAutosave, loadDraft };
