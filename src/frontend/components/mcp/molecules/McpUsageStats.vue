<script setup lang="ts">
import { computed } from 'vue';
import { Activity, CircleCheck, Timer, Wrench } from 'lucide-vue-next';
import GitStatCard from '../../projects/molecules/GitStatCard.vue';
import type { EventBucket, EventCount } from '../../../../shared/types/api';

const props = defineProps<{
  counts: EventCount[];
  series: EventBucket[];
  totalTools: number;
  isLoading?: boolean;
}>();

const totalCalls = computed(() => props.counts.reduce((sum, count) => sum + count.total, 0));
const totalErrors = computed(() => props.counts.reduce((sum, count) => sum + count.errors, 0));

const successRate = computed(() => {
  if (totalCalls.value === 0) return '—';
  const rate = ((totalCalls.value - totalErrors.value) / totalCalls.value) * 100;
  // Whole numbers read better than "99.0%" for a headline metric.
  return `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
});

const avgDuration = computed(() => {
  const timed = props.counts.filter(count => count.avgDurationMs !== null && count.total > 0);
  if (timed.length === 0) return '—';

  // Weight each tool's average by its call count so busy tools dominate.
  const weighted = timed.reduce((sum, c) => sum + (c.avgDurationMs ?? 0) * c.total, 0);
  const calls = timed.reduce((sum, c) => sum + c.total, 0);
  return `${Math.round(weighted / calls)}ms`;
});

const toolsUsed = computed(() => props.counts.filter(count => count.total > 0).length);

const callSeries = computed(() =>
  props.series.map(bucket => ({ date: bucket.date, value: bucket.total }))
);
const errorSeries = computed(() =>
  props.series.map(bucket => ({ date: bucket.date, value: bucket.errors }))
);
// An idle day reports no average; plot it as a zero-height bar rather than
// dropping the day, so the bars stay aligned with the other cards' dates.
const durationSeries = computed(() =>
  props.series.map(bucket => ({ date: bucket.date, value: bucket.avgDurationMs ?? 0 }))
);
const toolsSeries = computed(() =>
  props.series.map(bucket => ({ date: bucket.date, value: bucket.toolsUsed }))
);

const formatMs = (value: number) => `${value.toLocaleString()}ms`;
</script>

<template>
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    <GitStatCard
      :icon="Activity"
      label="Total calls"
      :value="totalCalls"
      :daily-values="callSeries"
      :is-loading="isLoading"
    />
    <GitStatCard
      :icon="CircleCheck"
      label="Success rate"
      :value="successRate"
      :daily-values="errorSeries"
      :is-loading="isLoading"
    />
    <GitStatCard
      :icon="Timer"
      label="Avg duration"
      :value="avgDuration"
      :daily-values="durationSeries"
      :format-value="formatMs"
      :is-loading="isLoading"
    />
    <GitStatCard
      :icon="Wrench"
      label="Tools used"
      :value="`${toolsUsed} / ${totalTools}`"
      :daily-values="toolsSeries"
      :is-loading="isLoading"
    />
  </div>
</template>
