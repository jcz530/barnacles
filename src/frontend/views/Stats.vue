<script setup lang="ts">
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import { FileText, Flame, FolderGit2, GitCommit, Minus, Plus, Scale } from 'lucide-vue-next';
import GitStatCard from '../components/projects/molecules/GitStatCard.vue';
import PeriodStepper from '../components/projects/molecules/PeriodStepper.vue';
import StatsHighlightsCard from '../components/projects/organisms/StatsHighlightsCard.vue';
import StatsLanguageCard from '../components/projects/organisms/StatsLanguageCard.vue';
import StatsTopFilesCard from '../components/projects/organisms/StatsTopFilesCard.vue';
import ProjectFilterCombobox from '../components/projects/molecules/ProjectFilterCombobox.vue';
import ActivityHeatmap from '../components/ui/atoms/ActivityHeatmap.vue';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  bucketByIsoWeek,
  currentIsoWeek,
  formatIsoWeekLabel,
  isoWeekStart,
  toIsoWeek,
} from '../utils/iso-week';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'Stats' }]);

const { usePeriodGitStatsQuery, useProjectsQuery } = useQueries();

// Deliberately not persisted — landing on the current period with no filter is
// the right default on every visit, regardless of where the last session ended.
type Granularity = 'week' | 'month' | 'year';

const granularity = ref<Granularity>('month');
const selectedMonth = ref(dayjs().format('YYYY-MM'));
const selectedWeek = ref(currentIsoWeek());
const selectedYear = ref(dayjs().format('YYYY'));
// Empty means every project, which is also what the API assumes.
const selectedProjects = ref<string[]>([]);

const selectedPeriod = computed({
  get: () => {
    switch (granularity.value) {
      case 'week':
        return selectedWeek.value;
      case 'year':
        return selectedYear.value;
      default:
        return selectedMonth.value;
    }
  },
  set: value => {
    if (granularity.value === 'week') selectedWeek.value = value;
    else if (granularity.value === 'year') selectedYear.value = value;
    else selectedMonth.value = value;
  },
});

/**
 * The day that anchors the current view — used to carry your place across a
 * granularity change. Mid-period rather than the first day, so switching to a
 * finer granularity lands inside the period rather than on its boundary.
 */
const anchorDate = () => {
  const now = dayjs();
  switch (granularity.value) {
    case 'week':
      return isoWeekStart(selectedWeek.value);
    case 'year': {
      const start = dayjs(`${selectedYear.value}-01-01`);
      return start.isSame(now, 'year') ? now : start.month(6);
    }
    default: {
      const start = dayjs(`${selectedMonth.value}-01`);
      return start.isSame(now, 'month') ? now : start.date(15);
    }
  }
};

/**
 * Switch granularity without losing your place: the new period is the one
 * containing the period you were looking at, so stepping back to March and
 * switching to weeks lands in March rather than jumping to today.
 */
const setGranularity = (next: Granularity) => {
  if (next === granularity.value) return;

  const anchor = anchorDate();
  if (next === 'week') selectedWeek.value = toIsoWeek(anchor);
  else if (next === 'year') selectedYear.value = anchor.format('YYYY');
  else selectedMonth.value = anchor.format('YYYY-MM');

  granularity.value = next;
};

const periodLabel = computed(() => {
  switch (granularity.value) {
    case 'week':
      return formatIsoWeekLabel(selectedWeek.value);
    case 'year':
      return selectedYear.value;
    default:
      return dayjs(`${selectedMonth.value}-01`).format('MMMM YYYY');
  }
});

const { data: projectsData, isLoading: isLoadingProjects } = useProjectsQuery({ enabled: true });
const {
  data: stats,
  isLoading,
  isFetching,
} = usePeriodGitStatsQuery(granularity, selectedPeriod, selectedProjects);

// Only meaningless for exactly one project, where the count would always read 1.
const isSingleProject = computed(() => selectedProjects.value.length === 1);

const totals = computed(() => stats.value?.totals);
const days = computed(() => stats.value?.days ?? []);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const max = (values: number[]) => Math.max(...values, 0);

const isYearMode = computed(() => granularity.value === 'year');

