<script setup lang="ts">
import { Folder } from 'lucide-vue-next';
import type { Project } from '../../../../shared/types/api';
import { useFormatters } from '../../../composables/useFormatters';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import CopyButton from '@/components/atoms/CopyButton.vue';

interface Props {
  project: Project;
}

defineProps<Props>();

const { formatDate } = useFormatters();
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
          <CopyButton :value="project.path" />
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
              'bg-success-100 text-success-700': !project.archivedAt,
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
