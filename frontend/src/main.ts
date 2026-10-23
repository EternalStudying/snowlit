import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
// LXGW WenKai, self-hosted and split by character range: a page downloads only the glyphs it shows.
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css';
import './styles.css';

createApp(App).use(router).mount('#app');
