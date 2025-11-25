<script setup lang="ts">
import type { Component } from 'vue';
import { computed } from 'vue';

interface DailyValue {
  date: string;
  value: number;
}

const props = defineProps<{
  icon: Component;
  label: string;
  value: number | string;
  iconClass?: string;
  dailyValues?: DailyValue[];
  isLoading?: boolean;
  warningMessage?: string;
}>();

// Create unique transition name from label
const transitionName = computed(() => {
  return `stat-icon-${props.label.toLowerCase().replace(/\s+/g, '-')}`;
});

// Calculate bar heights as percentages
const barHeights = computed(() => {
  if (!props.dailyValues || props.dailyValues.length === 0) {
    return [];
  }

  const values = props.dailyValues.map(d => d.value);
  const max = Math.max(...values, 1); // Avoid division by zero

  return props.dailyValues.map(dailyValue => ({
    height: max > 0 ? (dailyValue.value / max) * 100 : 0,
    value: dailyValue.value,
    date: dailyValue.date,
    formattedDate: formatDate(dailyValue.date),
  }));
});

// Format date for tooltip
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Determine bar width based on number of days
const barWidth = computed(() => {
  const dayCount = props.dailyValues?.length || 0;
  if (dayCount <= 7) return 'w-1'; // Week view - wider bars
  if (dayCount <= 31) return 'w-1'; // Month view - narrower bars
  return 'w-0.5'; // More days - thinnest bars
});
const barGap = computed(() => {
  const dayCount = props.dailyValues?.length || 0;
  if (dayCount <= 7) return 'gap-2';
  if (dayCount <= 31) return 'gap-0.5';
  return 'gap-0.5';
});
</script>

<template>
  <div class="relative flex flex-col items-center p-4">
    <div class="bg-primary-200/20 absolute top-6 h-6 w-3/4 blur-lg"></div>
    <div
      class="relative top-0 left-0 mt-3 mb-4 flex h-6 w-full justify-center gap-0.5 overflow-hidden rounded p-0.5"
      :class="barGap"
    >
      <div
        v-for="(bar, index) in barHeights"
        :key="index"
        class="flex h-full items-end rounded-sm bg-gradient-to-t from-slate-200/40 to-slate-200/80"
        :class="barWidth"
      >
        <div
          class="from-primary-500/60 to-primary-500/80 flex-1 rounded-sm bg-gradient-to-t transition-all"
          :style="{ height: `${bar.height}%` }"
          :title="`${bar.formattedDate}: ${bar.value}`"
        />
      </div>
    </div>
    <div class="flex flex-1 items-center justify-center gap-2">
      <component
        :is="icon"
        :class="['h-6 w-6 opacity-80', iconClass || 'text-primary-500']"
        :style="{ viewTransitionName: transitionName }"
      />
      <div class="text-2xl font-bold text-slate-800">
        <div
          v-if="isLoading"
          class="my-2 h-4 w-12 animate-pulse rounded-full bg-slate-300/20"
        ></div>
        <template v-else>{{ value }}</template>
      </div>
    </div>

    <div class="text-xs text-slate-500">{{ label }}</div>
    <div v-if="warningMessage" class="mt-1 text-xs font-medium text-orange-500">
      {{ warningMessage }}
    </div>
  </div>
</template>

<style>
::view-transition-old(stat-icon-*),
::view-transition-new(stat-icon-*) {
  animation-duration: 300ms;
  animation-timing-function: ease-in-out;
}
</style>
