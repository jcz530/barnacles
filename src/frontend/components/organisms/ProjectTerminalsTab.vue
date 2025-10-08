<script setup lang="ts">
import { Play, Plus, Terminal as TerminalIcon } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useQueries } from '../../composables/useQueries';
import TerminalCard from '../molecules/TerminalCard.vue';
import { Button } from '../ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import CardContent from '../ui/card/CardContent.vue';
import { Skeleton } from '../ui/skeleton';
import ProcessOutput from './ProcessOutput.vue';
import Terminal from './Terminal.vue';

const props = defineProps<{
  projectId: string;
  projectPath: string;
  packageJsonScripts?: Record<string, string>;
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

const runScript = (scriptName: string) => {
  handleCreateTerminal(`npm run ${scriptName}`, `npm run ${scriptName}`);
};

// Auto-select on load
autoSelectTerminal();
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Package.json Scripts Section -->
    <Card v-if="packageJsonScripts && Object.keys(packageJsonScripts).length > 0">
      <CardHeader>
        <CardTitle>Package Scripts</CardTitle>
        <CardDescription>Run scripts from package.json</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            v-for="(command, name) in packageJsonScripts"
            :key="name"
            variant="outline"
            class="justify-start"
            @click="() => runScript(name as string)"
          >
            <Play class="mr-2 h-4 w-4" />
            <div class="text-left">
              <div class="font-semibold">{{ name }}</div>
              <div class="w-4/5 truncate text-xs text-slate-500">
                {{ command }}
              </div>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Terminals Section -->
    <div class="flex h-[600px] overflow-hidden rounded-lg border">
      <!-- Sidebar with terminal list -->
      <div class="w-72 overflow-y-auto border-r bg-slate-50 p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800">Terminals</h3>
          <Button
            size="sm"
            variant="outline"
            @click="() => handleCreateTerminal()"
            :disabled="createTerminalMutation.isPending"
          >
            <Plus class="h-4 w-4" />
          </Button>
        </div>

        <div v-if="isLoading" class="space-y-2">
          <Skeleton v-for="i in 2" :key="i" class="h-20 w-full" />
        </div>

        <div v-else-if="allItems.length === 0" class="py-8 text-center">
          <TerminalIcon class="mx-auto h-10 w-10 text-slate-400" />
          <p class="mt-2 text-sm text-slate-600">No active terminals or processes</p>
          <Button @click="() => handleCreateTerminal()" variant="outline" size="sm" class="mt-4">
            <Plus class="mr-2 h-4 w-4" />
            Create Terminal
          </Button>
        </div>

        <div v-else class="space-y-2">
          <!-- Processes -->
          <div
            v-for="item in allItems.filter(i => i.type === 'process')"
            :key="item.id"
            :class="[
              'cursor-pointer rounded-lg border p-3 transition-all',
              selectedTerminal === item.id
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300',
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
            :is-killing="!!killTerminalMutation.isPending"
            @select="() => (selectedTerminal = `terminal-${terminal.id}`)"
          />
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
  </div>
</template>
