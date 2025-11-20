<script setup lang="ts">
import { Terminal as TerminalIcon } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import ProcessCard from '../components/process/molecules/ProcessCard.vue';
import ProcessOutput from '../components/process/organisms/ProcessOutput.vue';
import { Skeleton } from '../components/ui/skeleton';
import { useBreadcrumbs } from '../composables/useBreadcrumbs';
import { useQueries } from '../composables/useQueries';
import { useProcessManagement } from '../composables/useProcessManagement';

const { setBreadcrumbs } = useBreadcrumbs();
const { useProcessesQuery, useKillProcessMutation, useProcessOutputByIdQuery } = useQueries();

const { data: processes, isLoading } = useProcessesQuery();
const killProcessMutation = useKillProcessMutation();

const selectedProcess = ref<string | null>(null);

// Fetch process output for selected process
const { data: processOutput } = useProcessOutputByIdQuery(
  computed(() => selectedProcess.value || ''),
  {
    enabled: computed(() => !!selectedProcess.value),
    refetchInterval: 1000,
  }
);

const {
  runningProcesses: activeProcesses,
  stoppedProcesses,
  handleKillProcess,
  handleDeleteProcess,
  handleClearAllStopped,
} = useProcessManagement({
  processes,
  selectedProcess,
  killProcessMutation,
});

onMounted(() => {
  setBreadcrumbs([{ label: 'Processes' }]);

  // Auto-select the first process if available
  if (activeProcesses.value.length > 0 && !selectedProcess.value) {
    selectedProcess.value = activeProcesses.value[0].processId;
  }
});

const selectProcess = (process: any) => {
  selectedProcess.value = process.processId;
};
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-800">Processes</h1>
          <p class="mt-1 text-slate-600">View all running processes</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar with process list -->
      <div class="w-80 overflow-y-auto border-r bg-slate-50 p-4">
        <div v-if="isLoading" class="space-y-2">
          <Skeleton v-for="i in 3" :key="i" class="h-20 w-full" />
        </div>

        <div
          v-else-if="activeProcesses.length === 0 && stoppedProcesses.length === 0"
          class="py-8 text-center"
        >
          <TerminalIcon class="mx-auto h-12 w-12 text-slate-400" />
          <p class="mt-2 text-sm text-slate-600">No active processes</p>
          <p class="mt-1 text-xs text-slate-500">Go to a project and run a script</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Active Processes -->
          <div v-if="activeProcesses.length > 0">
            <h3 class="mb-2 text-sm font-semibold text-slate-700">
              Running ({{ activeProcesses.length }})
            </h3>
            <div class="space-y-2">
              <ProcessCard
                v-for="process in activeProcesses"
                :key="process.processId"
                :process="process"
                :is-selected="selectedProcess === process.processId"
                @select="selectProcess"
                @kill="handleKillProcess"
              />
            </div>
          </div>

          <!-- Stopped Processes -->
          <div v-if="stoppedProcesses.length > 0">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-semibold text-slate-700">
                Stopped ({{ stoppedProcesses.length }})
              </h3>
              <button
                class="hover:text-danger-400 text-xs text-slate-400 transition-colors"
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
                @select="selectProcess"
                @kill="handleKillProcess"
                @delete="handleDeleteProcess"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Process display area -->
      <div class="flex-1 rounded-lg bg-[#1d293d] p-4">
        <div v-if="selectedProcess && processOutput" class="h-full">
          <ProcessOutput :output="processOutput.output" />
        </div>
        <div v-else class="flex h-full items-center justify-center text-slate-400">
          <div class="text-center">
            <TerminalIcon class="mx-auto mb-4 h-16 w-16" />
            <p>Select a process to view output</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
