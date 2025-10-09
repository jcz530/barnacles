<script setup lang="ts">
import { ArrowRight, ExternalLink } from 'lucide-vue-next';
import type { ProcessStatus } from '../../../shared/types/process';
import { Button } from '../ui/button';

defineProps<{
  process: ProcessStatus;
  onNavigateToProcess?: () => void;
  compact?: boolean;
}>();

const openUrl = (url: string) => {
  window.open(url, '_blank');
};
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-0 text-sm"
  >
    <div class="flex items-center gap-1.5" :title="process.name">
      <div class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
      <span v-if="!compact" class="font-medium text-emerald-700">Running</span>
    </div>

    <div v-if="process.url || process.detectedUrl" class="flex items-center gap-1">
      <span v-if="!compact" class="text-slate-600">•</span>
      <Button
        variant="link"
        @click="openUrl(process.url || process.detectedUrl || '')"
        class="flex h-auto items-center gap-1 !px-0 !py-1 text-sky-600 hover:text-sky-700 hover:underline"
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
