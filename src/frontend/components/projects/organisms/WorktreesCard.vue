<script setup lang="ts">
import { computed } from 'vue';
import { Clock, FolderGit2, GitBranch, RefreshCw, SquareTerminal } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../../shared/types/api';
import { useFormatters } from '../../../composables/useFormatters';
import { useQueries } from '../../../composables/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { toastDanger, toastSuccess } from '../../ui/sonner';

interface Props {
  project: ProjectWithDetails;
}
const props = defineProps<Props>();

const { formatDate } = useFormatters();
const { useSyncWorktreesMutation, useOpenProjectMutation, useOpenTerminalMutation } = useQueries();

const syncMutation = useSyncWorktreesMutation();
const openProjectMutation = useOpenProjectMutation();
const openTerminalMutation = useOpenTerminalMutation();

const worktrees = computed(() => props.project.worktrees ?? []);

/** Drops the home-directory prefix; keeps the end, which identifies the checkout. */
const shortenPath = (fullPath: string): string => {
  const parts = fullPath.split('/').filter(Boolean);
  return parts.length > 4 ? `…/${parts.slice(-4).join('/')}` : fullPath;
};

// A single checkout is just "the repo" -- the card only earns its place once
// there is more than one, so linked worktrees are what it highlights.
const linkedCount = computed(() => worktrees.value.filter(worktree => !worktree.isMain).length);

const handleSync = async () => {
  try {
    await syncMutation.mutateAsync({ projectId: props.project.id });
    toastSuccess('Worktrees refreshed');
  } catch (error) {
    toastDanger(error instanceof Error ? error.message : 'Failed to refresh worktrees');
  }
};

const handleOpenIde = async (worktreePath: string) => {
  try {
    await openProjectMutation.mutateAsync({ projectId: props.project.id, worktreePath });
  } catch (error) {
    toastDanger(error instanceof Error ? error.message : 'Failed to open worktree');
  }
};

const handleOpenTerminal = async (worktreePath: string) => {
  try {
    await openTerminalMutation.mutateAsync({ projectId: props.project.id, worktreePath });
  } catch (error) {
    toastDanger(error instanceof Error ? error.message : 'Failed to open terminal');
  }
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2">
          <FolderGit2 class="h-5 w-5" />
          Worktrees
          <span v-if="linkedCount > 0" class="text-sm font-normal text-slate-500">
            ({{ worktrees.length }})
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          :disabled="syncMutation.isPending.value"
          title="Re-read worktrees from git"
          @click="handleSync"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': syncMutation.isPending.value }" />
        </Button>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div v-if="worktrees.length > 0" class="space-y-3">
        <div
          v-for="worktree in worktrees"
          :key="worktree.id"
          class="rounded-md border border-slate-200 p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <GitBranch class="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span class="font-mono text-sm text-slate-900">
                  {{ worktree.branch || 'detached HEAD' }}
                </span>
                <span
                  v-if="worktree.isMain"
                  class="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                >
                  main
                </span>
                <span
                  v-if="worktree.hasUncommittedChanges"
                  class="inline-flex items-center gap-1.5 rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
                  Uncommitted
                </span>
              </div>

              <!-- The tail of a worktree path is the informative part, so keep
                   the end visible and drop the shared prefix. -->
              <div class="mt-1 truncate font-mono text-xs text-slate-500" :title="worktree.path">
                {{ shortenPath(worktree.path) }}
              </div>

              <div v-if="worktree.lastCommitMessage" class="mt-2">
                <div class="truncate text-sm text-slate-700" :title="worktree.lastCommitMessage">
                  {{ worktree.lastCommitMessage }}
                </div>
                <div
                  v-if="worktree.lastCommitDate"
                  class="mt-1 flex items-center gap-1.5 text-xs text-slate-500"
                >
                  <Clock class="h-3.5 w-3.5" />
                  {{ formatDate(worktree.lastCommitDate) }}
                </div>
              </div>
            </div>

            <div class="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="Open in IDE"
                @click="handleOpenIde(worktree.path)"
              >
                <FolderGit2 class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Open in terminal"
                @click="handleOpenTerminal(worktree.path)"
              >
                <SquareTerminal class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-sm text-slate-500">No git repository detected</div>
    </CardContent>
  </Card>
</template>
