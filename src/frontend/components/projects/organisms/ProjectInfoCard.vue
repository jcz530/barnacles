<script setup lang="ts">
import { Copy, Folder } from 'lucide-vue-next';
import { useClipboard } from '@vueuse/core';
import type { Project } from '../../../../shared/types/api';
import { useFormatters } from '../../../composables/useFormatters';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';

interface Props {
  project: Project;
}

const props = defineProps<Props>();

const { formatDate } = useFormatters();
const { copy, copied } = useClipboard();

const copyPath = () => {
  copy(props.project.path);
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Folder class="h-5 w-5" />
        Project Information
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div>
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-slate-500">Path</div>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 w-7 p-0"
            @click="copyPath"
            :title="copied ? 'Copied!' : 'Copy path'"
          >
            <Copy class="h-4 w-4" :class="{ 'text-emerald-600': copied }" />
          </Button>
        </div>
        <div class="mt-1 overflow-scroll rounded bg-slate-100 p-1 font-mono text-sm text-slate-700">
          {{ project.path }}
        </div>
      </div>
      <div>
        <div class="text-sm font-medium text-slate-500">Status</div>
        <div class="mt-1">
          <span
            class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="{
              'bg-emerald-100 text-emerald-700': !project.archivedAt,
              'bg-slate-100 text-slate-700': !!project.archivedAt,
            }"
          >
            {{ project.archivedAt ? 'Archived' : 'Active' }}
          </span>
        </div>
      </div>
      <div>
        <div class="text-sm font-medium text-slate-500">Created</div>
        <div class="mt-1 text-sm text-slate-900">
          {{ formatDate(project.createdAt) }}
        </div>
      </div>
      <div>
        <div class="text-sm font-medium text-slate-500">Last Updated</div>
        <div class="mt-1 text-sm text-slate-900">
          {{ formatDate(project.updatedAt) }}
        </div>
      </div>
    </CardContent>
  </Card>
</template>
