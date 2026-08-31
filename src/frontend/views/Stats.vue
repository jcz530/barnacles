<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import dayjs from 'dayjs';
import {
  FileText,
  Flame,
  FolderGit2,
  GitCommit,
  Minus,
  Plus,
  Scale,
  Share2,
} from 'lucide-vue-next';
import GitStatCard from '../components/projects/molecules/GitStatCard.vue';
import PeriodStepper from '../components/projects/molecules/PeriodStepper.vue';
import StatDetailPanel from '../components/projects/organisms/StatDetailPanel.vue';
import StatsHighlightsCard from '../components/projects/organisms/StatsHighlightsCard.vue';
import StatsLanguageCard from '../components/projects/organisms/StatsLanguageCard.vue';
import StatsActiveProjectsCard from '../components/projects/organisms/StatsActiveProjectsCard.vue';
import ProjectFilterCombobox from '../components/projects/molecules/ProjectFilterCombobox.vue';
import ShareStatsDialog from '../components/projects/organisms/ShareStatsDialog.vue';
import SegmentedControl from '../components/ui/atoms/SegmentedControl.vue';
import { Button } from '../components/ui/button';
import {
  bucketByIsoWeek,
  currentIsoWeek,
  formatIsoWeekLabel,
  isoWeekStart,
  toIsoWeek,
} from '@shared/utils/iso-week';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'Stats' }]);

const { usePeriodGitStatsQuery, useProjectsQuery } = useQueries();

// Deliberately not persisted — landing on the current period with no filter is
// the right default on every visit, regardless of where the last session ended.
type Granularity = 'week' | 'month' | 'year';

const granularity = ref<Granularity>('month');

const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];
const selectedMonth = ref(dayjs().format('YYYY-MM'));
const selectedWeek = ref(currentIsoWeek());
const selectedYear = ref(dayjs().format('YYYY'));
// Empty means every project, which is also what the API assumes.
// A ?projectId= link (e.g. from a project's detail page) seeds the filter so the
// page opens scoped to that project. Read once on setup rather than kept in sync:
// clearing the filter should not have to rewrite the URL, and revisiting /stats
// without the param still lands unfiltered, per the note above.
const route = useRoute();
const projectIdParam = route.query.projectId;
const initialProjectIds =
  typeof projectIdParam === 'string' && projectIdParam ? [projectIdParam] : [];
const selectedProjects = ref<string[]>(initialProjectIds);

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

/** Raw per-day series, before any year-mode bucketing. */
const rawSeries = (key: 'commits' | 'filesChanged' | 'linesAdded' | 'linesRemoved') =>
  computed(() => days.value.map(day => ({ date: day.date, value: day[key] })));

const rawCommits = rawSeries('commits');
const rawFilesChanged = rawSeries('filesChanged');
const rawLinesAdded = rawSeries('linesAdded');
const rawLinesRemoved = rawSeries('linesRemoved');
const rawProjects = computed(() =>
  days.value.map(day => ({ date: day.date, value: day.projectsWorkedOn }))
);
const rawActivity = computed(() =>
  days.value.map(day => ({ date: day.date, value: day.commits > 0 ? 1 : 0 }))
);

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
const dailyActivity = computed(() =>
  isYearMode.value
    ? bucketByIsoWeek(rawActivity.value, values => (max(values) > 0 ? 1 : 0))
    : rawActivity.value
);

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

interface DatedValue {
  date: string;
  value: number;
}

/**
 * One definition per tile, so the grid and the expanded panel can't drift.
 *
 * `series` is what the small tile plots (bucketed in year mode, since it has
 * room for ~53 bars); `detailDays` is always per-day, because the expanded
 * chart is full width and can render every day of a year.
 */
const allStats = computed(() => [
  {
    key: 'streak',
    icon: Flame,
    label: streakLabel.value,
    value: streakValue.value,
    iconClass: 'text-primary-500',
    series: dailyActivity.value,
    // Per-day like every other stat: passing the bucketed series here made the
    // panel treat a year as ~53 entries and label it like a month.
    detailDays: rawActivity.value,
    // A 0/1 flag: totals and averages of it would be meaningless.
    isBinary: true,
    alwaysShow: true,
  },
  {
    key: 'commits',
    icon: GitCommit,
    label: 'Commits',
    value: formatNumber(totals.value?.commits),
    series: dailyCommits.value,
    detailDays: rawCommits.value,
    alwaysShow: true,
  },
  {
    key: 'files',
    icon: FileText,
    label: 'Files Changed',
    value: formatNumber(totals.value?.filesChanged),
    series: dailyFilesChanged.value,
    detailDays: rawFilesChanged.value,
    alwaysShow: true,
  },
  {
    key: 'projects',
    icon: FolderGit2,
    label: 'Projects',
    value: formatNumber(totals.value?.projectsWorkedOn),
    iconClass: 'text-slate-500',
    series: dailyProjects.value,
    detailDays: rawProjects.value,
    // Always reads 1 when a single project is selected.
    hideWhenSingleProject: true,
  },
  {
    key: 'added',
    icon: Plus,
    label: 'Lines Added',
    value: formatNumber(totals.value?.linesAdded),
    iconClass: 'text-success-500',
    series: dailyLinesAdded.value,
    detailDays: rawLinesAdded.value,
    alwaysShow: true,
  },
  {
    key: 'removed',
    icon: Minus,
    label: 'Lines Removed',
    value: formatNumber(totals.value?.linesRemoved),
    iconClass: 'text-danger-500',
    series: dailyLinesRemoved.value,
    detailDays: rawLinesRemoved.value,
    alwaysShow: true,
  },
  {
    key: 'net',
    icon: Scale,
    label: 'Net Lines',
    value: formatNumber(totals.value?.netLines),
    iconClass: 'text-slate-500',
    // Net lines can go negative, which the bar chart has no way to render, so
    // this tile carries a figure only.
    series: [] as DatedValue[],
    detailDays: [] as DatedValue[],
    onlyWhenSingleProject: true,
  },
]);

