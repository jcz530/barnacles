import Users from '@/views/Users.vue';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import DefaultLayout from '../layouts/DefaultLayout.vue';
import Api from '../views/Api.vue';
import Home from '../views/Home.vue';
import ProjectDetail from '../views/ProjectDetail.vue';
import Projects from '../views/Projects.vue';
import Settings from '../views/Settings.vue';
import Terminals from '../views/Terminals.vue';

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
        path: '/projects',
        name: 'Projects',
        component: Projects,
      },
      {
        path: '/projects/:id',
        name: 'ProjectDetail',
        component: ProjectDetail,
      },
      {
        path: '/terminals',
        name: 'Terminals',
        component: Terminals,
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
      {
        path: '/settings',
        name: 'Settings',
        component: Settings,
      },
    ],
  },
];

const router = createRouter({
  history: import.meta.env.DEV ? createWebHistory() : createWebHashHistory(),
  routes,
});

export default router;
