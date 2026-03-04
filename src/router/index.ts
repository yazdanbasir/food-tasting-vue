import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const ConfirmationView = () => import('../views/ConfirmationView.vue')
const OrganizerDashboardView = () => import('../views/OrganizerDashboardView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/confirmation',
      name: 'confirmation',
      component: ConfirmationView,
    },
    {
      path: '/organizer',
      name: 'organizer',
      component: OrganizerDashboardView,
    },
  ],
})

export default router
