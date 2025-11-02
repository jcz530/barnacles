<script setup lang="ts">
import { ExternalLink, X } from 'lucide-vue-next';
import type { TerminalInstance } from '../../../shared/types/api';
import { Button } from '../ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

const props = defineProps<{
  terminal: TerminalInstance;
  isSelected?: boolean;
  projectName?: string | null;
  showCwd?: boolean;
  onKill?: (id: string) => void;
  onProjectClick?: (id: string) => void;
  isKilling?: boolean;
}>();

const emit = defineEmits<{
  select: [terminal: TerminalInstance];
}>();

const handleSelect = () => {
  emit('select', props.terminal);
};

const handleKill = (e: Event) => {
  e.stopPropagation();
  if (props.onKill) {
    props.onKill(props.terminal.id);
  }
};

const handleProjectClick = (e: Event) => {
  e.stopPropagation();
  if (props.onProjectClick && props.terminal.projectId) {
    props.onProjectClick(props.terminal.projectId);
  }
};
</script>

<template>
  <Card
    class="cursor-pointer transition-all hover:shadow-md"
    :class="{
      'ring-primary-500 ring-2': isSelected,
      'opacity-60': terminal.status === 'exited',
    }"
    @click="handleSelect"
  >
    <CardHeader class="px-3 py-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <CardTitle class="truncate text-sm">{{ terminal.title }}</CardTitle>
          <CardDescription class="mt-1 space-y-0.5">
            <!-- Show cwd if enabled -->
            <div
              v-if="showCwd"
              class="mr-4 w-4/5 truncate overflow-hidden pr-4 text-xs"
              dir="rtl"
              style="text-align: left"
            >
              {{ terminal.cwd }}
            </div>

            <!-- Project link if available -->
            <div
              v-if="terminal.projectId && projectName && onProjectClick"
              class="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-xs"
              @click="handleProjectClick"
            >
              <span class="truncate">{{ projectName }}</span>
              <ExternalLink class="h-3 w-3 flex-shrink-0" />
            </div>

            <!-- Exit code for exited terminals -->
            <div v-if="terminal.status === 'exited'" class="text-xs">
              Exit code: {{ terminal.exitCode }}
            </div>
          </CardDescription>
        </div>
        <Button
          v-if="onKill"
          variant="ghost"
          size="sm"
          class="h-6 w-6 flex-shrink-0 p-0"
          @click="handleKill"
          :disabled="isKilling"
        >
          <X class="h-3 w-3" />
        </Button>
      </div>
      <div class="mt-1.5 flex items-center gap-2">
        <div
          class="h-2 w-2 flex-shrink-0 rounded-full"
          :class="terminal.status === 'running' ? 'bg-emerald-500' : 'bg-slate-500'"
        ></div>
        <span class="text-xs text-slate-500">
          {{ terminal.status === 'running' ? 'Running' : 'Exited' }}
        </span>
      </div>
    </CardHeader>
  </Card>
</template>
