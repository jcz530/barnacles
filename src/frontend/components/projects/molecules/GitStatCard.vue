<script setup lang="ts">
import type { Component } from 'vue';
import { computed, ref, useTemplateRef } from 'vue';
import dayjs from 'dayjs';

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
  hideValues?: boolean;
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

  return props.dailyValues.map(dailyValue => {
    return {
      height: max > 0 ? (dailyValue.value / max) * 100 : 0,
      value: dailyValue.value,
      date: dailyValue.date,
      formattedDate: formatDate(dailyValue.date),
      dayInitial: dayjs(dailyValue.date).format('dd').charAt(0),
      isToday: dayjs(dailyValue.date).isSame(dayjs(), 'day'),
    };
  });
});

// Format date for tooltip
const formatDate = (dateStr: string) => {
  return dayjs(dateStr).format('ddd, MMM D');
};

// Determine bar width based on number of days
const barWidth = computed(() => {
  const dayCount = props.dailyValues?.length || 0;
  if (dayCount <= 7) return 'w-1'; // Week view - wider bars
  if (dayCount <= 31) return 'w-1'; // Month view - narrower bars
  return 'w-0.5'; // More days - thinnest bars
});
/** Seven or fewer bars leaves room for a label over each one on hover. */
const showsLabels = computed(() => {
  const dayCount = props.dailyValues?.length ?? 0;
  return dayCount > 0 && dayCount <= 7;
});

const hoveredIndex = ref<number | null>(null);
const chartEl = useTemplateRef<HTMLElement>('chart');

/**
 * Resolve the hovered bar from the cursor's position across the whole chart.
 *
 * Listening on each bar instead leaves the gaps between them as dead zones, so
 * sweeping the mouse sideways fires `mouseleave` on every gap and the figure
 * flickers back to the period total. Measuring against the chart's own box has
 * no gaps to fall into — vertically either, where a short bar leaves most of
 * its column empty.
 */
const trackHover = (event: MouseEvent) => {
  const el = chartEl.value;
  const count = barHeights.value.length;
  if (!el || count === 0) return;

  // Measured from the first and last bars rather than the container: it is
  // centred and padded, so the bars do not span its full width and dividing by
  // that width would skew every index, worst at the edges.
  const bars = el.children;
  const first = bars[0]?.getBoundingClientRect();
  const last = bars[count - 1]?.getBoundingClientRect();
  if (!first || !last) return;

  const span = last.right - first.left;
  if (span <= 0) return;

  // The row is centred in a full-width container, so there is real empty space
  // either side of it — treat that as outside the chart rather than clamping it
  // onto the end bars.
  if (event.clientX < first.left || event.clientX > last.right) {
    hoveredIndex.value = null;
    return;
  }

  const offset = event.clientX - first.left;
  const index = Math.floor((offset / span) * count);

  // Clamped for the sub-pixel edges, which are inside the row by the check above.
  hoveredIndex.value = Math.min(Math.max(index, 0), count - 1);
};

/**
 * Hovering a bar swaps the tile's figure and caption for that day's value and
 * date, restoring the period total on the way out.
 *
 * A month or a year has too many bars for the per-bar labels a week gets, which
 * left those views with nothing but a native `title` tooltip — a one-second
 * wait for a value the tile could just show. Reusing the figure keeps the
 * layout from shifting on hover.
 */
const display = computed(() => {
  const bar = hoveredIndex.value === null ? null : barHeights.value[hoveredIndex.value];
  if (!bar) return { value: props.value, label: props.label, isHovered: false };

  return {
    value: bar.value.toLocaleString(),
    label: bar.formattedDate,
    isHovered: true,
  };
});

const barGap = computed(() => {
  const dayCount = props.dailyValues?.length || 0;
  if (dayCount <= 7) return 'gap-2';
  if (dayCount <= 31) return 'gap-0.5';
  return 'gap-0.5';
});
</script>

<template>
  <div class="group relative flex flex-col items-center p-4">
    <div class="bg-primary-200/20 absolute top-6 h-6 w-3/4 blur-lg"></div>
    <div
      ref="chart"
      class="group/chart relative top-0 left-0 mt-3 mb-4 flex h-6 w-full justify-center gap-0.5 rounded p-0.5"
      :class="barGap"
      @mousemove="trackHover"
      @mouseleave="hoveredIndex = null"
    >
      <div
        v-for="(bar, index) in barHeights"
        :key="index"
        class="flex h-full items-end rounded-sm bg-gradient-to-t from-slate-200/40 to-slate-200/80"
        :class="barWidth"
      >
        <div
          class="flex-1 rounded-sm bg-gradient-to-t transition-all"
          :class="
            hoveredIndex === index
              ? 'from-primary-600 to-primary-600'
              : 'from-primary-500/60 to-primary-500/80'
          "
          :style="{ height: `${bar.height}%` }"
          :title="`${bar.formattedDate}: ${bar.value}`"
        />
        <span
          v-if="showsLabels"
          class="invisible absolute -bottom-3 translate-1/2 rotate-6 text-[0.4rem] text-slate-500 opacity-0 transition-all duration-300 ease-in-out group-hover:visible group-hover:translate-none group-hover:rotate-none group-hover:opacity-100"
          :class="
            bar.isToday
              ? 'before:bg-primary-500/80 rounded-full before:absolute before:right-0 before:-bottom-0 before:left-0 before:block before:h-0.5 before:w-full before:rounded-full'
              : ''
          "
          :style="`transition-delay: ${(index + 1) * 50}ms`"
          :title="bar.formattedDate"
        >
          {{ bar.dayInitial }}
        </span>
        <span
          v-if="!hideValues && showsLabels"
          class="invisible absolute -top-3 min-w-4 translate-y-1/2 rotate-[-30deg] text-left text-[0.45rem] opacity-0 transition-all duration-300 ease-out group-hover/chart:visible group-hover/chart:translate-none group-hover/chart:-rotate-45 group-hover/chart:opacity-100"
          :class="[bar.value === 0 ? 'text-slate-500/40' : 'text-slate-500']"
          :style="`transition-delay: ${(index + 1) * 50}ms`"
          :title="bar.formattedDate"
        >
          {{ bar.value.toLocaleString() }}
        </span>
      </div>
    </div>
    <div class="flex flex-1 items-center justify-center gap-2">
      <component
        :is="icon"
        :class="['h-6 w-6 opacity-80', iconClass || 'text-primary-500']"
        :style="{ viewTransitionName: transitionName }"
      />
      <div class="text-2xl font-bold text-slate-800 tabular-nums">
        <div
          v-if="isLoading"
          class="my-2 h-4 w-12 animate-pulse rounded-full bg-slate-300/20"
        ></div>
        <template v-else>{{ display.value }}</template>
      </div>
    </div>

    <!-- Doubles as the hover readout, so the tile states a real value instead
         of making the reader wait on a native tooltip. -->
    <div
      class="text-xs transition-colors"
      :class="display.isHovered ? 'text-primary-500 font-medium' : 'text-slate-500'"
    >
      {{ display.label }}
    </div>
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
