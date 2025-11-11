<script setup lang="ts">
import { ArrowRight, ExternalLink } from 'lucide-vue-next';
import { computed, type MaybeRefOrGetter } from 'vue';
import { Button } from '../ui/button';
import { useRunningProcesses } from '../../composables/useRunningProcesses';

const props = defineProps<{
  projectId: MaybeRefOrGetter<string>;
  onNavigateToProcess?: () => void;
  compact?: boolean;
}>();

// Get running processes for this project
const runningProcesses = useRunningProcesses(() => props.projectId);

// Get the first running process (if any)
const process = computed(() => runningProcesses.value[0]);

const openUrl = (url: string) => {
  window.open(url, '_blank');
};
</script>

<template>
  <div
    v-if="process"
    class="border-success-200 bg-success-300/20 inline-flex items-center gap-2 rounded-md border px-3 py-0 text-sm"
  >
    <div class="flex items-center gap-1.5" :title="process.name">
      <div class="bg-success-500 h-2 w-2 animate-pulse rounded-full"></div>
      <span v-if="!compact" class="text-success-700 font-medium">Running</span>
    </div>

    <div v-if="process.url || process.detectedUrl" class="flex items-center gap-1">
      <span v-if="!compact" class="text-slate-600">•</span>
      <Button
        variant="link"
        @click="openUrl(process.url || process.detectedUrl || '')"
        class="text-primary-600 hover:text-primary-700 flex h-auto items-center gap-1 !px-0 !py-1 hover:underline"
      >
        {{ process.url || process.detectedUrl }}
        <ExternalLink class="h-3 w-3" />
      </Button>
    </div>

    <button
      v-if="onNavigateToProcess"
      @click="onNavigateToProcess"
      class="ml-1 flex cursor-pointer items-center gap-1 text-slate-600 hover:text-slate-800"
      title="View process"
    >
      <ArrowRight class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
