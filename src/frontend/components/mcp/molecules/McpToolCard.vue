<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';
import { Badge } from '../../ui/badge';
import type { McpToolInfo } from '../../../../shared/constants/mcp-tools';
import type { EventCount } from '../../../../shared/types/api';
import { useFormatters } from '../../../composables/useFormatters';

const props = defineProps<{
  tool: McpToolInfo;
  usage?: EventCount;
}>();

const { formatRelativeDate } = useFormatters();

const lastUsedLabel = computed(() =>
  props.usage?.lastUsedAt ? formatRelativeDate(new Date(props.usage.lastUsedAt)) : 'Never used'
);
</script>

<template>
  <div class="flex flex-col rounded-lg border border-slate-200 bg-slate-50/50 p-4">
    <!-- min-w-0 lets the long, unbroken tool name shrink instead of overflowing the card. -->
    <div class="mb-2 flex min-w-0 items-start justify-between gap-2">
      <code class="min-w-0 flex-1 font-mono text-sm font-semibold break-all text-slate-900">
        {{ tool.name }}
      </code>
      <Badge
        v-if="tool.destructive"
        variant="outline"
        class="text-danger-500 border-danger-500 shrink-0"
        title="Irreversible — only run when asked"
      >
        <AlertTriangle class="h-3 w-3" />
      </Badge>
    </div>

    <p class="mb-3 line-clamp-3 text-sm text-slate-600" :title="tool.description">
      {{ tool.description }}
    </p>

    <div v-if="tool.inputs.length > 0" class="mb-3 flex flex-wrap gap-1.5">
      <span
        v-for="input in tool.inputs"
        :key="input.name"
        class="inline-flex items-baseline gap-1 rounded bg-slate-200/60 px-1.5 py-0.5 text-xs"
        :title="input.description"
      >
        <code class="font-mono text-slate-700">{{ input.name }}</code>
        <span class="text-slate-400">{{ input.type }}</span>
        <span v-if="!input.required" class="text-slate-400">?</span>
      </span>
    </div>

    <!-- mt-auto pins the footer to the bottom so cards in a row align. -->
    <div
      class="mt-auto flex items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs"
    >
      <span class="text-slate-500">{{ lastUsedLabel }}</span>
      <span v-if="usage && usage.total > 0" class="font-medium text-slate-700">
        {{ usage.total }} {{ usage.total === 1 ? 'call' : 'calls' }}
        <span v-if="usage.errors > 0" class="text-danger-500 ml-1">
          ({{ usage.errors }} failed)
        </span>
      </span>
    </div>
  </div>
</template>
