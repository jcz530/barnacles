<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQueries } from '@/composables/useQueries';
import { FileText, Flame, FolderGit2, GitCommit, Minus, Plus } from 'lucide-vue-next';
import GitStatCard from '../molecules/GitStatCard.vue';
import { Button } from '../../ui/button';
import dayjs from 'dayjs';

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

// Calculate totals from daily data
const totals = computed(() => {
  if (!stats.value?.days) {
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

  const days = stats.value.days;

  // Sum up basic stats
  const commits = days.reduce((sum, day) => sum + day.commits, 0);
  const linesAdded = days.reduce((sum, day) => sum + day.linesAdded, 0);
  const linesRemoved = days.reduce((sum, day) => sum + day.linesRemoved, 0);

  // Get unique counts
  const filesChanged = days.reduce((sum, day) => sum + day.filesChanged, 0);
  const projectsWorkedOn = Math.max(...days.map(day => day.projectsWorkedOn), 0);

  // Calculate streak
  const streakResult = calculateStreak(days);

  return {
    commits,
    filesChanged,
    projectsWorkedOn,
    linesAdded,
    linesRemoved,
    streak: streakResult.streak,
    streakWarning: streakResult.warning,
    maxStreak: streakResult.maxStreak,
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

// Calculate streak from daily data
const calculateStreak = (days: typeof stats.value.days) => {
  if (!days || days.length === 0) return { streak: 0, warning: false, maxStreak: 0 };

  // Sort by date descending (newest first)
  const sortedDays = [...days].sort((a, b) => b.date.localeCompare(a.date));

  // Get days with commits
  const activeDays = sortedDays.filter(day => day.commits > 0);
  if (activeDays.length === 0) return { streak: 0, warning: false, maxStreak: 0 };

  const today = dayjs().startOf('day');
  const mostRecentDate = dayjs(activeDays[0].date).startOf('day');
  const daysSinceLastCommit = today.diff(mostRecentDate, 'day');

  // Streak is broken if last commit was more than 1 day ago
  if (daysSinceLastCommit > 1) {
    // Calculate max streak for non-current periods
    const maxStreak = calculateMaxStreak(activeDays);
    return { streak: 0, warning: false, maxStreak };
  }

  // Warning if last commit was yesterday (not today)
  const warning = daysSinceLastCommit === 1;

  // Count consecutive days working backwards
  let streak = 1;
  let currentDate = mostRecentDate;

  for (let i = 1; i < activeDays.length; i++) {
    const prevDate = dayjs(activeDays[i].date).startOf('day');
    const expectedDate = currentDate.subtract(1, 'day');

    if (prevDate.isSame(expectedDate, 'day')) {
      streak++;
      currentDate = prevDate;
    } else if (prevDate.isBefore(expectedDate, 'day')) {
      // Gap found, stop counting
      break;
    }
    // If same date, continue (shouldn't happen with daily data but handle it)
  }

  // Calculate max streak for the period
  const maxStreak = calculateMaxStreak(activeDays);

  return { streak, warning, maxStreak };
};

// Calculate the maximum streak within a period
const calculateMaxStreak = (activeDays: Array<{ date: string; commits: number }>) => {
  if (activeDays.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;
  let currentDate = dayjs(activeDays[0].date).startOf('day');

  for (let i = 1; i < activeDays.length; i++) {
    const prevDate = dayjs(activeDays[i].date).startOf('day');
    const expectedDate = currentDate.subtract(1, 'day');

    if (prevDate.isSame(expectedDate, 'day')) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
      currentDate = prevDate;
    } else if (prevDate.isBefore(expectedDate, 'day')) {
      // Gap found, reset streak
      currentStreak = 1;
      currentDate = prevDate;
    }
  }

  return maxStreak;
};
</script>

<template>
  <div class="">
    <div class="">
      <div class="flex items-center justify-around">
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
      </div>
    </div>

    <div class="pt-4">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <GitStatCard
          :icon="Flame"
          :label="selectedPeriod === 'week' ? 'Day Streak' : 'Max Streak'"
          :value="selectedPeriod === 'week' ? totals.streak : totals.maxStreak"
          icon-class="text-orange-500"
          :daily-values="dailyStreakActivity"
          :is-loading="isLoading"
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
          icon-class="text-blue-500"
          :daily-values="dailyProjectsWorkedOn"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="Plus"
          label="Lines Added"
          :value="totals.linesAdded.toLocaleString()"
          icon-class="text-green-500"
          :daily-values="dailyLinesAdded"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="Minus"
          label="Lines Removed"
          :value="totals.linesRemoved.toLocaleString()"
          icon-class="text-red-500"
          :daily-values="dailyLinesRemoved"
          :is-loading="isLoading"
        />
      </div>
    </div>
  </div>
</template>