/** Daily for week/month; weekly buckets for a year, which is too dense to plot. */
const series = (
  key: 'commits' | 'filesChanged' | 'linesAdded' | 'linesRemoved' | 'projectsWorkedOn',
  combine: (values: number[]) => number = sum
) =>
  computed(() => {
    const entries = days.value.map(day => ({ date: day.date, value: day[key] }));
    return isYearMode.value ? bucketByIsoWeek(entries, combine) : entries;
  });

const dailyCommits = series('commits');
const dailyFilesChanged = series('filesChanged');
const dailyLinesAdded = series('linesAdded');
const dailyLinesRemoved = series('linesRemoved');
// Distinct project counts don't add across days, so show the week's peak.
const dailyProjects = series('projectsWorkedOn', max);

// Binary activity, so the streak sparkline reads as "did I commit" rather than
// "how much" — matching how the dashboard renders it. Bucketed to a year, a
// week counts as active if any of its days were.
const dailyActivity = computed(() => {
  const entries = days.value.map(day => ({ date: day.date, value: day.commits > 0 ? 1 : 0 }));
  return isYearMode.value ? bucketByIsoWeek(entries, values => (max(values) > 0 ? 1 : 0)) : entries;
});

const heatmapDays = computed(() => days.value.map(day => ({ date: day.date, value: day.commits })));

// A period that already ended has no running streak, so show its peak instead.
const isCurrentPeriod = computed(() => {
  switch (granularity.value) {
    case 'week':
      return selectedWeek.value === currentIsoWeek();
    case 'year':
      return selectedYear.value === dayjs().format('YYYY');
    default:
      return selectedMonth.value === dayjs().format('YYYY-MM');
  }
});
const streakLabel = computed(() => (isCurrentPeriod.value ? 'Day Streak' : 'Longest Streak'));
const streakValue = computed(() => {
  const streaks = stats.value?.detail?.streaks;
  if (!streaks) return 0;
  return isCurrentPeriod.value && streaks.current > 0 ? streaks.current : streaks.longest;
});

const formatNumber = (value: number | undefined) => (value ?? 0).toLocaleString();
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Segmented toggle; the active side is the one carrying the accent. -->
        <div class="flex items-center rounded-md border p-0.5">
          <Button
            v-for="option in ['week', 'month', 'year'] as const"
            :key="option"
            size="sm"
            :variant="granularity === option ? 'secondary' : 'ghost'"
            :class="granularity === option ? 'text-primary-500' : 'text-slate-500'"
            class="capitalize"
            @click="setGranularity(option)"
          >
            {{ option }}
          </Button>
        </div>

        <PeriodStepper v-model="selectedPeriod" :granularity="granularity" />
      </div>

      <ProjectFilterCombobox
        v-model="selectedProjects"
        :projects="projectsData ?? []"
        :is-loading="isLoadingProjects"
      />
    </div>

    <!-- Dimmed rather than replaced while stepping, so the page keeps its shape
         instead of collapsing into skeletons on every click. -->
    <div class="space-y-6 transition-opacity" :class="isFetching && !isLoading ? 'opacity-60' : ''">
      <!-- Three across: six tiles (seven when a single project swaps Projects
           for Net Lines) divide evenly, and keeping the count low leaves each
           tile wide enough that long values don't overflow the card. -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
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
          v-if="isSingleProject"
          :icon="Scale"
          label="Net Lines"
          :value="formatNumber(totals?.netLines)"
          icon-class="text-slate-500"
          :is-loading="isLoading"
        />
      </div>

      <StatsHighlightsCard
        :detail="stats?.detail"
        :totals="totals"
        :month-label="periodLabel"
        :is-loading="isLoading"
      />

      <Card>
        <CardHeader>
          <CardTitle class="text-base">Activity in {{ periodLabel }}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap :days="heatmapDays" :is-loading="isLoading" />
        </CardContent>
      </Card>

      <div class="grid gap-4 lg:grid-cols-2">
        <StatsTopFilesCard
          :files="stats?.detail?.topFiles ?? []"
          :month-label="periodLabel"
          :is-loading="isLoading"
        />
        <StatsLanguageCard
          :languages="stats?.detail?.languages ?? []"
          :month-label="periodLabel"
          :is-loading="isLoading"
        />
      </div>
    </div>
  </div>
</template>
