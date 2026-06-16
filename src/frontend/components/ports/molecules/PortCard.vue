<script setup lang="ts">
import { Cpu, Folder, Hash, X } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { PortEntry, ProjectWithDetails } from '../../../../../shared/types/api';
import { RouteNames } from '@/router';
import ProjectIcon from '../../projects/atoms/ProjectIcon.vue';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

const props = defineProps<{
  port: PortEntry;
  projectByPath: Map<string, ProjectWithDetails>;
}>();

const emit = defineEmits<{
  kill: [pid: number];
}>();

const matchedProject = computed(() => props.projectByPath.get(props.port.cwd ?? ''));
</script>

<template>
  <Card class="flex flex-col gap-0">
    <CardHeader class="pb-3">
      <div class="flex items-start justify-between">
        <div class="flex flex-col gap-1">
          <div class="font-mono text-3xl font-bold text-slate-900">:{{ port.port }}</div>
          <CardTitle class="text-base font-medium text-slate-700">
            {{ port.processName }}
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 shrink-0 text-slate-400 hover:text-red-500"
          title="Kill process"
          @click="emit('kill', port.pid)"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>

    <CardContent class="mt-auto space-y-2">
      <RouterLink
        v-if="matchedProject"
        :to="{ name: RouteNames.ProjectOverview, params: { id: matchedProject.id } }"
        class="flex items-center gap-2 text-slate-700 hover:underline"
      >
        <ProjectIcon
          :project-id="matchedProject.id"
          :project-name="matchedProject.name"
          :has-icon="!!matchedProject.icon"
          size="sm"
        />
        <span class="text-sm font-medium">{{ matchedProject.name }}</span>
      </RouterLink>
      <div
        v-else-if="port.cwd"
        class="flex items-center gap-1.5 text-xs text-slate-500"
        :title="port.cwd"
      >
        <Folder class="h-3.5 w-3.5 shrink-0" />
        <span class="truncate font-mono" dir="rtl">{{ port.cwd }}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div class="flex items-center gap-1.5">
          <Hash class="h-3.5 w-3.5 shrink-0" />
          <span class="font-mono">PID {{ port.pid }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <Cpu class="h-3.5 w-3.5 shrink-0" />
          <span>{{ port.protocol }}</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
