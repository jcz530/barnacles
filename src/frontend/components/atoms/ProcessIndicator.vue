<script setup lang="ts">
import { ArrowRight, ExternalLink } from 'lucide-vue-next';
import type { ProcessStatus } from '../../../shared/types/process';
import Button from '../ui/button/Button.vue';

defineProps<{
  process: ProcessStatus;
  onNavigateToProcess?: () => void;
}>();

const openUrl = (url: string) => {
  window.open(url, '_blank');
};
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-0 text-sm"
  >
    <div class="flex items-center gap-1.5" :title="process.name">
      <div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
      <span class="font-medium text-green-700">Running</span>
    </div>

    <div v-if="process.url || process.detectedUrl" class="flex items-center gap-1">
      <span class="text-slate-600">•</span>
      <Button
        variant="link"
        @click="openUrl(process.url || process.detectedUrl || '')"
        class="flex items-center gap-1 !px-0 text-blue-600 hover:text-blue-700 hover:underline"
      >
        {{ process.url || process.detectedUrl }}
        <ExternalLink class="h-3 w-3" />
      </Button>
    </div>

    <button
      v-if="onNavigateToProcess"
      @click="onNavigateToProcess"
      class="ml-1 flex items-center gap-1 text-slate-600 hover:text-slate-800"
      title="View process"
    >
      <ArrowRight class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
