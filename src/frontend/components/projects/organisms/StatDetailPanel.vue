<script setup lang="ts">
import type { Component } from 'vue';
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { X } from 'lucide-vue-next';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

// isoWeekday() drives the weekly tick marks. Registered here rather than relying
// on another module having already extended dayjs.
dayjs.extend(isoWeek);

interface DatedValue {
  date: string;
  value: number;
}

const props = defineProps<{
  icon: Component;
  label: string;
  /** Formatted headline figure, already localised by the caller. */
  value: number | string;
  iconClass?: string;
  /** One entry per day of the period, ungrouped. */
  days: DatedValue[];
  periodLabel: string;
  /** Suppresses figures that are meaningless for a binary series. */
  isBinary?: boolean;
  isLoading?: boolean;
}>();

defineEmits<{ close: [] }>();

const activeDays = computed(() => props.days.filter(day => day.value > 0));

const total = computed(() => props.days.reduce((sum, day) => sum + day.value, 0));

/**
 * Averaged over active days rather than every day in the period. A mean that
 * includes weekends and holidays mostly measures how much time off you took,
 * which is not what the number is asked to answer.
 */
const averagePerActiveDay = computed(() =>
  activeDays.value.length ? total.value / activeDays.value.length : 0
);

const bestDay = computed(() =>
  props.days.reduce<DatedValue | null>(
    // Ties resolve to the earliest day, so the value is stable run to run.
    (best, day) => (day.value > 0 && (!best || day.value > best.value) ? day : best),
    null
  )
);

/** Highest days for this metric, most first. */
const topDays = computed(() =>
  [...activeDays.value]
    .sort((a, b) => b.value - a.value || a.date.localeCompare(b.date))
    .slice(0, 5)
);

const maxValue = computed(() => Math.max(...props.days.map(day => day.value), 1));

const summary = computed(() => {
  if (props.isBinary) {
    // Totals and averages of a 0/1 flag would just restate the active-day count.
    return [
      { key: 'active', label: 'Active days', value: String(activeDays.value.length) },
      {
        key: 'rate',
        label: 'Of the period',
        value: props.days.length
          ? `${Math.round((activeDays.value.length / props.days.length) * 100)}%`
          : '—',
      },
    ];
  }

  return [
    { key: 'total', label: 'Total', value: total.value.toLocaleString() },
    {
      key: 'average',
      label: 'Avg / active day',
      value: activeDays.value.length
        ? averagePerActiveDay.value.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : '—',
    },
    {
      key: 'best',
      label: 'Best day',
      value: bestDay.value ? bestDay.value.value.toLocaleString() : '—',
      detail: bestDay.value ? dayjs(bestDay.value.date).format('MMM D') : undefined,
    },
    { key: 'active', label: 'Active days', value: String(activeDays.value.length) },
  ];
});

/**
 * X-axis ticks, at whatever interval suits the range's length.
 *
 * A week labels every day, a month labels Mondays, and anything longer labels
 * month boundaries. The aim is roughly 4-8 labels whatever the span — one per
 * bar is unreadable over a month, and month names alone say nothing over a week.
 */
const axisTicks = computed(() => {
  const { days } = props;
  if (days.length === 0) return [];

  const isTick = (date: string) => {
    // A week: every day fits.
    if (days.length <= 7) return true;
    // Up to roughly two months: start each week. Using Monday rather than every
    // 7th bar keeps labels on real week boundaries as you step between periods.
    if (days.length <= 62) return dayjs(date).isoWeekday() === 1;
    // Longer: the first of each month.
    return dayjs(date).date() === 1;
  };

  const format = (date: string) => {
    if (days.length <= 7) return dayjs(date).format('ddd');
    if (days.length <= 62) return dayjs(date).format('MMM D');
    return dayjs(date).format('MMM');
  };

  return days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => isTick(day.date))
    .map(({ day, index }) => ({
      key: day.date,
      label: format(day.date),
      // Percentage rather than pixels, so ticks track the bars as the panel resizes.
      left: `${(index / days.length) * 100}%`,
    }));
});

const barTitle = (day: DatedValue) =>
  `${dayjs(day.date).format('ddd, MMM D YYYY')}: ${day.value.toLocaleString()}`;

const hoveredIndex = ref<number | null>(null);

/**
 * What the figure above the chart shows: the hovered bar, or the best day when
 * nothing is hovered. A chart whose values only exist in native tooltips makes
 * the reader hover and wait to learn anything.
 */
