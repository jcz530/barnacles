<script setup lang="ts">
import { Clock, GitBranch } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../../shared/types/api';
import { useFormatters } from '../../../composables/useFormatters';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { computed } from 'vue';
import { useProjectActions } from '@/composables/useProjectActions';

interface Props {
  project: ProjectWithDetails;
}
const props = defineProps<Props>();

const { getGitProvider, openGitRemote } = useProjectActions();

const gitProvider = computed(() => getGitProvider(props.project.stats.gitRemoteUrl));

const { formatDate } = useFormatters();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <GitBranch class="h-5 w-5" />
        Git Information
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div v-if="project.stats?.gitBranch" class="space-y-4">
        <div>
          <div class="text-sm font-medium text-slate-500">Remote</div>
          <div class="mt-1 font-mono text-sm text-slate-900">
            <Button
              v-if="project.stats.gitRemoteUrl"
              variant="link"
              :title="gitProvider.webUrl"
              @click="() => openGitRemote(gitProvider.webUrl)"
            >
              {{ gitProvider.name }}</Button
            >
            <p v-else>Unset</p>
          </div>
        </div>
        <div>
          <div class="text-sm font-medium text-slate-500">Current Branch</div>
          <div class="mt-1 font-mono text-sm text-slate-900">
            {{ project.stats.gitBranch }}
          </div>
        </div>
        <div v-if="project.stats.lastCommitMessage">
          <div class="text-sm font-medium text-slate-500">Last Commit</div>
          <div class="mt-1 text-sm text-slate-900">
            {{ project.stats.lastCommitMessage }}
          </div>
          <div
            v-if="project.stats.lastCommitDate"
            class="mt-1 flex items-center gap-1.5 text-xs text-slate-500"
          >
            <Clock class="h-3.5 w-3.5" />
            {{ formatDate(project.stats.lastCommitDate) }}
          </div>
        </div>
        <div v-if="project.stats.hasUncommittedChanges">
          <span
            class="inline-flex items-center gap-1.5 rounded-md bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700"
          >
            <span class="h-2 w-2 rounded-full bg-orange-500"></span>
            Uncommitted Changes
          </span>
        </div>
        <div v-else>
          <span
            class="bg-success-100 text-success-700 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
          >
            <span class="bg-success-500 h-2 w-2 rounded-full"></span>
            Clean Working Tree
          </span>
        </div>
      </div>
      <div v-else class="text-sm text-slate-500">No git repository detected</div>
    </CardContent>
  </Card>
</template>
