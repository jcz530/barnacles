<script setup lang="ts">
defineProps<{
  size?: number;
}>();
</script>

<template>
  <div class="pulse-loader" :style="{ '--size': `${size || 16}px` }">
    <div class="pulse-ring"></div>
    <div class="pulse-ring"></div>
  </div>
</template>

<style scoped>
.pulse-loader {
  position: relative;
  width: var(--size);
  height: var(--size);
  display: inline-block;
}

.pulse-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: calc(var(--size) * 0.125) solid currentColor;
  border-radius: 50%;
  opacity: 0;
  animation: pulse-expand 2s ease-out infinite;
}

.pulse-ring:nth-child(2) {
  animation-delay: 1s;
}

@keyframes pulse-expand {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}
</style>
