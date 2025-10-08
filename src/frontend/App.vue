<script setup lang="ts">
import { useDark } from '@vueuse/core';

// App now uses router-view for rendering pages

// Set up dark mode
useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: 'light',
});
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
