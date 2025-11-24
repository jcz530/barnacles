<script setup lang="ts">
import { ref } from 'vue';
import { useQueries } from '@/composables/useQueries';
import { FileText, Flame, FolderGit2, GitCommit, Minus, Plus } from 'lucide-vue-next';
import GitStatCard from '../molecules/GitStatCard.vue';
import { Button } from '../../ui/button';

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
            @click="selectedPeriod = period"
            :class="[selectedPeriod === period ? 'text-success-500' : '']"
          >
            {{ getPeriodLabel(period) }}
          </Button>
        </div>
      </div>
    </div>

    <div class="pt-4">
      <div v-if="isLoading" class="py-8 text-center">
        <p class="text-slate-500">Loading stats...</p>
      </div>

      <div v-else-if="stats" class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <GitStatCard
          :icon="Flame"
          label="Day Streak"
          :value="stats.streak"
          icon-class="text-orange-500"
        />
        <GitStatCard :icon="GitCommit" label="Commits" :value="stats.commits" />
        <GitStatCard :icon="FileText" label="Files Changed" :value="stats.filesChanged" />
        <GitStatCard
          :icon="FolderGit2"
          label="Projects"
          :value="stats.projectsWorkedOn"
          icon-class="text-blue-500"
        />
        <GitStatCard
          :icon="Plus"
          label="Lines Added"
          :value="stats.linesAdded.toLocaleString()"
          icon-class="text-green-500"
        />
        <GitStatCard
          :icon="Minus"
          label="Lines Removed"
          :value="stats.linesRemoved.toLocaleString()"
          icon-class="text-red-500"
        />
      </div>

      <div v-else class="py-8 text-center">
        <p class="text-slate-500">No stats available</p>
      </div>
    </div>
  </div>
</template>