const visibleStats = computed(() =>
  allStats.value.filter(stat => {
    if (stat.hideWhenSingleProject) return !isSingleProject.value;
    if (stat.onlyWhenSingleProject) return isSingleProject.value;
    return true;
  })
);

const isSharing = ref(false);

const expandedKey = ref<string | null>(null);

const expandedStat = computed(() =>
  expandedKey.value ? (visibleStats.value.find(s => s.key === expandedKey.value) ?? null) : null
);

// Changing period or filter can retire the expanded tile (Projects and Net
// Lines swap with the filter), which would otherwise leave an empty panel.
watch(visibleStats, stats => {
  if (expandedKey.value && !stats.some(stat => stat.key === expandedKey.value)) {
    expandedKey.value = null;
  }
});
</script>

<template>
  <!-- min-w-0 so a wide child (the year heatmap's 53 columns) scrolls inside its
       own card rather than stretching the page. -->
  <div class="min-w-0 space-y-6 p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Routed through setGranularity rather than bound directly: switching
             granularity carries your place across, it is not a plain assign. -->
        <SegmentedControl
          :model-value="granularity"
          :options="GRANULARITY_OPTIONS"
          @update:model-value="setGranularity"
        />

        <PeriodStepper v-model="selectedPeriod" :granularity="granularity" />
      </div>

      <div class="flex items-center gap-2">
        <ProjectFilterCombobox
          v-model="selectedProjects"
          :projects="projectsData ?? []"
          :is-loading="isLoadingProjects"
        />

        <!-- Nothing worth sharing from an empty period, so don't offer it. -->
        <Button
          variant="outline"
          size="sm"
          :disabled="isLoading || !totals?.commits"
          @click="isSharing = true"
        >
          <Share2 class="size-4" />
          Share
        </Button>
      </div>
    </div>

    <ShareStatsDialog
      v-model:open="isSharing"
      :stats="stats"
      :period-label="periodLabel"
      :granularity="granularity"
      :selected-projects="selectedProjects"
      :all-projects="projectsData ?? []"
    />

    <!-- Dimmed rather than replaced while stepping, so the page keeps its shape
         instead of collapsing into skeletons on every click. -->
    <div class="space-y-6 transition-opacity" :class="isFetching && !isLoading ? 'opacity-60' : ''">
      <!-- Three across: six tiles (seven when a single project swaps Projects
           for Net Lines) divide evenly, and keeping the count low leaves each
           tile wide enough that long values don't overflow the card. -->
      <!-- Expanded stat takes the whole grid's place; the tiles come back on
           close. -->
      <StatDetailPanel
        v-if="expandedStat"
        :icon="expandedStat.icon"
        :label="expandedStat.label"
        :value="expandedStat.value"
        :icon-class="expandedStat.iconClass"
        :days="expandedStat.detailDays"
        :period-label="periodLabel"
        :is-binary="expandedStat.isBinary"
        :is-loading="isLoading"
        @close="expandedKey = null"
      />

      <div v-else class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <button
          v-for="stat in visibleStats"
          :key="stat.key"
          type="button"
          class="focus-visible:ring-primary-500 cursor-pointer rounded-lg text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:outline-none dark:hover:bg-slate-900"
          :aria-label="`Show ${stat.label} details`"
          @click="expandedKey = stat.key"
        >
          <GitStatCard
            :icon="stat.icon"
            :label="stat.label"
            :value="stat.value"
            :icon-class="stat.iconClass"
            :daily-values="stat.series"
            :is-loading="isLoading"
            :hide-values="stat.isBinary"
          />
        </button>
      </div>

      <StatsHighlightsCard
        :granularity="granularity"
        :detail="stats?.detail"
        :totals="totals"
        :month-label="periodLabel"
        :is-loading="isLoading"
      />

      <div class="grid gap-4 lg:grid-cols-2">
        <StatsActiveProjectsCard
          :projects="stats?.detail?.perProject ?? []"
          :all-projects="projectsData ?? []"
          :period-label="periodLabel"
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
