<script setup lang="ts">
defineProps<{
  size?: number;
}>();
</script>

<template>
  <div class="dots-loader" :style="{ '--size': `${size || 16}px` }">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
</template>

<style scoped>
.dots-loader {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--size) * 0.25);
  height: var(--size);
}

.dot {
  width: calc(var(--size) * 0.25);
  height: calc(var(--size) * 0.25);
  background-color: currentColor;
  border-radius: 50%;
  animation: dots-bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes dots-bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
