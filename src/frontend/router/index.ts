import Users from '@/views/Users.vue';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import DefaultLayout from '../layouts/DefaultLayout.vue';
import Api from '../views/Api.vue';
import Home from '../views/Home.vue';

const routes = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: Home,
      },
      {
        path: '/api',
        name: 'API',
        component: Api,
      },
      {
        path: '/users',
        name: 'Users',
        component: Users,
      },
    ],
  },
];

const router = createRouter({
  history: import.meta.env.DEV ? createWebHistory() : createWebHashHistory(),
  routes,
});

export default router;
