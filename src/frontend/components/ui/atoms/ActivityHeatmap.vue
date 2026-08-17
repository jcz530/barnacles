<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';

interface HeatmapDay {
  date: string; // YYYY-MM-DD
  value: number;
}

interface Cell {
  date: string;
  value: number;
  /** 0 = no activity, 1-4 = increasing intensity, -1 = padding or future. */
  level: number;
  isFuture: boolean;
  isToday: boolean;
  label: string;
}

const props = withDefaults(
  defineProps<{
    days: HeatmapDay[];
    isLoading?: boolean;
    /** Noun used in cell tooltips, e.g. "3 commits". */
    unit?: string;
  }>(),
  { isLoading: false, unit: 'commits' }
);

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const today = dayjs().format('YYYY-MM-DD');

/**
 * Intensity thresholds from the quantiles of active days rather than a linear
 * split of the max. A single 400-commit day would otherwise push every ordinary
 * day into the lowest bucket and flatten the whole grid.
 */
const thresholds = computed(() => {
  const active = props.days
    .map(d => d.value)
    .filter(v => v > 0)
    .sort((a, b) => a - b);

  if (active.length === 0) return [1, 2, 3, 4];

  const quantile = (q: number) =>
    active[Math.min(active.length - 1, Math.floor(active.length * q))];
  // De-duplicate so a low-variance month still spreads across buckets instead
  // of collapsing every cell onto one level.
  const raw = [quantile(0.25), quantile(0.5), quantile(0.75), quantile(0.95)];
  return raw.map((value, index) => Math.max(value, index + 1));
});

function levelFor(value: number): number {
  if (value <= 0) return 0;
  const [q1, q2, q3] = thresholds.value;
  if (value <= q1) return 1;
  if (value <= q2) return 2;
  if (value <= q3) return 3;
  return 4;
}

/**
 * Lay the range out as columns of weeks, Monday at the top. Leading and
 * trailing padding keeps every column a full seven cells so the grid stays
 * rectangular regardless of which weekday the range starts on.
 */
const weeks = computed<Cell[][]>(() => {
  if (props.days.length === 0) return [];

  const cells: Cell[] = props.days.map(day => ({
    date: day.date,
    value: day.value,
    level: day.date > today ? -1 : levelFor(day.value),
    isFuture: day.date > today,
    isToday: day.date === today,
    label: `${dayjs(day.date).format('MMM D')}: ${day.value} ${props.unit}`,
  }));

  const padding = (date: string): Cell => ({
    date,
    value: 0,
    level: -1,
    isFuture: false,
    isToday: false,
    label: '',
  });

  // dayjs().day() is 0=Sunday; shift so Monday is row 0.
  const leading = (dayjs(props.days[0].date).day() + 6) % 7;
  const padded: Cell[] = [
    ...Array.from({ length: leading }, (_, i) => padding(`pad-start-${i}`)),
    ...cells,
  ];
  while (padded.length % 7 !== 0) {
    padded.push(padding(`pad-end-${padded.length}`));
  }

  const result: Cell[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    result.push(padded.slice(i, i + 7));
  }
  return result;
});

/** Month labels above the columns where a new month begins. */
const monthLabels = computed(() =>
  weeks.value.map(week => {
    const first = week.find(cell => !cell.date.startsWith('pad-'));
    if (!first) return '';
    return dayjs(first.date).date() <= 7 ? dayjs(first.date).format('MMM') : '';
  })
);

const levelClass = (cell: Cell): string => {
  if (cell.date.startsWith('pad-')) return 'invisible';
  // Future days read as not-yet rather than as a quiet day.
  if (cell.isFuture) return 'bg-slate-50 dark:bg-slate-900';

  switch (cell.level) {
    case 1:
      return 'bg-success-200 dark:bg-success-900';
    case 2:
      return 'bg-success-300 dark:bg-success-700';
    case 3:
      return 'bg-success-500 dark:bg-success-500';
    case 4:
      return 'bg-success-700 dark:bg-success-300';
    default:
      return 'bg-slate-100 dark:bg-slate-800';
  }
};
</script>

<template>
  <div class="w-full">
    <div v-if="isLoading" class="flex gap-1">
      <div v-for="week in 6" :key="week" class="flex flex-col gap-1" aria-hidden="true">
        <div
          v-for="day in 7"
          :key="day"
          class="size-3 animate-pulse rounded-sm bg-slate-100 dark:bg-slate-800"
        />
      </div>
    </div>

    <div v-else-if="weeks.length" class="overflow-x-auto">
      <div class="flex gap-1">
        <!-- Weekday gutter. Only alternate labels, to keep the column narrow. -->
        <div class="mr-1 flex flex-col gap-1 pt-4">
          <div
            v-for="(label, index) in WEEKDAY_LABELS"
            :key="label"
            class="flex h-3 items-center text-[10px] leading-none text-slate-400"
          >
            <span v-if="index % 2 === 0">{{ label }}</span>
          </div>
        </div>

        <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="flex flex-col gap-1">
          <div class="h-3 text-[10px] leading-none text-slate-400">
            {{ monthLabels[weekIndex] }}
          </div>
          <div
            v-for="cell in week"
            :key="cell.date"
            class="size-3 rounded-sm"
            :class="[levelClass(cell), cell.isToday ? 'ring-primary-500 ring-1' : '']"
            :title="cell.label || undefined"
          />
        </div>
      </div>

      <div class="mt-3 flex items-center justify-end gap-1 text-[10px] text-slate-400">
        <span class="mr-1">Less</span>
        <div class="size-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
        <div class="bg-success-200 dark:bg-success-900 size-3 rounded-sm" />
        <div class="bg-success-300 dark:bg-success-700 size-3 rounded-sm" />
        <div class="bg-success-500 size-3 rounded-sm" />
        <div class="bg-success-700 dark:bg-success-300 size-3 rounded-sm" />
        <span class="ml-1">More</span>
      </div>
    </div>
  </div>
</template>
