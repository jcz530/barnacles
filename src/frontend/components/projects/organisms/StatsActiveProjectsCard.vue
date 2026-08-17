<script setup lang="ts">
import { computed } from 'vue';
import { FolderGit2 } from 'lucide-vue-next';
import type { GitStatsPerProject, ProjectWithDetails } from '../../../../shared/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

const props = withDefaults(
  defineProps<{
    /** Already sorted by commits descending, and only projects with activity. */
    projects: GitStatsPerProject[];
    /** Used to resolve a repo path to its display name. */
    allProjects: ProjectWithDetails[];
    periodLabel: string;
    isLoading?: boolean;
    limit?: number;
  }>(),
  { isLoading: false, limit: 8 }
);

const nameByPath = computed(() => {
  const map = new Map<string, string>();
  for (const project of props.allProjects) map.set(project.path, project.name);
  return map;
});

/** Fall back to the last path segment when a project is no longer tracked. */
const displayName = (path: string) =>
  nameByPath.value.get(path) ?? path.slice(path.lastIndexOf('/') + 1);

const visible = computed(() => props.projects.slice(0, props.limit));

// Bars are scaled against the busiest project so the list reads as a ranking
// rather than a set of near-identical slivers.
const maxCommits = computed(() => Math.max(...visible.value.map(p => p.commits), 1));

const totalCommits = computed(() => props.projects.reduce((sum, p) => sum + p.commits, 0));

const share = (commits: number) =>
  totalCommits.value ? Math.round((commits / totalCommits.value) * 100) : 0;
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <FolderGit2 class="size-4 text-slate-500" />
        Most active projects
      </CardTitle>
      <CardDescription>By commits in {{ periodLabel }}</CardDescription>
    </CardHeader>

    <CardContent>
      <div v-if="isLoading" class="space-y-3">
        <div
          v-for="row in 5"
          :key="row"
          class="h-8 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"
        />
      </div>

      <p v-else-if="!visible.length" class="py-8 text-center text-sm text-slate-500">
        No commits in {{ periodLabel }}
      </p>

      <ul v-else class="space-y-3">
        <li v-for="project in visible" :key="project.projectPath">
          <div class="flex items-baseline justify-between gap-3">
            <span
              class="truncate text-sm text-slate-700 dark:text-slate-300"
              :title="project.projectPath"
            >
              {{ displayName(project.projectPath) }}
            </span>
            <span class="shrink-0 text-xs text-slate-500">
              {{ project.commits.toLocaleString() }}
              {{ project.commits === 1 ? 'commit' : 'commits' }}
              <span class="text-slate-400">· {{ share(project.commits) }}%</span>
            </span>
          </div>

          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              class="bg-primary-500 h-full rounded-full"
              :style="{ width: `${(project.commits / maxCommits) * 100}%` }"
            />
          </div>

          <div class="mt-1 flex gap-3 font-mono text-[10px]">
            <span class="text-success-600 dark:text-success-400">
              +{{ project.linesAdded.toLocaleString() }}
            </span>
            <span class="text-danger-600 dark:text-danger-400">
              −{{ project.linesRemoved.toLocaleString() }}
            </span>
            <span class="text-slate-400">
              {{ project.filesChanged.toLocaleString() }}
              {{ project.filesChanged === 1 ? 'file' : 'files' }}
            </span>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
