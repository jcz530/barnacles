<script setup lang="ts">
import { useColorInversion } from '@/composables/useColorInversion';

// App now uses router-view for rendering pages

// Set up dark mode with automatic color inversion
useColorInversion();
</script>

<template>
  <div id="app">
    <router-view />
  </div>
</template>

<style>
#app {
  min-height: 100vh;
}
</style>
