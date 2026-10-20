const { config } = require('../constants/config');

// Server-relative media paths need an origin in native image APIs.
function resolveMediaUrl(url) {
  if (!url || url.charAt(0) !== '/' || url.indexOf('//') === 0) {
    return url || '';
  }
  const base = (config.mediaBaseUrl || config.apiBaseUrl).replace(/\/+$/, '');
  return `${base}${url}`;
}

module.exports = { resolveMediaUrl };
