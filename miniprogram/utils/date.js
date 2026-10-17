function pad(value) {
  return String(value).padStart(2, '0');
}

function toDate(value) {
  if (!value) {
    return null;
  }
  const calendarDate = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (calendarDate) {
    const [year, month, day] = calendarDate.slice(1).map(Number);
    // Date-only strings otherwise parse as UTC and can become the previous local day.
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatMonthDay(value) {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

module.exports = {
  toDate,
  formatDate,
  formatDateTime,
  formatMonthDay
};
