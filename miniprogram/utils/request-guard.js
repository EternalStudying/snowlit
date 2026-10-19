const { getToken } = require('./auth');

/**
 * Starts a request for one piece of a page's state and returns a check: it stays true only while
 * this is the latest request for `key` on that page and the business session has not changed.
 * Apply a response, error or loading flag only when the check passes, so a slow earlier response
 * (an older filter, the previous member) never overwrites a newer one.
 */
function beginRequest(page, key) {
  const requests = page.latestRequests || (page.latestRequests = {});
  const id = (requests[key] || 0) + 1;
  const token = getToken();
  requests[key] = id;
  return () => requests[key] === id && getToken() === token;
}

module.exports = {
  beginRequest
};
