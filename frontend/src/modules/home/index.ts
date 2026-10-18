// The journal shell wraps every journal route in the Home paper look, so Home's styles load with the module.
import './home-paper.css';
import './home.css';
import './home-motion.css';
import './home-responsive.css';

export const loadHomeRoute = () => import('./HomeView.vue');
export { useHomeMotion } from './internal/useHomeMotion';
export {
  syncHomeLocationFromWeather,
  useHomeLifecycle
} from './internal/useHomeLifecycle';
