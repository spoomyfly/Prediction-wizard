import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history avoids 404s on GitHub Pages when a deep link is refreshed
// (Pages has no server-side rewrite to index.html).
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/:competitionId/strength',
      name: 'strength',
      component: () => import('../views/StrengthView.vue'),
      props: true,
    },
    {
      path: '/:competitionId',
      name: 'competition',
      component: () => import('../views/CompetitionView.vue'),
      props: true,
    },
  ],
})

export default router
