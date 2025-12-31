<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { onKeyStroke } from '@vueuse/core';
import { useColorInversion } from '@/composables/useColorInversion';
import { useTheme } from '@/composables/useTheme';
import { Toaster } from '@/components/ui/sonner';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { useUpdater } from '@/composables/useUpdater';
import UpdateNotification from '@/components/organisms/UpdateNotification.vue';
import FindOverlay from '@/components/organisms/FindOverlay.vue';
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

// Initialize auto-updater
const { updateState, downloadUpdate, installUpdate, dismissUpdate } = useUpdater();

// Find overlay state
const showFindOverlay = ref(false);

// Listen for navigation requests from tray popup (set up immediately, not in onMounted)
let unsubscribeNav: (() => void) | undefined;
let unsubscribeFind: (() => void) | undefined;

if (window.electron?.onNavigateToProject) {
  unsubscribeNav = window.electron.onNavigateToProject((projectId: string) => {
    router.push(`/projects/${projectId}`);
  });
}

if (window.electron?.onToggleFind) {
  unsubscribeFind = window.electron.onToggleFind(() => {
    showFindOverlay.value = !showFindOverlay.value;
  });
}

// Global keyboard shortcut for Cmd+F / Ctrl+F using VueUse
onKeyStroke('f', e => {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    showFindOverlay.value = !showFindOverlay.value;
  }
});

onMounted(() => {
  // Connect to WebSocket to check for active scans and receive updates
  connectScanWebSocket();
});

// Clean up listener on unmount
onUnmounted(() => {
  unsubscribeNav?.();
  unsubscribeFind?.();
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
    <FindOverlay :show="showFindOverlay" @close="showFindOverlay = false" />
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
