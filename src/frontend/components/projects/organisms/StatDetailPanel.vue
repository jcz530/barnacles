<script setup lang="ts">
import type { Component } from 'vue';
import { computed } from 'vue';
import dayjs from 'dayjs';
import { X } from 'lucide-vue-next';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

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
 * Month boundaries, used as chart ticks. Anything longer than a week gets them;
 * below that the individual bars are already labelled.
 */
const axisTicks = computed(() => {
  if (props.days.length <= 7) return [];

  return props.days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => dayjs(day.date).date() === 1)
    .map(({ day, index }) => ({
      label: dayjs(day.date).format('MMM'),
      // Percentage rather than pixels, so ticks track the bars as the panel resizes.
      left: `${(index / props.days.length) * 100}%`,
    }));
});

const barTitle = (day: DatedValue) =>
  `${dayjs(day.date).format('ddd, MMM D YYYY')}: ${day.value.toLocaleString()}`;
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
          <div class="flex h-40 items-end gap-px">
            <div
              v-for="day in days"
              :key="day.date"
              class="group relative flex h-full flex-1 items-end"
              :title="barTitle(day)"
            >
              <div
                class="from-primary-500/60 to-primary-500/90 w-full rounded-sm bg-gradient-to-t transition-all"
                :class="day.value === 0 ? 'bg-slate-100 dark:bg-slate-800' : ''"
                :style="{
                  height: `${Math.max((day.value / maxValue) * 100, day.value > 0 ? 2 : 1)}%`,
                }"
              />
            </div>
          </div>

          <div v-if="axisTicks.length" class="relative mt-1 h-4">
            <span
              v-for="tick in axisTicks"
              :key="tick.left"
              class="absolute text-[10px] text-slate-400"
              :style="{ left: tick.left }"
            >
              {{ tick.label }}
            </span>
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
