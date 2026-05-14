import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// @ts-ignore
import './styles/base.css';
// @ts-ignore
import './styles/layout.css';
// @ts-ignore
import './styles/game.css';
// @ts-ignore
import './styles/settings.css';
// @ts-ignore
import './styles/qr.css';
// @ts-ignore
import './styles/scores.css';
// @ts-ignore
import './styles/mini-games.css';
// @ts-ignore
import './styles/legacy.css';

// @ts-ignore
// import '../web/styles.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
