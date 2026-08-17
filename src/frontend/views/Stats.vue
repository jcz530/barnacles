<script setup lang="ts">
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import {
  Activity,
  FileText,
  Flame,
  FolderGit2,
  GitCommit,
  Minus,
  Plus,
  Scale,
} from 'lucide-vue-next';
import GitStatCard from '../components/projects/molecules/GitStatCard.vue';
import MonthStepper from '../components/projects/molecules/MonthStepper.vue';
import StatsHighlightsCard from '../components/projects/organisms/StatsHighlightsCard.vue';
import StatsLanguageCard from '../components/projects/organisms/StatsLanguageCard.vue';
import StatsTopFilesCard from '../components/projects/organisms/StatsTopFilesCard.vue';
import ProjectFilterCombobox from '../components/projects/molecules/ProjectFilterCombobox.vue';
import ActivityHeatmap from '../components/ui/atoms/ActivityHeatmap.vue';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'Stats' }]);

const { useMonthlyGitStatsQuery, useProjectsQuery } = useQueries();

// Deliberately not persisted — landing on the current month with no filter is
// the right default on every visit, regardless of where the last session ended.
const selectedMonth = ref(dayjs().format('YYYY-MM'));
// Empty means every project, which is also what the API assumes.
const selectedProjects = ref<string[]>([]);

const { data: projectsData, isLoading: isLoadingProjects } = useProjectsQuery({ enabled: true });
const {
  data: stats,
  isLoading,
  isFetching,
} = useMonthlyGitStatsQuery(selectedMonth, selectedProjects);

const monthLabel = computed(() => dayjs(`${selectedMonth.value}-01`).format('MMMM YYYY'));
// Only meaningless for exactly one project, where the count would always read 1.
const isSingleProject = computed(() => selectedProjects.value.length === 1);

const totals = computed(() => stats.value?.totals);
const days = computed(() => stats.value?.days ?? []);

const dailyValues = (key: 'commits' | 'filesChanged' | 'linesAdded' | 'linesRemoved') =>
  computed(() => days.value.map(day => ({ date: day.date, value: day[key] })));

const dailyCommits = dailyValues('commits');
const dailyFilesChanged = dailyValues('filesChanged');
const dailyLinesAdded = dailyValues('linesAdded');
const dailyLinesRemoved = dailyValues('linesRemoved');

const dailyChurn = computed(() =>
  days.value.map(day => ({ date: day.date, value: day.linesAdded + day.linesRemoved }))
);
const dailyProjects = computed(() =>
  days.value.map(day => ({ date: day.date, value: day.projectsWorkedOn }))
);
// Binary activity, so the streak sparkline reads as "did I commit" rather than
// "how much" — matching how the dashboard renders it.
const dailyActivity = computed(() =>
  days.value.map(day => ({ date: day.date, value: day.commits > 0 ? 1 : 0 }))
);

const heatmapDays = computed(() => days.value.map(day => ({ date: day.date, value: day.commits })));

// A past month has no running streak, so show what it peaked at instead.
const isCurrentMonth = computed(() => selectedMonth.value === dayjs().format('YYYY-MM'));
const streakLabel = computed(() => (isCurrentMonth.value ? 'Day Streak' : 'Longest Streak'));
const streakValue = computed(() => {
  const streaks = stats.value?.detail?.streaks;
  if (!streaks) return 0;
  return isCurrentMonth.value && streaks.current > 0 ? streaks.current : streaks.longest;
});

const formatNumber = (value: number | undefined) => (value ?? 0).toLocaleString();
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <MonthStepper v-model="selectedMonth" />

      <ProjectFilterCombobox
        v-model="selectedProjects"
        :projects="projectsData ?? []"
        :is-loading="isLoadingProjects"
      />
    </div>

    <!-- Dimmed rather than replaced while stepping months, so the page keeps
         its shape instead of collapsing into skeletons on every click. -->
    <div class="space-y-6 transition-opacity" :class="isFetching && !isLoading ? 'opacity-60' : ''">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <GitStatCard
          :icon="Flame"
          :label="streakLabel"
          :value="streakValue"
          icon-class="text-primary-500"
          :daily-values="dailyActivity"
          :is-loading="isLoading"
          hide-values
        />
        <GitStatCard
          :icon="GitCommit"
          label="Commits"
          :value="formatNumber(totals?.commits)"
          :daily-values="dailyCommits"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="FileText"
          label="Files Changed"
          :value="formatNumber(totals?.filesChanged)"
          :daily-values="dailyFilesChanged"
          :is-loading="isLoading"
        />
        <GitStatCard
          v-if="!isSingleProject"
          :icon="FolderGit2"
          label="Projects"
          :value="formatNumber(totals?.projectsWorkedOn)"
          icon-class="text-slate-500"
          :daily-values="dailyProjects"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="Plus"
          label="Lines Added"
          :value="formatNumber(totals?.linesAdded)"
          icon-class="text-success-500"
          :daily-values="dailyLinesAdded"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="Minus"
          label="Lines Removed"
          :value="formatNumber(totals?.linesRemoved)"
          icon-class="text-danger-500"
          :daily-values="dailyLinesRemoved"
          :is-loading="isLoading"
        />
        <GitStatCard
          :icon="Activity"
          label="Churn"
          :value="formatNumber(totals?.churn)"
          icon-class="text-slate-500"
          :daily-values="dailyChurn"
          :is-loading="isLoading"
        />
        <GitStatCard
          v-if="isSingleProject"
          :icon="Scale"
          label="Net Lines"
          :value="formatNumber(totals?.netLines)"
          icon-class="text-slate-500"
          :is-loading="isLoading"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">Activity in {{ monthLabel }}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap :days="heatmapDays" :is-loading="isLoading" />
        </CardContent>
      </Card>

      <div class="grid gap-4 lg:grid-cols-2">
        <StatsTopFilesCard
          :files="stats?.detail?.topFiles ?? []"
          :month-label="monthLabel"
          :is-loading="isLoading"
        />
        <StatsLanguageCard
          :languages="stats?.detail?.languages ?? []"
          :month-label="monthLabel"
          :is-loading="isLoading"
        />
      </div>

      <StatsHighlightsCard
        :detail="stats?.detail"
        :totals="totals"
        :month-label="monthLabel"
        :is-loading="isLoading"
      />
    </div>
  </div>
</template>
