<script setup lang="ts">
import { computed } from 'vue';
import { Code } from 'lucide-vue-next';
import type { GitStatsLanguageSlice } from '../../../../shared/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import PercentageGridChart from '../../ui/atoms/PercentageGridChart.vue';

const props = defineProps<{
  languages: GitStatsLanguageSlice[];
  monthLabel: string;
  isLoading?: boolean;
}>();

// Colors come from the technology detectors, which carry each language's
// official brand color — the documented exception to the theme-only rule.
// The unrecognised-extension bucket has none, so it falls back to slate.
const FALLBACK_COLOR = '#94a3b8';

const chartData = computed(() =>
  props.languages.map(language => ({
    color: language.color || FALLBACK_COLOR,
    percentage: language.percentage,
    label: language.label,
  }))
);
</script>

<template>
  <Card class="border-0 bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Code class="size-4 text-slate-500" />
        Languages
      </CardTitle>
      <!-- Deliberately not "your codebase": this measures the lines changed in
           the selected month, unlike the per-project breakdown which counts
           files on disk. -->
      <CardDescription>Share of code changed in {{ monthLabel }}</CardDescription>
    </CardHeader>

    <CardContent>
      <div v-if="isLoading" class="h-32 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />

      <p v-else-if="!languages.length" class="py-8 text-center text-sm text-slate-500">
        No commits in {{ monthLabel }}
      </p>

      <!-- Matches the project overview's language chart: more dots at a fixed
           gap, which reads finer-grained than the default 100. -->
      <PercentageGridChart
        v-else
        :data="chartData"
        :gap="8"
        :circle-size="8"
        :total-dots="200"
        full-width
        fixed-gap
      >
        <template #legend="{ data, hoveredLabel, onHover }">
          <div class="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
            <div
              v-for="item in data"
              :key="item.label"
              class="flex cursor-pointer items-center gap-1.5 text-xs transition-opacity"
              :class="hoveredLabel && hoveredLabel !== item.label ? 'opacity-40' : ''"
              @mouseenter="onHover(item.label)"
              @mouseleave="onHover(null)"
            >
              <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
              <span class="text-slate-700 dark:text-slate-300">{{ item.label }}</span>
              <span class="text-slate-400">{{ item.percentage }}%</span>
            </div>
          </div>
        </template>
      </PercentageGridChart>
    </CardContent>
  </Card>
</template>
