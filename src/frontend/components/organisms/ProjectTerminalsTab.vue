<script setup lang="ts">
import { ChevronDown, ChevronRight, Play, Terminal as TerminalIcon, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useQueries } from '../../composables/useQueries';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import ProcessOutput from './ProcessOutput.vue';

const props = defineProps<{
  projectId: string;
  projectPath: string;
  packageJsonScripts?: Record<string, string>;
  composerJsonScripts?: Record<string, string>;
}>();

const {
  useProcessesQuery,
  useCreateProcessMutation,
  useKillProcessMutation,
  useProcessOutputByIdQuery,
} = useQueries();

const { data: processes, isLoading } = useProcessesQuery(computed(() => props.projectId));
const createProcessMutation = useCreateProcessMutation();
const killProcessMutation = useKillProcessMutation();

const selectedProcess = ref<string | null>(null);

// Collapsible sections state
const scriptsExpanded = ref(true);
const npmScriptsExpanded = ref(true);
const composerScriptsExpanded = ref(true);

// Fetch process output for selected process
const { data: processOutput } = useProcessOutputByIdQuery(
  computed(() => selectedProcess.value || ''),
  {
    enabled: computed(() => !!selectedProcess.value),
    refetchInterval: 1000,
  }
);

const runningProcesses = computed(() => {
  return processes.value?.filter(p => p.status === 'running') || [];
});

// All items are just processes now
const allItems = computed(() => {
  return runningProcesses.value.map(process => ({
    id: process.processId,
    title: process.title || process.name || process.command || 'Process',
    status: process.status,
    data: process,
  }));
});

// Auto-select first item when available
const autoSelectProcess = () => {
  if (allItems.value.length > 0 && !selectedProcess.value) {
    selectedProcess.value = allItems.value[0].id;
  }
};

const handleCreateProcess = async (command?: string, title?: string) => {
  try {
    const newProcess = await createProcessMutation.mutateAsync({
      projectId: props.projectId,
      cwd: props.projectPath,
      command,
      title: title || command || 'Process',
    });

    if (newProcess) {
      selectedProcess.value = newProcess.processId;
    }
  } catch (error) {
    console.error('Failed to create process:', error);
  }
};

const handleKillProcess = async (processId: string) => {
  try {
    await killProcessMutation.mutateAsync(processId);

    if (selectedProcess.value === processId) {
      const remaining = runningProcesses.value.filter(p => p.processId !== processId);
      selectedProcess.value = remaining.length > 0 ? remaining[0].processId : null;
    }
  } catch (error) {
    console.error('Failed to kill process:', error);
  }
};

const runScript = (scriptName: string, type: 'npm' | 'composer' = 'npm') => {
  const command = type === 'npm' ? `npm run ${scriptName}` : `composer run-script ${scriptName}`;
  handleCreateProcess(command, command);
};

// Auto-select on load
autoSelectProcess();
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
            v-for="item in allItems"
            :key="item.id"
            :class="[
              'cursor-pointer rounded-lg border p-3 transition-all',
              selectedProcess === item.id
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ]"
            @click="selectedProcess = item.id"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <Play class="h-4 w-4 text-emerald-500" />
                  <div class="flex flex-col">
                    <p class="truncate text-sm font-medium">{{ item.title }}</p>
                    <p v-if="item.data.cwd" class="truncate text-xs text-slate-500">
                      {{ item.data.cwd }}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 w-6 flex-shrink-0 p-0"
                @click.stop="() => handleKillProcess(item.id)"
              >
                <X class="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Process display area -->
    <div class="flex-1 bg-[#1e1e1e] p-4">
      <!-- Show process output -->
      <div v-if="selectedProcess && processOutput" class="h-full">
        <ProcessOutput :output="processOutput.output" />
      </div>

      <!-- Empty state -->
      <div v-else class="flex h-full items-center justify-center text-slate-400">
        <div class="text-center">
          <TerminalIcon class="mx-auto mb-4 h-16 w-16" />
          <p>Select a process to view output</p>
        </div>
      </div>
    </div>
  </div>
</template>
