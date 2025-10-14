<script setup lang="ts">
import { Scan } from 'lucide-vue-next';

defineProps<{
  size?: number;
}>();
</script>

<template>
  <div class="scan-loader" :style="{ '--size': `${size || 16}px` }">
    <Scan class="h-4 w-4 animate-spin text-sky-700" />
  </div>
</template>

<style scoped>
.scan-loader {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--size) * 0.125);
  height: var(--size);
}
</style>
