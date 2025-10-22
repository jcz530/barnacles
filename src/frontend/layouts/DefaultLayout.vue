<script setup lang="ts">
import NavBreadcrumbs from '@/components/nav/molecules/NavBreadcrumbs.vue';
import { provideBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useHotkeys } from '@/composables/useHotkeys';
import AppSidebar from '../components/nav/organisms/AppSidebar.vue';
import { Separator } from '../components/ui/separator';
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar';
import TitleBar from '@/components/nav/molecules/TitleBar.vue';

provideBreadcrumbs();
useHotkeys();
</script>

<template>
  <div class="app-content">
    <SidebarProvider class="flex-1">
      <TitleBar />
      <AppSidebar class="pt-10" />
      <SidebarInset>
        <header class="flex h-16 shrink-0 items-center gap-2">
          <div class="flex items-center gap-2 px-4">
            <NavBreadcrumbs />
          </div>
        </header>
        <Separator class="bg-slate-700 opacity-20" />
        <main class="flex flex-1 flex-col gap-4 p-4 pt-0">
          <router-view />
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
