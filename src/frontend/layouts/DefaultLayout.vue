<script setup lang="ts">
import NavBreadcrumbs from '@/components/nav/molecules/NavBreadcrumbs.vue';
import { provideBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useHotkeys } from '@/composables/useHotkeys';
import AppSidebar from '../components/nav/organisms/AppSidebar.vue';
import SettingsSidebar from '../components/settings/organisms/SettingsSidebar.vue';
import { Separator } from '../components/ui/separator';
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar';
import TitleBar from '@/components/nav/molecules/TitleBar.vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

provideBreadcrumbs();
useHotkeys();

const route = useRoute();

/*
 * Settings swaps the app rail for its own section nav, the way a preferences
 * window replaces what is beside it rather than nesting inside it. Both are
 * plain `Sidebar` shells in the same slot, so `SidebarProvider` -- and the
 * Cmd+B collapse it owns -- is unaffected by the swap.
 */
const isSettingsRoute = computed(() => route.path.startsWith('/settings'));
</script>

<template>
  <div class="app-content">
    <SidebarProvider class="flex-1">
      <TitleBar />
      <SettingsSidebar v-if="isSettingsRoute" class="pt-10" />
      <AppSidebar v-else class="pt-10" />
      <!-- min-w-0: SidebarInset is a flex-1 child of a flex row, whose default
           min-width of auto refuses to shrink below its content. Without this a
           wide child (the year heatmap) stretches this pane and scrolls the whole
           app sideways instead of scrolling within its own card. -->
      <SidebarInset class="min-w-0">
        <header class="flex h-10 shrink-0 items-center gap-2">
          <div class="flex items-center gap-2 px-4">
            <NavBreadcrumbs />
          </div>
        </header>
        <Separator class="bg-slate-700 opacity-20" />
        <main class="flex flex-1 flex-col gap-4 p-4 pt-0">
          <router-view :key="$route.fullPath" />
        </main>
      </SidebarInset>
    </SidebarProvider>
  </div>
</template>

<style scoped>
.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 2.5rem; /* 40px - height of title bar */
}
</style>
