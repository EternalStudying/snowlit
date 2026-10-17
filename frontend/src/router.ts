import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { loadAboutRoute } from './modules/about';
import { loadAlbumRoute } from './modules/album';
import { loadDiaryRoute } from './modules/diary';
import { loadHomeRoute } from './modules/home';
import { loadMessagesRoute } from './modules/messages';
import { loadStoryRoute } from './modules/story';
import { loadWishesRoute } from './modules/wishes';
import { consumeRouteScrollPosition } from './navigation/routeScrollPolicy';

export const routes: RouteRecordRaw[] = [
  { path: '/', component: loadHomeRoute },
  { path: '/story', component: loadStoryRoute, meta: { immersive: true, public: true } },
  { path: '/album', component: loadAlbumRoute },
  { path: '/messages', component: loadMessagesRoute },
  { path: '/diary', component: loadDiaryRoute },
  { path: '/wishes', component: loadWishesRoute },
  { path: '/about', component: loadAboutRoute, meta: { immersive: true } }
];

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return consumeRouteScrollPosition(savedPosition);
  }
});
