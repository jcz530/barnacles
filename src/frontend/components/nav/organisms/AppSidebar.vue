<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { RouteNames } from '@/router';
import NavMain from '@/components/nav/molecules/NavMain.vue';
import NavSecondary from '@/components/nav/molecules/NavSecondary.vue';
import NavUser from '@/components/nav/molecules/NavUser.vue';
import ThemeToggle from '@/components/nav/molecules/ThemeToggle.vue';
import { useApi } from '@/composables/useApi';
import { useQueries } from '@/composables/useQueries';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { API_ROUTES } from '../../../../shared/constants';
import { NAV_MAIN, NAV_SECONDARY } from '@/constants/navigation';

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
});

const { apiCall } = useApi();
const queries = useQueries();
const route = useRoute();

// Fetch current OS user
const { data: currentUser } = useQuery({
  queryKey: ['currentUser'],
  queryFn: () =>
    apiCall<{ name: string; email: string; avatar: string; initials: string }>(
      'GET',
      API_ROUTES.USERS_CURRENT
    ),
});

// Fetch projects and processes for counts
const { data: projects } = queries.useProjectsQuery({ enabled: true });
const { data: processes } = queries.useProcessesQuery();
const favorites = computed(() =>
  (projects.value ?? [])
    .filter(project => project.isFavorite)
    .slice(0, 4)
    .map(project => {
      return {
        title: project.name,
        url: { name: RouteNames.ProjectOverview, params: { id: project.id } },
      };
    })
);

const data = computed(() => ({
  user: currentUser.value || {
    name: 'User',
    email: 'user@local',
    avatar: '',
    initials: 'US',
  },
  navMain: NAV_MAIN.map(item => ({
    title: item.title,
    url: item.url,
    icon: item.icon,
    isActive: item.url === '/' ? route.path === '/' : route.path.startsWith(item.url),
    ...(item.url === '/projects'
      ? { count: projects.value?.length ?? 0, items: favorites.value }
      : {}),
    ...(item.url === '/terminals' ? { count: processes.value?.length ?? 0 } : {}),
  })),
  navSecondary: NAV_SECONDARY.map(item => ({
    title: item.title,
    url: item.url,
    icon: item.icon,
    isActive: route.path.startsWith(item.url),
  })),
  // projects: [
  //   {
  //     name: 'Other Section',
  //     url: '#',
  //     icon: Sparkles,
  //   },
  // ],
}));
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader />
    <SidebarContent>
      <NavMain :items="data.navMain" />
      <!--      <NavProjects :projects="data.projects" />-->
      <NavSecondary :items="data.navSecondary" label="System" class="mt-auto" />
      <ThemeToggle />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="data.user" />
    </SidebarFooter>
  </Sidebar>
</template>
