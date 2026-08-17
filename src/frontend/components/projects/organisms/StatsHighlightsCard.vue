<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { CalendarDays, Flame, Trophy, Zap } from 'lucide-vue-next';
import type { GitStatsDetail, GitStatsTotals } from '../../../../shared/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

const props = defineProps<{
  detail?: GitStatsDetail;
  totals?: GitStatsTotals;
  monthLabel: string;
  isLoading?: boolean;
}>();

const highlights = computed(() => {
  const busiest = props.detail?.busiestDay;
  const streaks = props.detail?.streaks;
  const activeDays = props.totals?.activeDays ?? 0;
  const commits = props.totals?.commits ?? 0;

  return [
    {
      key: 'busiest',
      icon: Trophy,
      label: 'Busiest day',
      value: busiest ? dayjs(busiest.date).format('MMM D') : '—',
      detail: busiest ? `${busiest.commits} commits` : 'No activity',
    },
    {
      key: 'streak',
      icon: Flame,
      label: 'Longest streak',
      value: streaks?.longest ? `${streaks.longest} days` : '—',
      detail:
        streaks?.longest && streaks.longestStart
          ? `${dayjs(streaks.longestStart).format('MMM D')} – ${dayjs(streaks.longestEnd).format('MMM D')}`
          : 'No activity',
    },
    {
      key: 'active',
      icon: CalendarDays,
      label: 'Active days',
      value: String(activeDays),
      detail: `in ${props.monthLabel}`,
    },
    {
      key: 'average',
      icon: Zap,
      label: 'Avg / active day',
      value: activeDays ? (commits / activeDays).toFixed(1) : '—',
      detail: 'commits',
    },
  ];
});
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">Highlights</CardTitle>
    </CardHeader>

    <CardContent>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div v-for="item in highlights" :key="item.key" class="flex items-start gap-3">
          <component :is="item.icon" class="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div class="min-w-0">
            <p class="text-xs text-slate-500">{{ item.label }}</p>
            <p
              v-if="isLoading"
              class="mt-1 h-5 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
            />
            <template v-else>
              <p class="truncate text-lg font-semibold">{{ item.value }}</p>
              <p class="truncate text-xs text-slate-400">{{ item.detail }}</p>
            </template>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
