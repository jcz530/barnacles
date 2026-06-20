<script setup lang="ts">
import { computed } from 'vue';
import { getProcessInfo } from '@/constants/processEnrichment';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

const props = defineProps<{
  processName: string;
  scriptName?: string;
}>();

const info = computed(() => getProcessInfo(props.processName));
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <div class="flex items-center gap-1.5">
      <span class="text-slate-900">{{ processName }}</span>
      <!-- scriptName badge hidden for now -->
      <span
        v-if="false && scriptName"
        class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-500"
        :title="`Matches package.json script “${scriptName}”`"
      >
        {{ scriptName }}
      </span>
    </div>
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
