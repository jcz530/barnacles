<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar';

import LogoMark from '@/assets/logo-mark.svg';
import NavMain from '@/components/nav/molecules/NavMain.vue';
import NavSecondary from '@/components/nav/molecules/NavSecondary.vue';
import NavUser from '@/components/nav/molecules/NavUser.vue';
import ThemeToggle from '@/components/nav/molecules/ThemeToggle.vue';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useApi } from '@/composables/useApi';
import { useConfigs } from '@/composables/useConfigs';
import { useQueries } from '@/composables/useQueries';
import { useQuery } from '@tanstack/vue-query';
import { Cog, FileText, FolderGit2, Network, SquareTerminal, Terminal } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { API_ROUTES } from '../../../../shared/constants';

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
});

const config = useConfigs();
const { apiCall } = useApi();
const queries = useQueries();
const route = useRoute();

// Fetch current OS user
const { data: currentUser } = useQuery({
  queryKey: ['currentUser'],
  queryFn: () => apiCall('GET', API_ROUTES.USERS_CURRENT),
});

// Fetch projects and processes for counts
const { data: projects } = queries.useProjectsQuery({ enabled: true });
const { data: processes } = queries.useProcessesQuery();

const data = computed(() => ({
  user: currentUser.value || {
    name: 'User',
    email: 'user@local',
    avatar: '',
    initials: 'US',
  },
  navMain: [
    {
      title: 'Dashboard',
      url: '/',
      icon: SquareTerminal,
      isActive: route.path === '/',
    },
    {
      title: 'Projects',
      url: '/projects',
      icon: FolderGit2,
      count: projects.value?.length ?? 0,
      isActive: route.path.startsWith('/projects'),
    },
    {
      title: 'Processes',
      url: '/terminals',
      icon: SquareTerminal,
      count: processes.value?.length ?? 0,
      isActive: route.path.startsWith('/terminals'),
    },
    // {
    //   title: 'Users',
    //   url: '/users',
    //   icon: Bot,
    // },
    // {
    //   title: 'API',
    //   url: '/api',
    //   icon: BookOpen,
    // },
    // {
    //   title: 'Settings',
    //   url: '#',
    //   icon: Settings2,
    //   items: [
    //     {
    //       title: 'General',
    //       url: '#',
    //     },
    //     {
    //       title: 'Team',
    //       url: '#',
    //     },
    //     {
    //       title: 'Billing',
    //       url: '#',
    //     },
    //     {
    //       title: 'Limits',
    //       url: '#',
    //     },
    //   ],
    // },
  ],
  navSecondary: [
    // {
    //   title: 'Developer',
    //   url: '#',
    //   icon: LifeBuoy,
    // },
    {
      title: 'Hosts',
      url: '/hosts',
      icon: Network,
      isActive: route.path.startsWith('/hosts'),
    },
    {
      title: 'Aliases',
      url: '/aliases',
      icon: Terminal,
      isActive: route.path.startsWith('/aliases'),
    },
    {
      title: 'Config Files',
      url: '/configs',
      icon: FileText,
      isActive: route.path.startsWith('/configs'),
    },
    {
      title: 'Settings',
      url: '/settings',
      icon: Cog,
      isActive: route.path.startsWith('/settings'),
    },
  ],
  // projects: [
  //   {
  //     name: 'Other Section',
  //     url: '#',
  //     icon: Frame,
  //   },
  // ],
}));
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton class="hover:bg-sidebar" size="lg" as-child>
            <RouterLink to="/">
              <div
                class="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
              >
                <img :src="LogoMark" alt="Logo" class="size-8" />
              </div>
              <div class="ml-2 grid flex-1 text-left text-lg leading-tight text-slate-600">
                <span class="truncate font-semibold">{{ config.appName }}</span>
                <!-- <span class="truncate text-xs"></span> -->
              </div>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" />
      <!-- <NavProjects :projects="data.projects" /> -->
      <NavSecondary :items="data.navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <ThemeToggle />
      <NavUser :user="data.user" />
    </SidebarFooter>
  </Sidebar>
</template>
