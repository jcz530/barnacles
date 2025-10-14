<script setup lang="ts">
import { useColorInversion } from '@/composables/useColorInversion';
import { Toaster } from '@/components/ui/sonner';
import 'vue-sonner/style.css'; // vue-sonner v2 requires this import

// App now uses router-view for rendering pages

// Set up dark mode with automatic color inversion
useColorInversion();
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
