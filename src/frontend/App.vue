<script setup lang="ts">
import { onMounted } from 'vue';
import { useColorInversion } from '@/composables/useColorInversion';
import { Toaster } from '@/components/ui/sonner';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { useFirstRunDetection } from '@/composables/useFirstRunDetection';
import { useUpdater } from '@/composables/useUpdater';
import UpdateNotification from '@/components/organisms/UpdateNotification.vue';
import 'vue-sonner/style.css'; // vue-sonner v2 requires this import

// App now uses router-view for rendering pages

// Set up dark mode with automatic color inversion
useColorInversion();

// Initialize WebSocket connection for project scanning (global across all pages)
const { connect: connectScanWebSocket } = useProjectScanWebSocket();

// Initialize first-run detection
const { checkFirstRun } = useFirstRunDetection();

// Initialize auto-updater
const { updateState, downloadUpdate, installUpdate, dismissUpdate } = useUpdater();

onMounted(() => {
  // Connect to WebSocket to check for active scans and receive updates
  connectScanWebSocket();

  // Check if this is the first run and trigger scan if needed
  checkFirstRun();
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
