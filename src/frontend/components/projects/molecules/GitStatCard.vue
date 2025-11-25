<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  icon: Component;
  label: string;
  value: number | string;
  iconClass?: string;
}>();
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center rounded-lg border bg-slate-100 p-0 p-4"
  >
    <component
      :is="icon"
      :class="['absolute top-2 left-2 mb-2 h-6 w-6 opacity-80', iconClass || 'text-primary-500']"
    />
    <div class="text-2xl font-bold text-slate-800">{{ value }}</div>
    <div class="text-xs text-slate-500">{{ label }}</div>
  </div>
</template>
