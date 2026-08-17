<script setup lang="ts">
import { computed } from 'vue';
import { FileCode2 } from 'lucide-vue-next';
import type { GitStatsTopFile } from '../../../../shared/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

const props = withDefaults(
  defineProps<{
    files: GitStatsTopFile[];
    monthLabel: string;
    isLoading?: boolean;
    limit?: number;
  }>(),
  { isLoading: false, limit: 10 }
);

const visible = computed(() => props.files.slice(0, props.limit));

// Bars are scaled against the busiest file rather than the total, so the list
// reads as a ranking instead of a set of near-invisible slivers.
const maxChanges = computed(() => Math.max(...visible.value.map(f => f.changes), 1));

/** Leading directories, kept as the truncatable half of the path. */
const directoryOf = (filePath: string) => {
  const index = filePath.lastIndexOf('/');
  return index === -1 ? '' : filePath.slice(0, index + 1);
};

const fileNameOf = (filePath: string) => filePath.slice(filePath.lastIndexOf('/') + 1);

const addedWidth = (file: GitStatsTopFile) => `${(file.linesAdded / maxChanges.value) * 100}%`;
const removedWidth = (file: GitStatsTopFile) => `${(file.linesRemoved / maxChanges.value) * 100}%`;
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <FileCode2 class="size-4 text-slate-500" />
        Most changed files
      </CardTitle>
      <CardDescription>By lines added and removed in {{ monthLabel }}</CardDescription>
    </CardHeader>

    <CardContent>
      <div v-if="isLoading" class="space-y-3">
        <div
          v-for="row in 6"
          :key="row"
          class="h-8 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"
        />
      </div>

      <p v-else-if="!visible.length" class="py-8 text-center text-sm text-slate-500">
        No commits in {{ monthLabel }}
      </p>

      <ul v-else class="space-y-3">
        <li v-for="file in visible" :key="`${file.projectPath ?? ''}${file.path}`">
          <div class="flex items-baseline justify-between gap-3">
            <!-- The filename identifies the row, so keep it whole and let the
                 leading directories truncate instead. -->
            <span class="flex min-w-0 items-baseline text-sm" :title="file.path">
              <span class="truncate text-slate-400">{{ directoryOf(file.path) }}</span>
              <span class="shrink-0 text-slate-700 dark:text-slate-300">
                {{ fileNameOf(file.path) }}
              </span>
            </span>
            <span class="shrink-0 font-mono text-xs">
              <span class="text-success-600 dark:text-success-400">+{{ file.linesAdded }}</span>
              <span class="text-danger-600 dark:text-danger-400 ml-1.5">
                −{{ file.linesRemoved }}
              </span>
            </span>
          </div>

          <div class="mt-1 flex h-1.5 gap-px overflow-hidden rounded-full">
            <div class="bg-success-500" :style="{ width: addedWidth(file) }" />
            <div class="bg-danger-500" :style="{ width: removedWidth(file) }" />
            <div class="flex-1 bg-slate-100 dark:bg-slate-800" />
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
