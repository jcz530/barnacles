<script setup lang="ts">
import LoadingIndicator from '@/components/atoms/LoadingIndicator.vue';

defineProps<{
  size?: number;
}>();
</script>

<template>
  <div class="logo-loader" :style="{ '--size': `${size || 16}px` }">
    <LoadingIndicator size="sm" class="relative -left-2" />
  </div>
</template>

<style scoped>
.logo-loader {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--size) * 0.125);
  height: var(--size);
}
</style>
