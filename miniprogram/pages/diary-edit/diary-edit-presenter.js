const MAX_DIARY_IMAGES = 20;

const DIARY_MOODS = [
  { label: '开心', value: 'happy' },
  { label: '想念', value: 'miss' },
  { label: '平静', value: 'calm' },
  { label: '委屈', value: 'wronged' },
  { label: '期待', value: 'expecting' },
  { label: '疲惫', value: 'tired' },
  { label: '甜蜜', value: 'sweet' },
  { label: '秘密', value: 'secret' },
  { label: '生气', value: 'angry' },
  { label: '感动', value: 'touched' }
];

const VALID_VISIBILITIES = ['shared', 'private'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function clean(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function normalizeDate(value) {
  const normalized = clean(value).replace(/\./g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function formatDiaryDateText(value) {
  const normalized = normalizeDate(value);
  return normalized ? normalized.replace(/-/g, '.') : '';
}

function isValidMood(value) {
  return DIARY_MOODS.some((item) => item.value === value);
}

function moodLabel(value) {
  const mood = DIARY_MOODS.find((item) => item.value === value);
  return mood ? mood.label : DIARY_MOODS[0].label;
}

function createInitialDiaryForm(now) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return {
    title: '',
    date: value,
    dateText: formatDiaryDateText(value),
    moodKey: 'happy',
    moodText: moodLabel('happy'),
    visibility: 'shared',
    content: ''
  };
}

function mapDiaryMoods(activeMood) {
  const current = isValidMood(activeMood) ? activeMood : 'happy';
  return DIARY_MOODS.map((item) => ({
    ...item,
    active: item.value === current
  }));
}

function stripInlineMarkdown(value) {
  return clean(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^#+\s*/, '')
    .replace(/[*_~=>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasLeadingH1(content) {
  const firstLine = clean(content).split(/\r?\n/).find((line) => clean(line));
  return Boolean(firstLine && /^#(?:\s+.*)?$/.test(clean(firstLine)));
}

function stripLeadingH1Markdown(content) {
  const lines = clean(content).split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => clean(line));
  if (firstContentIndex === -1 || !/^#(?:\s+.*)?$/.test(clean(lines[firstContentIndex]))) {
    return clean(content);
  }
  return lines.slice(firstContentIndex + 1).join('\n').trim();
}

function ensureTitleMarkdown(title, content) {
  const titleText = stripInlineMarkdown(title).slice(0, 36);
  const source = clean(content);
  const body = hasLeadingH1(source) ? stripLeadingH1Markdown(source) : source;
  return `# ${titleText}\n\n${body}`.trim();
}

function buildDiaryCreatePayload(form) {
  const source = form || {};
  const title = stripInlineMarkdown(source.title).slice(0, 36);
  const content = clean(source.content);
  const date = normalizeDate(source.date);
  const moodKey = clean(source.moodKey);
  const visibility = clean(source.visibility);

  if (!title) {
    return { valid: false, message: '请输入标题' };
  }
  if (!content) {
    return { valid: false, message: '先写一点日记内容吧' };
  }
  if (!date) {
    return { valid: false, message: '请选择日记日期' };
  }
  if (!isValidMood(moodKey)) {
    return { valid: false, message: '请选择正确心情' };
  }
  if (!VALID_VISIBILITIES.includes(visibility)) {
    return { valid: false, message: '请选择正确可见范围' };
  }

  const payload = {
    contentMarkdown: ensureTitleMarkdown(title, content),
    date,
    moodKey,
    visibility
  };

  if (source.weatherSnapshot) {
    payload.weatherSnapshot = source.weatherSnapshot;
  }

  return {
    valid: true,
    payload
  };
}

function buildDiaryUpdatePayload(form) {
  const source = form || {};
  const title = stripInlineMarkdown(source.title).slice(0, 36);
  const content = clean(source.content);
  const moodKey = clean(source.moodKey);
  const visibility = clean(source.visibility);

  if (!title) {
    return { valid: false, message: '请输入标题' };
  }
  if (!content) {
    return { valid: false, message: '先写一点日记内容吧' };
  }
  if (!isValidMood(moodKey)) {
    return { valid: false, message: '请选择正确心情' };
  }
  if (!VALID_VISIBILITIES.includes(visibility)) {
    return { valid: false, message: '请选择正确可见范围' };
  }

  return {
    valid: true,
    payload: {
      contentMarkdown: ensureTitleMarkdown(title, content),
      moodKey,
      visibility
    }
  };
}

function mapDiaryEditForm(response) {
  const diary = response || {};
  const date = normalizeDate(diary.entryDate) || createInitialDiaryForm().date;
  const moodKey = isValidMood(diary.moodKey) ? diary.moodKey : 'happy';
  const title = stripInlineMarkdown(diary.title).slice(0, 36);

  return {
    title,
    date,
    dateText: formatDiaryDateText(date),
    moodKey,
    moodText: moodLabel(moodKey),
    visibility: VALID_VISIBILITIES.includes(clean(diary.visibility)) ? clean(diary.visibility) : 'shared',
    content: stripLeadingH1Markdown(diary.contentMarkdown)
  };
}

function createLocalImage(path) {
  const imagePath = clean(path);
  return {
    id: imagePath,
    path: imagePath,
    preview: imagePath,
    url: '',
    status: 'local',
    progress: 0,
    message: ''
  };
}

function appendSelectedDiaryImages(currentImages, selectedFiles) {
  const current = Array.isArray(currentImages) ? currentImages.slice(0, MAX_DIARY_IMAGES) : [];
  const selected = Array.isArray(selectedFiles) ? selectedFiles : [];
  const result = current.slice();
  const freeSlots = Math.max(0, MAX_DIARY_IMAGES - result.length);
  const reachedLimit = selected.length > freeSlots || current.length >= MAX_DIARY_IMAGES;

  selected.slice(0, freeSlots).forEach((file) => {
    const imagePath = clean(file && (file.tempFilePath || file.path || file));
    if (imagePath) {
      result.push(createLocalImage(imagePath));
    }
  });

  return {
    images: result,
    reachedLimit
  };
}

function collectUploadedDiaryImageUrls(images) {
  return (Array.isArray(images) ? images : [])
    .filter((item) => item && item.status === 'uploaded')
    .map((item) => clean(item.url))
    .filter(Boolean);
}

function clampCursor(value, content) {
  const length = String(content || '').length;
  const cursor = Number(value);
  if (!Number.isFinite(cursor)) {
    return length;
  }
  return Math.max(0, Math.min(length, cursor));
}

function insertMarkdownAtCursor(content, snippet, cursor) {
  const source = String(content || '');
  const position = clampCursor(cursor, source);
  const value = String(snippet || '');
  return {
    content: `${source.slice(0, position)}${value}${source.slice(position)}`,
    cursor: position + value.length
  };
}

function insertInlineMarkdown(content, prefix, suffix, placeholder, selectionStart, selectionEnd) {
  const source = String(content || '');
  const start = clampCursor(selectionStart, source);
  const end = clampCursor(selectionEnd === undefined ? selectionStart : selectionEnd, source);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const selected = source.slice(from, to) || placeholder || '';
  return insertMarkdownAtCursor(
    `${source.slice(0, from)}${source.slice(to)}`,
    `${prefix || ''}${selected}${suffix || ''}`,
    from
  );
}

function insertBlockMarkdown(content, snippet, cursor) {
  const source = String(content || '');
  const position = clampCursor(cursor, source);
  const before = source.slice(0, position);
  const after = source.slice(position);
  const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = after && !String(snippet || '').endsWith('\n\n') ? '\n\n' : '';
  return insertMarkdownAtCursor(source, `${prefix}${snippet || ''}${suffix}`, position);
}

function insertDiaryImageMarkdown(content, url, cursor) {
  const imageUrl = clean(url);
  if (!imageUrl) {
    return {
      content: String(content || ''),
      cursor: clampCursor(cursor, content)
    };
  }
  const source = String(content || '');
  const position = clampCursor(cursor, source);
  const prefix = source ? '\n\n' : '';
  return insertMarkdownAtCursor(source, `${prefix}![图片](${imageUrl})\n\n`, position);
}

module.exports = {
  MAX_DIARY_IMAGES,
  appendSelectedDiaryImages,
  buildDiaryCreatePayload,
  buildDiaryUpdatePayload,
  collectUploadedDiaryImageUrls,
  createInitialDiaryForm,
  formatDiaryDateText,
  insertBlockMarkdown,
  insertDiaryImageMarkdown,
  insertInlineMarkdown,
  mapDiaryEditForm,
  mapDiaryMoods,
  moodLabel
};
