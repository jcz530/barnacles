<script setup lang="ts">
import { ChevronDown, ChevronRight, Play, Terminal as TerminalIcon, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useQueries } from '../../composables/useQueries';
import TerminalCard from '../molecules/TerminalCard.vue';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import ProcessOutput from './ProcessOutput.vue';
import Terminal from './Terminal.vue';

const props = defineProps<{
  projectId: string;
  projectPath: string;
  packageJsonScripts?: Record<string, string>;
  composerJsonScripts?: Record<string, string>;
  processStatuses?: any;
}>();

const {
  useTerminalInstancesQuery,
  useCreateTerminalMutation,
  useKillTerminalMutation,
  useStopProcessMutation,
  useProcessOutputQuery,
} = useQueries();

const { data: terminals, isLoading } = useTerminalInstancesQuery(computed(() => props.projectId));
const createTerminalMutation = useCreateTerminalMutation();
const killTerminalMutation = useKillTerminalMutation();
const stopProcessMutation = useStopProcessMutation();

// Get process status from props instead of individual query
const processStatus = computed(() => {
  if (!props.processStatuses || !Array.isArray(props.processStatuses)) return null;

  const projectStatus = props.processStatuses.find((ps: any) => ps.projectId === props.projectId);

  return projectStatus || null;
});

const selectedTerminal = ref<string | null>(null);

// Collapsible sections state
const scriptsExpanded = ref(true);
const npmScriptsExpanded = ref(true);
const composerScriptsExpanded = ref(true);

// Determine selected item type and IDs
const selectedItemType = computed(() => {
  if (!selectedTerminal.value) return null;
  return selectedTerminal.value.startsWith('process-') ? 'process' : 'terminal';
});

const selectedProcessId = computed(() => {
  if (selectedItemType.value !== 'process') return null;
  return selectedTerminal.value?.replace('process-', '') || null;
});

const selectedTerminalId = computed(() => {
  if (selectedItemType.value !== 'terminal') return null;
  return selectedTerminal.value?.replace('terminal-', '') || null;
});

// Fetch process output for selected process
const { data: processOutput } = useProcessOutputQuery(
  props.projectId,
  computed(() => selectedProcessId.value || ''),
  {
    enabled: computed(() => selectedItemType.value === 'process' && !!selectedProcessId.value),
    refetchInterval: 1000,
  }
);

const projectTerminals = computed(() => {
  return terminals.value?.filter(t => t.projectId === props.projectId) || [];
});

const activeTerminals = computed(() => {
  return projectTerminals.value.filter(t => t.status === 'running');
});

const runningProcesses = computed(() => {
  const status = processStatus.value;
  if (!status || !('processes' in status)) return [];
  const processes = (status as { processes: any[] }).processes;
  return processes.filter(p => p.status === 'running');
});

// Combine terminals and processes for display
const allItems = computed(() => {
  const items: Array<{
    id: string;
    type: 'terminal' | 'process';
    title: string;
    status: string;
    data: any;
  }> = [];

  // Add running processes first
  runningProcesses.value.forEach(process => {
    items.push({
      id: `process-${process.processId}`,
      type: 'process',
      title: `Process: ${process.processId}`,
      status: process.status,
      data: process,
    });
  });

  // Then add terminals
  activeTerminals.value.forEach(terminal => {
    items.push({
      id: `terminal-${terminal.id}`,
      type: 'terminal',
      title: terminal.title || 'Terminal',
      status: terminal.status,
      data: terminal,
    });
  });

  return items;
});

// Auto-select first item when available
const autoSelectTerminal = () => {
  if (allItems.value.length > 0 && !selectedTerminal.value) {
    selectedTerminal.value = allItems.value[0].id;
  }
};

const handleCreateTerminal = async (command?: string, title?: string) => {
  try {
    const newTerminal = await createTerminalMutation.mutateAsync({
      projectId: props.projectId,
      command,
      title: title || 'New Terminal',
    });

    if (newTerminal) {
      selectedTerminal.value = `terminal-${newTerminal.id}`;
    }
  } catch (error) {
    console.error('Failed to create terminal:', error);
  }
};

const handleKillTerminal = async (terminalId: string) => {
  try {
    await killTerminalMutation.mutateAsync(terminalId);

    if (selectedTerminal.value === `terminal-${terminalId}`) {
      const remaining = activeTerminals.value.filter(t => t.id !== terminalId);
      selectedTerminal.value = remaining.length > 0 ? `terminal-${remaining[0].id}` : null;
    }
  } catch (error) {
    console.error('Failed to kill terminal:', error);
  }
};

const handleStopProcess = async (processId: string) => {
  try {
    await stopProcessMutation.mutateAsync({
      projectId: props.projectId,
      processId,
    });

    if (selectedTerminal.value === `process-${processId}`) {
      selectedTerminal.value = null;
    }
  } catch (error) {
    console.error('Failed to stop process:', error);
  }
};

const runScript = (scriptName: string, type: 'npm' | 'composer' = 'npm') => {
  const command = type === 'npm' ? `npm run ${scriptName}` : `composer run-script ${scriptName}`;
  handleCreateTerminal(command, command);
};

// Auto-select on load
autoSelectTerminal();
</script>

