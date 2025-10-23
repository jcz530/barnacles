<script setup lang="ts">
import { Calendar, Code2, FileText, FolderTree, HardDrive, Package } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../../shared/types/api';
import { useFormatters } from '../../../composables/useFormatters';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

interface Props {
  project: ProjectWithDetails;
}

defineProps<Props>();

const { formatSize, formatRelativeDate } = useFormatters();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <FileText class="h-5 w-5" />
        File Statistics
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <FileText class="h-4 w-4" />
          <span>Total Files</span>
        </div>
        <div class="text-lg font-semibold text-slate-900">
          {{ project.stats?.fileCount?.toLocaleString() || 0 }}
        </div>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <FolderTree class="h-4 w-4" />
          <span>Directories</span>
        </div>
        <div class="text-lg font-semibold text-slate-900">
          {{ project.stats?.directoryCount?.toLocaleString() || 0 }}
        </div>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <Code2 class="h-4 w-4" />
          <span>Lines of Code</span>
        </div>
        <div class="text-lg font-semibold text-slate-900">
          {{ project.stats?.linesOfCode?.toLocaleString() || 0 }}
        </div>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <HardDrive class="h-4 w-4" />
          <span>Project Size</span>
        </div>
        <div class="text-lg font-semibold text-slate-900">
          {{ formatSize(project.size) }}
        </div>
      </div>
      <div
        v-if="project.stats?.thirdPartySize && project.stats.thirdPartySize > 0"
        class="flex items-center justify-between"
      >
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <Package class="h-4 w-4" />
          <span>Third-Party Packages</span>
        </div>
        <div class="text-lg font-semibold text-amber-600">
          {{ formatSize(project.stats.thirdPartySize) }}
        </div>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <Calendar class="h-4 w-4" />
          <span>Last Modified</span>
        </div>
        <div class="text-sm text-slate-900">
          {{ formatRelativeDate(project.lastModified) }}
        </div>
      </div>
    </CardContent>
  </Card>
</template>
