import { createRouter, createWebHashHistory, createWebHistory, RouteRecordRaw } from 'vue-router';
import DefaultLayout from '../layouts/DefaultLayout.vue';
import ProjectOverviewTab from '../components/projects/organisms/ProjectOverviewTab.vue';
import ProjectReadmeTab from '../components/projects/organisms/ProjectReadmeTab.vue';
import ProjectTerminalsTab from '../components/projects/organisms/ProjectTerminalsTab.vue';
import ProjectFilesTab from '../components/projects/organisms/ProjectFilesTab.vue';
import ProjectRelatedFilesTab from '../components/projects/organisms/ProjectRelatedFilesTab.vue';
import Aliases from '../views/Aliases.vue';
import ConfigFilesPage from '../pages/ConfigFilesPage.vue';
import Home from '../views/Home.vue';
import Hosts from '../views/Hosts.vue';
import PresetPacks from '../views/PresetPacks.vue';
import ProjectDetail from '../views/ProjectDetail.vue';
import Projects from '../views/Projects.vue';
import Settings from '../views/Settings.vue';
import Terminals from '../views/Terminals.vue';
import UpdateTest from '../views/UpdateTest.vue';
import TrayPopup from '../views/TrayPopup.vue';

const routes: RouteRecordRaw[] = [
  // Tray popup route (no layout)
  {
    path: '/tray-popup',
    name: 'TrayPopup',
    component: TrayPopup,
  },
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
            path: 'files',
            name: 'ProjectFiles',
            component: ProjectFilesTab,
          },
          {
            path: 'terminals',
            name: 'ProjectTerminals',
            component: ProjectTerminalsTab,
          },
          {
            path: 'related-files',
            name: 'ProjectRelatedFiles',
            component: ProjectRelatedFilesTab,
          },
        ],
      },
      {
        path: '/terminals',
        name: 'Terminals',
        component: Terminals,
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
      {
        path: '/aliases',
        name: 'Aliases',
        component: Aliases,
      },
      {
        path: '/aliases/presets',
        name: 'PresetPacks',
        component: PresetPacks,
      },
      {
        path: '/configs',
        name: 'ConfigFiles',
        component: ConfigFilesPage,
      },
      {
        path: '/update-test',
        name: 'UpdateTest',
        component: UpdateTest,
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
