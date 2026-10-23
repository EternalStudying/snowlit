// Month counts as GET /api/diary/months returns them: { years: [{ year, months: [{ month, count }] }] }.
// Shared by every timeline that groups by month and offers the month jump sheet.
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const MONTHS_IN_YEAR = 12;

function padMonth(value) {
  return String(value).padStart(2, '0');
}

function normalizeMonth(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return MONTH_PATTERN.test(text) ? text : '';
}

function monthCounts(response) {
  const years = Array.isArray(response && response.years) ? response.years : [];
  const counts = {};
  years.forEach((year) => {
    (year && Array.isArray(year.months) ? year.months : []).forEach((item) => {
      const month = normalizeMonth(item && item.month);
      if (month) {
        counts[month] = Math.max(0, Number(item.count) || 0);
      }
    });
  });
  return counts;
}

// The timeline's spine: every month with an entry, newest first.
function buildMonthIndex(response) {
  const counts = monthCounts(response);
  return Object.keys(counts)
    .filter((month) => counts[month] > 0)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((month) => ({ month, count: counts[month] }));
}

function buildJumpYears(response, activeMonth) {
  const counts = monthCounts(response);
  // Only years with at least one entry; an empty diary account comes back as this year, all zeros.
  const years = Array.from(new Set(buildMonthIndex(response).map((item) => item.month.slice(0, 4))));
  return years.map((year) => ({
    year,
    months: Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
      const month = `${year}-${padMonth(index + 1)}`;
      const count = counts[month] || 0;
      return {
        month,
        label: padMonth(index + 1),
        count,
        disabled: count === 0,
        active: month === activeMonth
      };
    })
  }));
}

// The same shape built from a list of YYYY-MM values, for timelines that load everything at once.
function monthsResponseFrom(months) {
  const counts = {};
  (Array.isArray(months) ? months : []).forEach((value) => {
    const month = normalizeMonth(value);
    if (month) {
      counts[month] = (counts[month] || 0) + 1;
    }
  });
  const years = Array.from(new Set(Object.keys(counts).map((month) => month.slice(0, 4))))
    .sort((a, b) => (a < b ? 1 : -1));
  return {
    years: years.map((year) => ({
      year: Number(year),
      months: Object.keys(counts)
        .filter((month) => month.startsWith(`${year}-`))
        .map((month) => ({ month, count: counts[month] }))
    }))
  };
}

module.exports = {
  buildJumpYears,
  buildMonthIndex,
  monthsResponseFrom
};
