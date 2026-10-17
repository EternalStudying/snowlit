const ROUTES = {
  INDEX: 'pages/index/index',
  LOGIN: 'pages/login/index',
  DIARY: 'pages/diary/index',
  DIARY_DETAIL: 'pages/diary-detail/index',
  DIARY_EDIT: 'pages/diary-edit/index',
  STORY: 'pages/story/index',
  STORY_DETAIL: 'pages/story-detail/index',
  STORY_EDIT: 'pages/story-edit/index',
  ALBUMS: 'pages/albums/index',
  ALBUM_DETAIL: 'pages/album-detail/index',
  ALBUM_EDIT: 'pages/album-edit/index',
  WISHES: 'pages/wishes/index',
  WISH_DETAIL: 'pages/wish-detail/index',
  WISH_EDIT: 'pages/wish-edit/index',
  PROFILE: 'pages/profile/index',
  PROFILE_EDIT: 'pages/profile-edit/index',
  FEEDBACK: 'pages/feedback/index'
};

const TAB_ROUTES = [
  ROUTES.INDEX,
  ROUTES.DIARY,
  ROUTES.ALBUMS,
  ROUTES.WISHES,
  ROUTES.PROFILE
];

function stripRouteQuery(route) {
  return String(route || '').replace(/^\//, '').split('?')[0].split('#')[0];
}

function routePath(route) {
  return route.charAt(0) === '/' ? route : `/${route}`;
}

function isTabRoute(route) {
  return TAB_ROUTES.indexOf(stripRouteQuery(route)) >= 0;
}

function tabRoutePath(route) {
  return routePath(stripRouteQuery(route));
}

function withQuery(route, params) {
  const query = Object.keys(params || {})
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  return query ? `${routePath(route)}?${query}` : routePath(route);
}

module.exports = {
  ROUTES,
  TAB_ROUTES,
  stripRouteQuery,
  routePath,
  isTabRoute,
  tabRoutePath,
  withQuery
};
