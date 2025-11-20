import { createRouter, createWebHashHistory, createWebHistory, RouteRecordRaw } from 'vue-router';
import DefaultLayout from '../layouts/DefaultLayout.vue';
import ProjectOverviewTab from '../components/projects/organisms/ProjectOverviewTab.vue';
import ProjectReadmeTab from '../components/projects/organisms/ProjectReadmeTab.vue';
import ProjectTerminalsTab from '../components/projects/organisms/ProjectTerminalsTab.vue';
import ProjectFilesTab from '../components/projects/organisms/ProjectFilesTab.vue';
import ProjectRelatedFilesTab from '../components/projects/organisms/ProjectRelatedFilesTab.vue';
import ProjectAccountsTab from '../components/projects/organisms/ProjectAccountsTab.vue';
import Aliases from '../views/Aliases.vue';
import ConfigFilesPage from '../pages/ConfigFilesPage.vue';
import Home from '../views/Home.vue';
import Hosts from '../views/Hosts.vue';
import PresetPacks from '../views/PresetPacks.vue';
import ProjectDetail from '../views/ProjectDetail.vue';
import Projects from '../views/Projects.vue';
import Settings from '../views/Settings.vue';
import Terminals from '../views/Terminals.vue';
import Themes from '../views/Themes.vue';
import ThemeEditor from '../views/ThemeEditor.vue';
import UpdateTest from '../views/UpdateTest.vue';
import TrayPopup from '../views/TrayPopup.vue';
import Utilities from '../views/Utilities.vue';
import DesignSystem from '../views/DesignSystem.vue';
import AccountForm from '../views/AccountForm.vue';

// Define route names as a const object for type-safe references
export const RouteNames = {
  TrayPopup: 'TrayPopup',
  Home: 'Home',
  Projects: 'Projects',
  ProjectDetail: 'ProjectDetail',
  ProjectOverview: 'ProjectOverview',
  ProjectReadme: 'ProjectReadme',
  ProjectFiles: 'ProjectFiles',
  ProjectTerminals: 'ProjectTerminals',
  ProjectRelatedFiles: 'ProjectRelatedFiles',
  ProjectAccounts: 'ProjectAccounts',
  ProjectAccountNew: 'ProjectAccountNew',
  ProjectAccountEdit: 'ProjectAccountEdit',
  Terminals: 'Terminals',
  Settings: 'Settings',
  Themes: 'Themes',
  ThemeEdit: 'ThemeEdit',
  ThemeNew: 'ThemeNew',
  Hosts: 'Hosts',
  Aliases: 'Aliases',
  PresetPacks: 'PresetPacks',
  ConfigFiles: 'ConfigFiles',
  Utilities: 'Utilities',
  UtilityDetail: 'UtilityDetail',
  UpdateTest: 'UpdateTest',
  DesignSystem: 'DesignSystem',
} as const;

export type RouteName = (typeof RouteNames)[keyof typeof RouteNames];

const routes: RouteRecordRaw[] = [
  // Tray popup route (no layout)
  {
    path: '/tray-popup',
    name: RouteNames.TrayPopup,
    component: TrayPopup,
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: RouteNames.Home,
        component: Home,
      },
      {
        path: '/projects',
        name: RouteNames.Projects,
        component: Projects,
      },
      {
        path: '/projects/:id',
        name: RouteNames.ProjectDetail,
        component: ProjectDetail,
        redirect: { name: RouteNames.ProjectOverview },
        children: [
          {
            path: 'overview',
            name: RouteNames.ProjectOverview,
            component: ProjectOverviewTab,
          },
          {
            path: 'readme',
            name: RouteNames.ProjectReadme,
            component: ProjectReadmeTab,
          },
          {
            path: 'files',
            name: RouteNames.ProjectFiles,
            component: ProjectFilesTab,
          },
          {
            path: 'terminals',
            name: RouteNames.ProjectTerminals,
            component: ProjectTerminalsTab,
          },
          {
            path: 'related-files',
            name: RouteNames.ProjectRelatedFiles,
            component: ProjectRelatedFilesTab,
          },
          {
            path: 'accounts',
            name: RouteNames.ProjectAccounts,
            component: ProjectAccountsTab,
          },
          {
            path: 'accounts/new',
            name: RouteNames.ProjectAccountNew,
            component: AccountForm,
          },
          {
            path: 'accounts/:accountId/edit',
            name: RouteNames.ProjectAccountEdit,
            component: AccountForm,
          },
        ],
      },
      {
        path: '/terminals',
        name: RouteNames.Terminals,
        component: Terminals,
      },
      {
        path: '/settings',
        name: RouteNames.Settings,
        component: Settings,
      },
      {
        path: '/themes',
        name: RouteNames.Themes,
        component: Themes,
      },
      {
        path: '/themes/:id/edit',
        name: RouteNames.ThemeEdit,
        component: ThemeEditor,
      },
      {
        path: '/themes/new',
        name: RouteNames.ThemeNew,
        component: ThemeEditor,
      },
      {
        path: '/hosts',
        name: RouteNames.Hosts,
        component: Hosts,
      },
      {
        path: '/aliases',
        name: RouteNames.Aliases,
        component: Aliases,
      },
      {
        path: '/aliases/presets',
        name: RouteNames.PresetPacks,
        component: PresetPacks,
      },
      {
        path: '/configs',
        name: RouteNames.ConfigFiles,
        component: ConfigFilesPage,
      },
      {
        path: '/utilities',
        name: RouteNames.Utilities,
        component: Utilities,
      },
      {
        path: '/utilities/:utilityId',
        name: RouteNames.UtilityDetail,
        component: () => import('../views/utilities/UtilityDetailWrapper.vue'),
      },
      {
        path: '/update-test',
        name: RouteNames.UpdateTest,
        component: UpdateTest,
      },
      // Dev-only route for design system
      ...(import.meta.env.DEV
        ? [
            {
              path: '/design-system',
              name: RouteNames.DesignSystem,
              component: DesignSystem,
            },
          ]
        : []),
    ],
  },
];

const router = createRouter({
  history: import.meta.env.DEV ? createWebHistory() : createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // If the user navigated with back/forward buttons, restore saved position
    if (savedPosition) {
      return savedPosition;
    }
    // If navigating to a hash anchor, scroll to that anchor
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      };
    }
    // Otherwise, always scroll to top
    return { top: 0, left: 0 };
  },
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
