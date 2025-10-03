<script setup lang="ts">
import NavBreadcrumbs from '@/components/nav/molecules/NavBreadcrumbs.vue';
import { provideBreadcrumbs } from '@/composables/useBreadcrumbs';
import AppSidebar from '../components/nav/organisms/AppSidebar.vue';
import { Separator } from '../components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../components/ui/sidebar';

provideBreadcrumbs();
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-16 shrink-0 items-center gap-2">
        <div class="flex items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1" />
          <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
          <NavBreadcrumbs />
        </div>
      </header>
      <main class="flex flex-1 flex-col gap-4 p-4 pt-0">
        <router-view />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>
.layout {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #2c3e50;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.main-content {
  min-height: calc(100vh - 200px);
  padding-top: 6rem;
}
</style>
