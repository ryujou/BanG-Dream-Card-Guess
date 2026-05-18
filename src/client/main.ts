import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

import './styles/base.css';
import './styles/layout.css';
import './styles/game.css';
import './styles/settings.css';
import './styles/qr.css';
import './styles/diagnostics.css';
import './styles/scores.css';
import './styles/mini-games.css';
import './styles/legacy.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
