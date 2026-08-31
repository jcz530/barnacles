<script setup lang="ts">
import { computed } from 'vue';
import { Clock, FolderGit2, GitBranch, RefreshCw, SquareTerminal } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../../shared/types/api';
import { useFormatters } from '../../../composables/useFormatters';
import { useQueries } from '../../../composables/useQueries';
import { useProjectActions } from '@/composables/useProjectActions';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { toastDanger, toastSuccess } from '../../ui/sonner';

interface Props {
  project: ProjectWithDetails;
}
const props = defineProps<Props>();

const { formatDate } = useFormatters();
const { getGitProvider, openGitRemote } = useProjectActions();
const { useSyncWorktreesMutation, useOpenProjectMutation, useOpenTerminalMutation } = useQueries();

const syncMutation = useSyncWorktreesMutation();
const openProjectMutation = useOpenProjectMutation();
const openTerminalMutation = useOpenTerminalMutation();

const gitProvider = computed(() => getGitProvider(props.project.stats?.gitRemoteUrl));

const worktrees = computed(() => props.project.worktrees ?? []);
const mainWorktree = computed(() => worktrees.value.find(worktree => worktree.isMain));

// With one checkout, "current branch" is unambiguous and a list would be noise.
// With several, the single-branch summary is actively misleading, so show them all.
const showWorktreeList = computed(() => worktrees.value.length > 1);

const isGitProject = computed(
  () => worktrees.value.length > 0 || !!props.project.stats?.gitRemoteUrl
);

// reka-ui's scroll viewport is height:100%, so it needs a real height on the
// root -- a max-height alone leaves it unconstrained and the card just grows.
// Size to the content up to a cap, so two worktrees don't leave a gap and eight
// don't stretch the card past its neighbour in the grid.
// A row is ~130px plus the 12px gap between them. Capping at 2.5 rows leaves a
// partial row visible, which reads as "there is more" rather than as a cut-off.
const WORKTREE_ROW_HEIGHT = 142;
const MAX_VISIBLE_ROWS = 2.4;

const listHeight = computed(() => {
  const rows = Math.min(worktrees.value.length, MAX_VISIBLE_ROWS);
  return `${Math.round(rows * WORKTREE_ROW_HEIGHT)}px`;
});

/** Drops the home-directory prefix; keeps the end, which identifies the checkout. */
const shortenPath = (fullPath: string): string => {
  const parts = fullPath.split('/').filter(Boolean);
  return parts.length > 4 ? `…/${parts.slice(-4).join('/')}` : fullPath;
};

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
          <GitBranch class="h-5 w-5" />
          {{ showWorktreeList ? 'Worktrees' : 'Git Information' }}
          <span v-if="showWorktreeList" class="text-sm font-normal text-slate-500">
            ({{ worktrees.length }})
          </span>
        </span>
        <Button
          v-if="showWorktreeList"
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
      <div v-if="isGitProject" class="space-y-4">
        <!-- The remote belongs to the repository, so it stays on both views.
             Label and value share one line: it is a short value, and the space
             is better spent on the worktree list below. -->
        <div class="flex items-baseline gap-2">
          <span class="text-sm font-medium text-slate-500">Remote</span>
          <Button
            v-if="project.stats?.gitRemoteUrl && gitProvider"
            variant="link"
            class="h-auto p-0 font-mono text-sm"
            :title="gitProvider.webUrl"
            @click="() => openGitRemote(gitProvider.webUrl)"
          >
            {{ gitProvider.name }}
          </Button>
          <span v-else class="font-mono text-sm text-slate-900">Unset</span>
        </div>

        <!-- Several checkouts: list them. Capped and scrolled so a repo with many
             worktrees cannot stretch the card past its neighbours in the grid. -->
        <ScrollArea v-if="showWorktreeList" class="pr-3" :style="{ height: listHeight }">
          <div class="space-y-3">
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

                  <div
                    class="mt-1 truncate font-mono text-xs text-slate-500"
                    :title="worktree.path"
                  >
                    {{ shortenPath(worktree.path) }}
                  </div>

                  <div v-if="worktree.lastCommitMessage" class="mt-2">
                    <div
                      class="truncate text-sm text-slate-700"
                      :title="worktree.lastCommitMessage"
                    >
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
        </ScrollArea>

        <!-- Single checkout: the original summary, which reads better than a
             one-row list. -->
        <template v-else>
          <div v-if="mainWorktree">
            <div class="text-sm font-medium text-slate-500">Current Branch</div>
            <div class="mt-1 font-mono text-sm text-slate-900">
              {{ mainWorktree.branch || 'detached HEAD' }}
            </div>
          </div>
          <div v-if="mainWorktree?.lastCommitMessage">
            <div class="text-sm font-medium text-slate-500">Last Commit</div>
            <div class="mt-1 text-sm text-slate-900">
              {{ mainWorktree.lastCommitMessage }}
            </div>
            <div
              v-if="mainWorktree.lastCommitDate"
              class="mt-1 flex items-center gap-1.5 text-xs text-slate-500"
            >
              <Clock class="h-3.5 w-3.5" />
              {{ formatDate(mainWorktree.lastCommitDate) }}
            </div>
          </div>
          <div v-if="mainWorktree?.hasUncommittedChanges">
            <span
              class="inline-flex items-center gap-1.5 rounded-md bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700"
            >
              <span class="h-2 w-2 rounded-full bg-orange-500"></span>
              Uncommitted Changes
            </span>
          </div>
          <div v-else-if="mainWorktree">
            <span
              class="bg-success-100 text-success-700 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
            >
              <span class="bg-success-500 h-2 w-2 rounded-full"></span>
              Clean Working Tree
            </span>
          </div>
        </template>
      </div>
      <div v-else class="text-sm text-slate-500">No git repository detected</div>
    </CardContent>
  </Card>
</template>
