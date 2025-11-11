<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQueries } from '../composables/useQueries';
import TrayProjectItem from '../components/molecules/TrayProjectItem.vue';
import LogoMark from '@/components/nav/atoms/LogoMark.vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, MoreVertical, SquareDot, Star, Terminal, TerminalSquare } from 'lucide-vue-next';

const { useProjectsQuery, useOpenProjectMutation, useOpenTerminalMutation } = useQueries();

// Fetch all projects
const { data: allProjects, isLoading } = useProjectsQuery();

// Filter favorites and recent
const favoriteProjects = computed(() => {
  return allProjects.value?.filter(p => p.isFavorite).slice(0, 5) || [];
});

const recentProjects = computed(() => {
  return allProjects.value?.slice(0, 5) || [];
});

// Mutations
const openProjectMutation = useOpenProjectMutation();
const openTerminalMutation = useOpenTerminalMutation();

// Actions
const openInIDE = async (projectId: string) => {
  try {
    await openProjectMutation.mutateAsync({ projectId });
  } catch (error) {
    console.error('Failed to open project in IDE:', error);
  }
};

const openTerminal = async (projectId: string) => {
  try {
    await openTerminalMutation.mutateAsync({ projectId });
  } catch (error) {
    console.error('Failed to open terminal:', error);
  }
};

const openProject = async (projectId: string) => {
  try {
    // Show or create the main window
    const windowResult = await window.electron?.showOrCreateWindow();
    if (windowResult?.success) {
      // Navigate the main window to the project
      await window.electron?.navigateToProject(projectId);
      // Close the tray popup
      window.close();
    }
  } catch (error) {
    console.error('Failed to open project:', error);
  }
};

const showInApp = async () => {
  try {
    const result = await window.electron?.showOrCreateWindow();
    if (result?.success) {
      window.close();
    }
  } catch (error) {
    console.error('Failed to show in app:', error);
  }
};

const createNewWindow = async () => {
  try {
    await window.electron?.createNewWindow();
  } catch (error) {
    console.error('Failed to create new window:', error);
  }
};

const quitApp = async () => {
  try {
    await window.electron?.quitApp();
  } catch (error) {
    console.error('Failed to quit app:', error);
  }
};

// CLI installation state
const isCliInstalled = ref(false);

const checkCliInstallation = async () => {
  try {
    isCliInstalled.value = await window.electron?.cli.isInstalled();
  } catch (error) {
    console.error('Failed to check CLI installation:', error);
  }
};

const installCli = async () => {
  try {
    const result = await window.electron?.cli.install();
    if (result?.success) {
      isCliInstalled.value = true;
    } else {
      console.error('Failed to install CLI:', result?.error);
    }
  } catch (error) {
    console.error('Failed to install CLI:', error);
  }
};

const uninstallCli = async () => {
  try {
    const result = await window.electron?.cli.uninstall();
    if (result?.success) {
      isCliInstalled.value = false;
    } else {
      console.error('Failed to uninstall CLI:', result?.error);
    }
  } catch (error) {
    console.error('Failed to uninstall CLI:', error);
  }
};

// Add tray-popup class to body on mount
onMounted(() => {
  document.body.classList.add('tray-popup');
  checkCliInstallation();
});
</script>

<template>
  <div class="flex h-full w-full items-start justify-center bg-transparent p-2">
    <div class="relative w-full overflow-hidden rounded-xl">
      <!-- Header -->
      <div class="px-3 py-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <LogoMark :width="20" :height="20" />
            <span>Barnacles</span>
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              @click="showInApp"
              class="flex items-center justify-center rounded-md bg-black/5 p-1.5 text-slate-900 transition-all hover:scale-105 hover:bg-black/10 active:scale-95"
              title="Open Barnacles"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="2" />
                <line x1="9" y1="3" x2="9" y2="21" stroke-width="2" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              @click="createNewWindow"
              class="flex items-center justify-center rounded-md bg-black/5 p-1.5 text-slate-900 transition-all hover:scale-105 hover:bg-black/10 active:scale-95"
              title="New Window"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 5v14M5 12h14"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="flex items-center justify-center rounded-md bg-black/5 p-1.5 text-slate-900 transition-all hover:scale-105 hover:bg-black/10 active:scale-95"
                  title="More actions"
                >
                  <MoreVertical :size="14" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-56">
                <DropdownMenuItem v-if="!isCliInstalled" @click="installCli">
                  <Terminal :size="16" class="mr-2" />
                  <span>Install CLI Command</span>
                </DropdownMenuItem>
                <DropdownMenuItem v-if="isCliInstalled" @click="uninstallCli">
                  <TerminalSquare :size="16" class="mr-2" />
                  <span>Uninstall CLI Command</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @click="quitApp">
                  <LogOut :size="16" class="mr-2" />
                  <span>Quit Barnacles</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div
        class="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-black/20 hover:scrollbar-thumb-black/30 max-h-[400px] overflow-y-auto p-2"
      >
        <!-- Loading state -->
        <div
          v-if="isLoading"
          class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-slate-600"
        >
          <div class="loading-spinner"></div>
          <p>Loading projects...</p>
        </div>

        <!-- Projects -->
        <div v-else>
          <!-- Favorites Section -->
          <div v-if="favoriteProjects.length > 0" class="mb-3">
            <h3
              class="mx-2 mb-1.5 flex gap-2 text-[11px] font-semibold tracking-wide text-slate-600 uppercase"
            >
              <Star class="h-4 w-4" /> Favorites
            </h3>
            <div class="flex flex-col gap-0.5">
              <TrayProjectItem
                v-for="project in favoriteProjects"
                :key="project.id"
                :project="project"
                @open-project="openProject"
                @open-in-i-d-e="openInIDE"
                @open-terminal="openTerminal"
              />
            </div>
          </div>

          <!-- Recent Section -->
          <div v-if="recentProjects.length > 0" class="mb-3">
            <h3
              class="mx-2 mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-600 uppercase"
            >
              <SquareDot class="h-4 w-4" /> Recent
            </h3>
            <div class="flex flex-col gap-0.5">
              <TrayProjectItem
                v-for="project in recentProjects"
                :key="project.id"
                :project="project"
                @open-project="openProject"
                @open-in-i-d-e="openInIDE"
                @open-terminal="openTerminal"
              />
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-if="favoriteProjects.length === 0 && recentProjects.length === 0"
            class="flex flex-col items-center justify-center gap-4 px-6 py-12 text-slate-600"
          >
            <p>No projects yet</p>
            <button
              @click="showInApp"
              class="cursor-pointer rounded-lg border-none bg-gradient-to-br from-cyan-400 to-pink-400 px-4 py-2 text-[13px] font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(2,221,255,0.3)]"
            >
              Open Barnacles
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Transparent theme for tray popup - scoped to .tray-popup class */
body.tray-popup {
  background: transparent !important;
}

body.tray-popup #app {
  background: transparent !important;
}

/* Override CSS variables only for tray popup */
body.tray-popup {
  --background: transparent;
  --popover: transparent;
}
</style>

<style scoped>
/* Loading spinner animation (only thing that can't be done with Tailwind) */
.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: #02ddff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
