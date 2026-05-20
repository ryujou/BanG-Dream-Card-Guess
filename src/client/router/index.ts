import { createRouter, createWebHistory } from 'vue-router';
import { useGameStore } from '../stores/game';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/player',
      name: 'player',
      component: () => import('../views/PlayerView.vue'),
    },
    {
      path: '/play',
      redirect: '/player',
    },
    {
      path: '/solo',
      name: 'solo',
      component: () => import('../views/SoloView.vue'),
    },
    {
      path: '/host',
      name: 'host',
      component: () => import('../views/HostView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/qr',
      name: 'qr',
      component: () => import('../views/QrView.vue'),
    },
    {
      path: '/diagnostics',
      name: 'diagnostics',
      component: () => import('../views/DiagnosticsView.vue'),
    },
    {
      path: '/scores',
      name: 'scores',
      component: () => import('../views/ScoresView.vue'),
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../views/StatsView.vue'),
    },
    {
      path: '/note-shooter',
      name: 'note-shooter',
      component: () => import('../views/NoteShooterView.vue'),
    },
    {
      path: '/queue',
      redirect: '/note-shooter',
    },
    {
      path: '/games/stopwatch-challenge',
      name: 'stopwatch-challenge',
      component: () => import('../views/StopwatchChallengeView.vue'),
    },
    {
      path: '/stopwatch-challenge',
      redirect: '/games/stopwatch-challenge',
    },
    {
      path: '/games/bang-klotski',
      name: 'bang-klotski',
      component: () => import('../views/BangKlotskiView.vue'),
    },
    {
      path: '/community-admin',
      name: 'community-admin',
      component: () => import('../views/CommunityAdminView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    }
  ]
});

router.afterEach((to) => {
  const gameStore = useGameStore();
  const wsRoles = ['player', 'solo', 'host', 'settings'];
  if (wsRoles.includes(to.name as string)) {
    gameStore.connect(to.name as string);
  } else {
    // If navigating to a non-ws page, maybe we shouldn't disconnect right away or we should.
    // main.js behavior: "if (![...].includes(route)) connect()"
    // Actually main.js says: if (!["home", "login", "qr", "note-shooter", "scores", "community-admin", "stopwatch-challenge", "bang-klotski"].includes(route)) connect();
    // Meaning home/login/qr/etc DO NOT connect.
    gameStore.disconnect();
  }
});

export default router;
