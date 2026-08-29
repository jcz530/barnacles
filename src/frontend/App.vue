<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { onKeyStroke } from '@vueuse/core';
import { useColorInversion } from '@/composables/useColorInversion';
import { useTheme } from '@/composables/useTheme';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
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

// Initialize auto-updater
const { updateState, downloadUpdate, installUpdate, dismissUpdate } = useUpdater();

// Listen for navigation requests from tray popup (set up immediately, not in onMounted)
let unsubscribeNav: (() => void) | undefined;

if (window.electron?.onNavigateToProject) {
  unsubscribeNav = window.electron.onNavigateToProject((path: string) => {
    router.push(path);
  });
}

// Global keyboard shortcut for Cmd+F / Ctrl+F - send to main process to toggle overlay
onKeyStroke('f', e => {
  if (e.metaKey || e.ctrlKey) {
    // Let a focused code editor keep Cmd+F for its own in-document search;
    // the app-wide find overlay cannot search an unrendered CodeMirror buffer.
    if ((e.target as HTMLElement | null)?.closest?.('.cm-editor')) return;
    e.preventDefault();
    window.electron.find.toggle();
  }
});

onMounted(() => {
  // Connect to WebSocket to check for active scans and receive updates
  connectScanWebSocket();
});

// Clean up listener on unmount
onUnmounted(() => {
  unsubscribeNav?.();
});
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <!--
      Outside #app so no stacking context inside the app tree can trap it below
      a dialog. Dialogs portal to the end of `body`, so the toaster has to be a
      sibling of that portal to stay clickable above one.
    -->
    <Toaster position="bottom-center" :closeButton="true" />

    <div id="app">
      <UpdateNotification
        :update-state="updateState"
        @download="downloadUpdate"
        @install="installUpdate"
        @dismiss="dismissUpdate"
      />
      <router-view />
    </div>
  </TooltipProvider>
</template>

<style>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
