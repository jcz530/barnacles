<script setup lang="ts">
import TitleBar from '@/components/nav/molecules/TitleBar.vue';
import { useColorInversion } from '@/composables/useColorInversion';

// App now uses router-view for rendering pages

// Set up dark mode with automatic color inversion
useColorInversion();
</script>

<template>
  <div id="app">
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