const readout = computed(() => {
  const hovered = hoveredIndex.value === null ? null : props.days[hoveredIndex.value];
  const day = hovered ?? bestDay.value;

  if (!day) return { value: 0, label: 'No activity' };

  return {
    value: day.value,
    label: `${dayjs(day.date).format('ddd, MMM D')}${hovered ? '' : ' · best day'}`,
  };
});
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-start justify-between space-y-0">
      <div class="flex items-center gap-2">
        <component :is="icon" class="size-5" :class="iconClass ?? 'text-slate-500'" />
        <div>
          <CardTitle class="text-base">{{ label }}</CardTitle>
          <p class="text-xs text-slate-500">{{ periodLabel }}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-2xl font-semibold">{{ value }}</span>
        <Button variant="ghost" size="icon" aria-label="Close details" @click="$emit('close')">
          <X class="size-4" />
        </Button>
      </div>
    </CardHeader>

    <CardContent class="space-y-6">
      <div v-if="isLoading" class="h-40 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />

      <template v-else>
        <!-- Full width, so a year can render every day rather than the weekly
             buckets the small tile is limited to. Skipped entirely when nothing
             happened, rather than reserving 160px of blank space. -->
        <div v-if="activeDays.length">
          <!-- Reads out the hovered bar, falling back to the best day so the
               chart always states a real value rather than needing a hover to
               say anything at all. -->
          <div class="mb-2 flex items-baseline gap-2">
            <span class="text-xl font-semibold tabular-nums">
              {{ readout.value.toLocaleString() }}
            </span>
            <span class="text-xs text-slate-500">
              {{ readout.label }}
            </span>
          </div>

          <div class="flex gap-2">
            <!-- Y axis: the scale is otherwise invisible, so bar heights are
                 only comparable to each other and not to any number. -->
            <div
              class="flex h-40 w-10 shrink-0 flex-col justify-between text-right text-[10px] text-slate-400 tabular-nums"
            >
              <span>{{ maxValue.toLocaleString() }}</span>
              <span>0</span>
            </div>

            <div class="relative flex h-40 flex-1 items-end gap-px">
              <!-- Gridline at the top of the scale. -->
              <div
                class="absolute inset-x-0 top-0 border-t border-dashed border-slate-200 dark:border-slate-700"
              />

              <div
                v-for="(day, index) in days"
                :key="day.date"
                class="relative flex h-full flex-1 items-end"
                :title="barTitle(day)"
                @mouseenter="hoveredIndex = index"
                @mouseleave="hoveredIndex = null"
              >
                <div
                  class="w-full rounded-sm transition-all"
                  :class="
                    day.value === 0
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : hoveredIndex === index
                        ? 'bg-primary-600'
                        : 'from-primary-500/60 to-primary-500/90 bg-gradient-to-t'
                  "
                  :style="{
                    height: `${Math.max((day.value / maxValue) * 100, day.value > 0 ? 2 : 1)}%`,
                  }"
                />
              </div>
            </div>
          </div>

          <!-- Mirrors the chart row's gutter (w-10) and gap-2 so the ticks line
               up with the bars rather than the panel edge. -->
          <div v-if="axisTicks.length" class="flex gap-2">
            <div class="w-10 shrink-0" />
            <div class="relative mt-1 h-4 flex-1">
              <span
                v-for="tick in axisTicks"
                :key="tick.key"
                class="absolute text-[10px] text-slate-400"
                :style="{ left: tick.left }"
              >
                {{ tick.label }}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div v-for="item in summary" :key="item.key">
            <p class="text-xs text-slate-500">{{ item.label }}</p>
            <p class="text-lg font-semibold">{{ item.value }}</p>
            <p v-if="item.detail" class="text-xs text-slate-400">{{ item.detail }}</p>
          </div>
        </div>

        <div v-if="!isBinary">
          <p class="mb-2 text-xs font-medium text-slate-500">Top days</p>

          <p v-if="!topDays.length" class="text-sm text-slate-500">
            No activity in {{ periodLabel }}
          </p>

          <ul v-else class="space-y-2">
            <li v-for="day in topDays" :key="day.date" class="flex items-center gap-3 text-sm">
              <span class="w-28 shrink-0 text-slate-500">
                {{ dayjs(day.date).format('ddd, MMM D') }}
              </span>
              <span
                class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <span
                  class="bg-primary-500 block h-full rounded-full"
                  :style="{ width: `${(day.value / maxValue) * 100}%` }"
                />
              </span>
              <span class="w-16 shrink-0 text-right font-mono text-xs">
                {{ day.value.toLocaleString() }}
              </span>
            </li>
          </ul>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
