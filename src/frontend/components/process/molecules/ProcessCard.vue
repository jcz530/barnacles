<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
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
  delete: [processId: string];
}>();

const handleSelect = () => {
  emit('select', props.process);
};

const handleKill = (event: MouseEvent) => {
  event.stopPropagation();
  emit('kill', props.process.processId);
};

const handleDelete = (event: MouseEvent) => {
  event.stopPropagation();
  emit('delete', props.process.processId);
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
      isSelected
        ? 'border-2 border-b-4 border-sky-500 shadow'
        : 'border-slate-200 bg-none hover:border-slate-300',
    ]"
    @click="handleSelect"
  >
    <div class="flex items-start justify-between">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">
          {{ process.title || process.name || process.command || 'Process' }}
        </p>
        <router-link
          v-if="showProjectLink && project && project.name"
          class="mt-1 cursor-pointer truncate text-xs text-slate-500 hover:text-sky-600"
          :to="{ name: 'ProjectTerminals', params: { id: process.projectId } }"
        >
          {{ project.name }}
        </router-link>
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
      <div v-if="process.status === 'running'" class="ml-2 flex-shrink-0">
        <Button variant="ghost" size="sm" class="h-6 w-6 p-0" @click="handleKill"> × </Button>
      </div>
      <div v-if="isStopped" class="ml-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          class="h-6 w-6 p-0 text-slate-500 hover:text-red-600"
          @click="handleDelete"
        >
          <Trash2 title="Clear" class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
