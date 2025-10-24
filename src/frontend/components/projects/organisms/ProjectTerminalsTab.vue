<script setup lang="ts">
import { ChevronDown, ChevronRight, Play, Terminal as TerminalIcon } from 'lucide-vue-next';
import type { ComputedRef, Ref } from 'vue';
import { computed, inject, ref } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { useProcessManagement } from '../../../composables/useProcessManagement';
import { Skeleton } from '../../ui/skeleton';
import ProcessOutput from '../../process/organisms/ProcessOutput.vue';
import ProcessCard from '../../process/molecules/ProcessCard.vue';

const projectId = inject<ComputedRef<string>>('projectId');
const projectPath = inject<ComputedRef<string | undefined>>('projectPath');
const packageJsonScripts = inject<Ref<Record<string, string> | undefined>>('packageScripts');
const composerJsonScripts = inject<Ref<Record<string, string> | undefined>>('composerScripts');

const {
  useProcessesQuery,
  useCreateProcessMutation,
  useKillProcessMutation,
  useProcessOutputByIdQuery,
} = useQueries();

const { data: processes, isLoading } = useProcessesQuery(projectId!);
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

const {
  runningProcesses,
  stoppedProcesses,
  handleKillProcess,
  handleDeleteProcess,
  handleClearAllStopped,
} = useProcessManagement({
  processes,
  selectedProcess,
  killProcessMutation,
});

// Convert processes to the format needed for display - show all processes
const processItems = computed(() => {
  return processes.value || [];
});

// Auto-select first item when available
const autoSelectProcess = () => {
  if (processItems.value.length > 0 && !selectedProcess.value) {
    selectedProcess.value = processItems.value[0].processId;
  }
};

const handleCreateProcess = async (command?: string, title?: string) => {
  try {
    const newProcess = await createProcessMutation.mutateAsync({
      projectId: projectId!.value,
      cwd: projectPath!.value,
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

        <div v-else-if="processItems.length === 0" class="py-8 text-center">
          <TerminalIcon class="mx-auto h-10 w-10 text-slate-400" />
          <p class="mt-2 text-sm text-slate-600">No processes</p>
          <p class="mt-1 text-xs text-slate-500">Run a script to start a process</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Running Processes -->
          <div v-if="runningProcesses.length > 0">
            <h4 class="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
              Running ({{ runningProcesses.length }})
            </h4>
            <div class="space-y-2">
              <ProcessCard
                v-for="process in runningProcesses"
                :key="process.processId"
                :process="process"
                :is-selected="selectedProcess === process.processId"
                :show-project-link="false"
                @select="selectedProcess = process.processId"
                @kill="handleKillProcess"
              />
            </div>
          </div>

          <!-- Stopped Processes -->
          <div v-if="stoppedProcesses.length > 0">
            <div class="mb-2 flex items-center justify-between">
              <h4 class="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Stopped ({{ stoppedProcesses.length }})
              </h4>
              <button
                class="text-xs text-slate-400 transition-colors hover:text-red-400"
                @click="handleClearAllStopped"
              >
                Clear All
              </button>
            </div>
            <div class="space-y-2">
              <ProcessCard
                v-for="process in stoppedProcesses"
                :key="process.processId"
                :process="process"
                :is-selected="selectedProcess === process.processId"
                :show-project-link="false"
                @select="selectedProcess = process.processId"
                @kill="handleKillProcess"
                @delete="handleDeleteProcess"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Process display area -->
    <div class="flex-1 rounded-lg bg-[#1d293d] p-4">
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
