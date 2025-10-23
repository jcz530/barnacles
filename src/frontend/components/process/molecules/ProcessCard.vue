<script setup lang="ts">
import { Button } from '../../ui/button';
import { useQueries } from '@/composables/useQueries';

const { useProjectQuery } = useQueries();

interface Process {
  processId: string;
  title?: string;
  name?: string;
  command?: string;
  projectId?: string;
  cwd?: string;
  status: 'running' | 'stopped' | 'failed';
}

interface Props {
  process: Process;
  isSelected: boolean;
  showProjectLink?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showProjectLink: true,
});

const emit = defineEmits<{
  select: [process: Process];
  kill: [processId: string];
  navigateToProject: [projectId: string];
}>();

const handleSelect = () => {
  emit('select', props.process);
};

const handleKill = (event: MouseEvent) => {
  event.stopPropagation();
  emit('kill', props.process.processId);
};

const handleNavigateToProject = (event: MouseEvent) => {
  event.stopPropagation();
  if (props.process.projectId) {
    emit('navigateToProject', props.process.projectId);
  }
};

const isStopped = props.process.status === 'stopped' || props.process.status === 'failed';

const { data: project } = useProjectQuery(props.process.projectId, {
  enabled: props.showProjectLink && !!props.process.projectId,
});
</script>

<template>
  <div
    :class="[
      'cursor-pointer rounded-lg border p-3 transition-all',
      isStopped && 'opacity-60',
      isSelected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-none hover:border-slate-300',
    ]"
    @click="handleSelect"
  >
    <div class="flex items-start justify-between">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">
          {{ process.title || process.name || process.command || 'Process' }}
        </p>
        <p
          v-if="showProjectLink && project && project.name"
          class="mt-1 cursor-pointer truncate text-xs text-slate-500 hover:text-sky-600"
          @click="handleNavigateToProject"
        >
          {{ project.name }}
        </p>
        <p
          v-if="process.cwd && process.status === 'running'"
          class="mt-1 truncate text-xs text-slate-400"
        >
          {{ process.cwd }}
        </p>
        <p v-if="isStopped" class="mt-1 text-xs text-slate-400">
          {{ process.status === 'failed' ? 'Failed' : 'Stopped' }}
        </p>
      </div>
      <Button
        v-if="process.status === 'running'"
        variant="ghost"
        size="sm"
        class="ml-2 h-6 w-6 flex-shrink-0 p-0"
        @click="handleKill"
      >
        ×
      </Button>
    </div>
  </div>
</template>
