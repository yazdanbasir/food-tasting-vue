import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ConfirmationView from '../views/ConfirmationView.vue'
import OrganizerLoginView from '../views/OrganizerLoginView.vue'
import OrganizerDashboardView from '../views/OrganizerDashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/confirmation/:accessCode',
      name: 'confirmation',
      component: ConfirmationView,
    },
    {
      path: '/organizer/login',
      name: 'organizer-login',
      component: OrganizerLoginView,
    },
    {
      path: '/organizer',
      name: 'organizer',
      component: OrganizerDashboardView,
    },
  ],
})

export default router