<template>
  <div class="flex h-[700px] overflow-hidden rounded-lg border">
    <!-- Unified Sidebar -->
    <div class="w-80 overflow-y-auto border-r bg-slate-50">
      <!-- Scripts Section -->
      <div
        v-if="
          (packageJsonScripts && Object.keys(packageJsonScripts).length > 0) ||
          (composerJsonScripts && Object.keys(composerJsonScripts).length > 0)
        "
        class="border-b border-slate-200"
      >
        <div
          class="hover:bg-slate-150 flex cursor-pointer items-center justify-between bg-slate-100 px-4 py-3"
          @click="scriptsExpanded = !scriptsExpanded"
        >
          <h3 class="font-semibold text-slate-800">Scripts</h3>
          <ChevronDown v-if="scriptsExpanded" class="h-4 w-4 text-slate-600" />
          <ChevronRight v-else class="h-4 w-4 text-slate-600" />
        </div>

        <div v-if="scriptsExpanded" class="p-2">
          <!-- NPM Scripts -->
          <div v-if="packageJsonScripts && Object.keys(packageJsonScripts).length > 0" class="mb-2">
            <div
              class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-slate-100"
              @click="npmScriptsExpanded = !npmScriptsExpanded"
            >
              <span class="text-sm font-medium text-slate-700">NPM Scripts</span>
              <ChevronDown v-if="npmScriptsExpanded" class="h-3 w-3 text-slate-500" />
              <ChevronRight v-else class="h-3 w-3 text-slate-500" />
            </div>

            <div v-if="npmScriptsExpanded" class="mt-1 space-y-1">
              <button
                v-for="(command, name) in packageJsonScripts"
                :key="name"
                class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
                @click="() => runScript(String(name), 'npm')"
              >
                <Play class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-slate-800">{{ name }}</div>
                  <div class="truncate text-xs text-slate-500">{{ command }}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- Composer Scripts -->
          <div v-if="composerJsonScripts && Object.keys(composerJsonScripts).length > 0">
            <div
              class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-slate-100"
              @click="composerScriptsExpanded = !composerScriptsExpanded"
            >
              <span class="text-sm font-medium text-slate-700">Composer Scripts</span>
              <ChevronDown v-if="composerScriptsExpanded" class="h-3 w-3 text-slate-500" />
              <ChevronRight v-else class="h-3 w-3 text-slate-500" />
            </div>

            <div v-if="composerScriptsExpanded" class="mt-1 space-y-1">
              <button
                v-for="(command, name) in composerJsonScripts"
                :key="name"
                class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
                @click="() => runScript(String(name), 'composer')"
              >
                <Play class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-purple-600" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-slate-800">{{ name }}</div>
                  <div class="truncate text-xs text-slate-500">{{ command }}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Processes Section -->
      <div class="p-4">
        <div class="mb-4">
          <h3 class="font-semibold text-slate-800">Processes</h3>
        </div>

        <div v-if="isLoading" class="space-y-2">
          <Skeleton v-for="i in 2" :key="i" class="h-20 w-full" />
        </div>

        <div v-else-if="allItems.length === 0" class="py-8 text-center">
          <TerminalIcon class="mx-auto h-10 w-10 text-slate-400" />
          <p class="mt-2 text-sm text-slate-600">No active processes</p>
          <p class="mt-1 text-xs text-slate-500">Run a script to start a process</p>
        </div>

        <div v-else class="space-y-2">
          <!-- Processes -->
          <div
            v-for="item in allItems.filter((i: any) => i.type === 'process')"
            :key="item.id"
            :class="[
              'cursor-pointer rounded-lg border p-3 transition-all',
              selectedTerminal === item.id
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ]"
            @click="selectedTerminal = item.id"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <Play class="h-4 w-4 text-emerald-500" />
                  <div class="flex flex-col">
                    <p class="truncate text-sm font-medium">{{ item.data.name }}</p>
                    <p class="truncate text-xs">{{ item.title }}</p>
                  </div>
                </div>
                <p class="mt-1 text-xs text-slate-500">Process</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 w-6 flex-shrink-0 p-0"
                @click.stop="() => handleStopProcess(item.data.processId)"
              >
                <X class="h-3 w-3" />
              </Button>
            </div>
          </div>

          <!-- Terminals -->
          <TerminalCard
            v-for="terminal in activeTerminals"
            :key="terminal.id"
            :terminal="terminal"
            :is-selected="selectedTerminal === `terminal-${terminal.id}`"
            :show-cwd="false"
            :on-kill="handleKillTerminal"
            @select="() => (selectedTerminal = `terminal-${terminal.id}`)"
          />
        </div>
      </div>
    </div>

    <!-- Terminal/Process display area -->
    <div class="flex-1 bg-[#1e1e1e] p-4">
      <!-- Show terminal -->
      <div v-if="selectedItemType === 'terminal' && selectedTerminalId" class="h-full">
        <Terminal :terminal-id="selectedTerminalId" />
      </div>

      <!-- Show process output -->
      <div v-else-if="selectedItemType === 'process' && processOutput" class="h-full">
        <ProcessOutput :output="processOutput.output" />
      </div>

      <!-- Empty state -->
      <div v-else class="flex h-full items-center justify-center text-slate-400">
        <div class="text-center">
          <TerminalIcon class="mx-auto mb-4 h-16 w-16" />
          <p>Select a terminal or process</p>
        </div>
      </div>
    </div>
  </div>
</template>
