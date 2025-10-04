<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar';

import NavMain from '@/components/nav/molecules/NavMain.vue';
import NavSecondary from '@/components/nav/molecules/NavSecondary.vue';
import NavUser from '@/components/nav/molecules/NavUser.vue';
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
import { useQuery } from '@tanstack/vue-query';
import { Command, FolderGit2, LifeBuoy, Send, SquareTerminal } from 'lucide-vue-next';
import { computed } from 'vue';
import { API_ROUTES } from '../../../../shared/constants';

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
});

const config = useConfigs();
const { apiCall } = useApi();

// Fetch current OS user
const { data: currentUser } = useQuery({
  queryKey: ['currentUser'],
  queryFn: () => apiCall('GET', API_ROUTES.USERS_CURRENT),
});

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
      isActive: true,
    },
    {
      title: 'Projects',
      url: '/projects',
      icon: FolderGit2,
    },
    {
      title: 'Terminals',
      url: '/terminals',
      icon: SquareTerminal,
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
    {
      title: 'Developer',
      url: '#',
      icon: LifeBuoy,
    },
    {
      title: 'Feedback',
      url: '#',
      icon: Send,
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
          <SidebarMenuButton size="lg" as-child>
            <RouterLink to="/">
              <div
                class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
              >
                <Command class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{{ config.appName }}</span>
                <span class="truncate text-xs"></span>
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
      <NavUser :user="data.user" />
    </SidebarFooter>
  </Sidebar>
</template>
