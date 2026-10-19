export const loadHomeRoute = () => import('./HomeView.vue');
export {
  syncHomeLocationFromWeather,
  useHomeLifecycle
} from './internal/useHomeLifecycle';
