<script setup lang="ts">
import { Folder, Globe, Hash, Loader2, X } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { PortEntry, ProjectWithDetails } from '@/shared/types/api';
import { RouteNames } from '@/router';
import ProjectIcon from '../../projects/atoms/ProjectIcon.vue';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader } from '../../ui/card';
import ProcessName from '../atoms/ProcessName.vue';

const props = defineProps<{
  port: PortEntry;
  projectByPath: Map<string, ProjectWithDetails>;
  httpInfo?: { isHttp: boolean; url: string; statusCode: number | null };
  screenshot?: string;
  isKilling?: boolean;
}>();

const emit = defineEmits<{
  kill: [pid: number];
}>();

const matchedProject = computed(() => props.projectByPath.get(props.port.cwd ?? ''));

const openUrl = (url: string) => {
  window.electron?.shell.openExternal(url);
};

const globeColor = (statusCode: number | null) => {
  if (statusCode === null) return 'text-slate-400';
  if (statusCode < 300) return 'text-success-500';
  if (statusCode < 400) return 'text-secondary-500';
  return 'text-danger-500';
};
</script>

<template>
  <Card class="flex flex-col gap-0">
    <CardHeader class="pb-3">
      <div class="flex items-start justify-between">
        <div class="flex flex-col gap-1">
          <div class="font-mono text-3xl font-bold text-slate-900">:{{ port.port }}</div>
          <ProcessName :process-name="port.processName" />
        </div>
        <div class="flex items-center gap-1">
          <button
            v-if="httpInfo?.isHttp"
            class="flex flex-col items-center gap-0.5 rounded p-1 hover:bg-slate-100"
            title="Open in browser"
            @click="openUrl(httpInfo.url)"
          >
            <Globe class="h-4 w-4" :class="globeColor(httpInfo.statusCode)" />
            <span
              v-if="(httpInfo.statusCode ?? 0) >= 300"
              class="font-mono text-[10px] leading-none"
              :class="globeColor(httpInfo.statusCode)"
            >
              {{ httpInfo.statusCode }}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 shrink-0"
            :class="props.isKilling ? 'cursor-default' : 'text-slate-400 hover:text-red-500'"
            :disabled="props.isKilling"
            title="Kill process"
            @click="emit('kill', port.pid)"
          >
            <Loader2 v-if="props.isKilling" class="h-4 w-4 animate-spin" />
            <X v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div v-if="screenshot" class="mt-2 overflow-hidden rounded border border-slate-100">
        <img :src="screenshot" class="h-24 w-full object-cover object-top" alt="Page preview" />
      </div>
      <div
        v-else-if="httpInfo === undefined"
        class="mt-1 h-1 w-8 animate-pulse rounded bg-slate-100"
      />
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
      <div class="text-xs text-slate-600">
        <div class="flex items-center gap-1.5">
          <Hash class="h-3.5 w-3.5 shrink-0" />
          <span class="font-mono">PID {{ port.pid }}</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
