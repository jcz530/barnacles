<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useQueries } from '@/composables/useQueries';
import { ArrowRight, FileText, Flame, FolderGit2, GitCommit, Minus, Plus } from 'lucide-vue-next';
import GitStatCard from '../molecules/GitStatCard.vue';
import { Button } from '../../ui/button';
import { calculateStreaks } from '../../../../shared/utils/git-streak';

const { useGitStatsQuery } = useQueries();

const selectedPeriod = ref<'week' | 'month' | 'last-week'>('week');

const { data: stats, isLoading } = useGitStatsQuery(selectedPeriod);

const getPeriodLabel = (period: 'week' | 'month' | 'last-week') => {
  switch (period) {
    case 'week':
      return 'This Week';
    case 'month':
      return 'This Month';
    case 'last-week':
      return 'Last Week';
  }
};

const changePeriod = (period: 'week' | 'month' | 'last-week') => {
  if (!document.startViewTransition) {
    selectedPeriod.value = period;
    return;
  }

  document.startViewTransition(() => {
    selectedPeriod.value = period;
  });
};

// Calculate totals - use backend totals and add streak calculations
const totals = computed(() => {
  if (!stats.value?.days || !stats.value?.totals) {
    return {
      commits: 0,
      filesChanged: 0,
      projectsWorkedOn: 0,
      linesAdded: 0,
      linesRemoved: 0,
      streak: 0,
      streakWarning: false,
      maxStreak: 0,
    };
  }

  // Use backend totals
  const backendTotals = stats.value.totals;

  // Shared with the backend and the Stats page, so a streak means the same
  // thing everywhere. Anchored to today: this widget always shows a live period.
  const streakResult = calculateStreaks(stats.value.days);

  return {
    commits: backendTotals.commits,
    filesChanged: backendTotals.filesChanged,
    projectsWorkedOn: backendTotals.projectsWorkedOn,
    linesAdded: backendTotals.linesAdded,
    linesRemoved: backendTotals.linesRemoved,
    streak: streakResult.current,
    streakWarning: streakResult.warning,
    maxStreak: streakResult.longest,
  };
});

// Extract daily arrays for each metric with dates
const dailyCommits = computed(
  () => stats.value?.days.map(d => ({ date: d.date, value: d.commits })) ?? []
);
const dailyFilesChanged = computed(
  () => stats.value?.days.map(d => ({ date: d.date, value: d.filesChanged })) ?? []
);
const dailyLinesAdded = computed(
  () => stats.value?.days.map(d => ({ date: d.date, value: d.linesAdded })) ?? []
);
const dailyLinesRemoved = computed(
  () => stats.value?.days.map(d => ({ date: d.date, value: d.linesRemoved })) ?? []
);
const dailyProjectsWorkedOn = computed(
  () => stats.value?.days.map(d => ({ date: d.date, value: d.projectsWorkedOn })) ?? []
);

// For streak, we want to show binary (1 if commits > 0, 0 otherwise)
const dailyStreakActivity = computed(
  () => stats.value?.days.map(d => ({ date: d.date, value: d.commits > 0 ? 1 : 0 })) ?? []
);
</script>

<template>
  <div class="">
    <div class="">
      <div class="flex items-center justify-between">
        <div class="flex gap-2">
          <Button
            v-for="period in ['week', 'month', 'last-week'] as const"
            :key="period"
            size="sm"
            variant="ghost"
            :class="[selectedPeriod === period ? 'text-primary-500' : '']"
            @click="changePeriod(period)"
          >
            {{ getPeriodLabel(period) }}
          </Button>
        </div>

        <Button as-child size="sm" variant="ghost" class="text-slate-500">
          <RouterLink to="/stats">
            View all
            <ArrowRight class="ml-1 size-3.5" />
          </RouterLink>
        </Button>
      </div>
    </div>

    <div class="pt-4">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <GitStatCard
          :icon="Flame"
          :label="selectedPeriod === 'week' ? 'Day Streak' : 'Max Streak'"
          :value="selectedPeriod === 'week' ? totals.streak : totals.maxStreak"
          icon-class="text-primary-500"
          :daily-values="dailyStreakActivity"
          :is-loading="isLoading"
          hide-values
          :warning-message="
            selectedPeriod === 'week' && totals.streakWarning ? 'no commits today' : undefined
          "
        />
        <GitStatCard
          :icon="GitCommit"
          label="Commits"
          :value="totals.commits"
          :daily-values="dailyCommits"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="FileText"
          label="Files Changed"
          :value="totals.filesChanged"
          :daily-values="dailyFilesChanged"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="FolderGit2"
          label="Projects"
          :value="totals.projectsWorkedOn"
          icon-class="text-slate-500"
          :daily-values="dailyProjectsWorkedOn"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="Plus"
          label="Lines Added"
          :value="totals.linesAdded.toLocaleString()"
          icon-class="text-success-500"
          :daily-values="dailyLinesAdded"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="Minus"
          label="Lines Removed"
          :value="totals.linesRemoved.toLocaleString()"
          icon-class="text-danger-500"
          :daily-values="dailyLinesRemoved"
          :is-loading="isLoading"
        />
      </div>
    </div>
  </div>
</template>
