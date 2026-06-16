<script setup lang="ts">
import { computed } from 'vue';
import { getProcessInfo } from '@/constants/processEnrichment';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

const props = defineProps<{
  processName: string;
}>();

const info = computed(() => getProcessInfo(props.processName));
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <span class="text-slate-900">{{ processName }}</span>
    <Tooltip v-if="info">
      <TooltipTrigger as-child>
        <span class="cursor-default text-xs text-slate-400">{{ info.label }}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        <p>{{ info.description }}</p>
      </TooltipContent>
    </Tooltip>
  </div>
</template>
