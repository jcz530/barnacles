<script setup lang="ts">
import { onMounted } from 'vue';
import { useColorInversion } from '@/composables/useColorInversion';
import { Toaster } from '@/components/ui/sonner';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { useFirstRunDetection } from '@/composables/useFirstRunDetection';
import 'vue-sonner/style.css'; // vue-sonner v2 requires this import

// App now uses router-view for rendering pages

// Set up dark mode with automatic color inversion
useColorInversion();

// Initialize WebSocket connection for project scanning (global across all pages)
const { connect: connectScanWebSocket } = useProjectScanWebSocket();

// Initialize first-run detection
const { checkFirstRun } = useFirstRunDetection();

onMounted(() => {
  // Connect to WebSocket to check for active scans and receive updates
  connectScanWebSocket();

  // Check if this is the first run and trigger scan if needed
  checkFirstRun();
});
</script>

<template>
  <div id="app">
    <Toaster position="bottom-center" />
    <div class="app-content">
      <router-view />
    </div>
  </div>
</template>

<style>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 2.5rem; /* 40px - height of title bar */
}
</style>
