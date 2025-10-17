import Users from '@/views/Users.vue';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import DefaultLayout from '../layouts/DefaultLayout.vue';
import ProjectOverviewTab from '../components/organisms/ProjectOverviewTab.vue';
import ProjectReadmeTab from '../components/organisms/ProjectReadmeTab.vue';
import ProjectTerminalsTab from '../components/organisms/ProjectTerminalsTab.vue';
import Api from '../views/Api.vue';
import Home from '../views/Home.vue';
import Hosts from '../views/Hosts.vue';
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
        redirect: { name: 'ProjectOverview' },
        children: [
          {
            path: 'overview',
            name: 'ProjectOverview',
            component: ProjectOverviewTab,
          },
          {
            path: 'readme',
            name: 'ProjectReadme',
            component: ProjectReadmeTab,
          },
          {
            path: 'terminals',
            name: 'ProjectTerminals',
            component: ProjectTerminalsTab,
          },
        ],
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
      {
        path: '/hosts',
        name: 'Hosts',
        component: Hosts,
      },
    ],
  },
];

const router = createRouter({
  history: import.meta.env.DEV ? createWebHistory() : createWebHashHistory(),
  routes,
});

// Update document title and window title on route changes
router.afterEach(to => {
  const pageTitle = (to.name as string) || 'Barnacles';
  document.title = pageTitle;

  // Notify Electron to update window title
  if (window.electron?.updateWindowTitle) {
    window.electron.updateWindowTitle(pageTitle);
  }
});

export default router;
