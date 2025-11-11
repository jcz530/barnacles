<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useColorInversion } from '@/composables/useColorInversion';
import { useTheme } from '@/composables/useTheme';
import { Toaster } from '@/components/ui/sonner';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { useFirstRunDetection } from '@/composables/useFirstRunDetection';
import { useUpdater } from '@/composables/useUpdater';
import UpdateNotification from '@/components/organisms/UpdateNotification.vue';
import 'vue-sonner/style.css'; // vue-sonner v2 requires this import

// App now uses router-view for rendering pages

// Router for navigation
const router = useRouter();

// Set up dark mode with automatic color inversion
const { reinitializeColors } = useColorInversion();

// Set up theming system
const { activeTheme } = useTheme();

// Re-initialize color inversion whenever the active theme changes
// This ensures dark mode works correctly with custom theme colors
watch(
  activeTheme,
  newTheme => {
    if (newTheme) {
      // Wait a tick for theme CSS variables to be applied
      setTimeout(() => {
        reinitializeColors();
      }, 50);
    }
  },
  { immediate: false }
);

// Initialize WebSocket connection for project scanning (global across all pages)
const { connect: connectScanWebSocket } = useProjectScanWebSocket();

// Initialize first-run detection
const { checkFirstRun } = useFirstRunDetection();

// Initialize auto-updater
const { updateState, downloadUpdate, installUpdate, dismissUpdate } = useUpdater();

// Listen for navigation requests from tray popup (set up immediately, not in onMounted)
let unsubscribe: (() => void) | undefined;

if (window.electron?.onNavigateToProject) {
  unsubscribe = window.electron.onNavigateToProject((projectId: string) => {
    router.push(`/projects/${projectId}`);
  });
}

onMounted(() => {
  // Connect to WebSocket to check for active scans and receive updates
  connectScanWebSocket();

  // Check if this is the first run and trigger scan if needed
  checkFirstRun();
});

// Clean up listener on unmount
onUnmounted(() => {
  unsubscribe?.();
});
</script>

<template>
  <div id="app">
    <Toaster position="bottom-center" :closeButton="true" />
    <UpdateNotification
      :update-state="updateState"
      @download="downloadUpdate"
      @install="installUpdate"
      @dismiss="dismissUpdate"
    />
    <router-view />
  </div>
</template>

<style>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
