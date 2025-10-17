<script setup lang="ts">
import { Terminal as TerminalIcon } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ProcessOutput from '../components/organisms/ProcessOutput.vue';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useBreadcrumbs } from '../composables/useBreadcrumbs';
import { useQueries } from '../composables/useQueries';

const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
const { useProcessesQuery, useKillProcessMutation, useProjectsQuery, useProcessOutputByIdQuery } =
  useQueries();

const { data: processes, isLoading } = useProcessesQuery();
const { data: projects } = useProjectsQuery();
const killProcessMutation = useKillProcessMutation();

const selectedProcess = ref<string | null>(null);

// Helper to get project name by ID
const getProjectName = (projectId?: string) => {
  if (!projectId) return null;
  const project = projects.value?.find(p => p.id === projectId);
  return project?.name;
};

const navigateToProject = (projectId: string) => {
  router.push({ name: 'ProjectTerminals', params: { id: projectId } });
};

// Fetch process output for selected process
const { data: processOutput } = useProcessOutputByIdQuery(
  computed(() => selectedProcess.value || ''),
  {
    enabled: computed(() => !!selectedProcess.value),
    refetchInterval: 1000,
  }
);

const activeProcesses = computed(() => {
  return processes.value?.filter(p => p.status === 'running') || [];
});

const stoppedProcesses = computed(() => {
  return processes.value?.filter(p => p.status === 'stopped' || p.status === 'failed') || [];
});

onMounted(() => {
  setBreadcrumbs([{ label: 'Processes' }]);

  // Auto-select the first process if available
  if (activeProcesses.value.length > 0 && !selectedProcess.value) {
    selectedProcess.value = activeProcesses.value[0].processId;
  }
});

const handleKillProcess = async (processId: string) => {
  try {
    await killProcessMutation.mutateAsync(processId);

    // If we killed the selected process, select another one
    if (selectedProcess.value === processId) {
      const remaining = activeProcesses.value.filter(p => p.processId !== processId);
      selectedProcess.value = remaining.length > 0 ? remaining[0].processId : null;
    }
  } catch (error) {
    console.error('Failed to kill process:', error);
  }
};

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
              <div
                v-for="process in activeProcesses"
                :key="process.processId"
                :class="[
                  'cursor-pointer rounded-lg border p-3 transition-all',
                  selectedProcess === process.processId
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ]"
                @click="selectProcess(process)"
              >
                <div class="flex items-start justify-between">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                      {{ process.title || process.name || process.command || 'Process' }}
                    </p>
                    <p
                      v-if="getProjectName(process.projectId)"
                      class="mt-1 truncate text-xs text-slate-500 hover:text-sky-600"
                      @click.stop="navigateToProject(process.projectId)"
                    >
                      {{ getProjectName(process.projectId) }}
                    </p>
                    <p v-if="process.cwd" class="mt-1 truncate text-xs text-slate-400">
                      {{ process.cwd }}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="ml-2 h-6 w-6 flex-shrink-0 p-0"
                    @click.stop="handleKillProcess(process.processId)"
                  >
                    ×
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- Stopped Processes -->
          <div v-if="stoppedProcesses.length > 0">
            <h3 class="mb-2 text-sm font-semibold text-slate-700">
              Stopped ({{ stoppedProcesses.length }})
            </h3>
            <div class="space-y-2">
              <div
                v-for="process in stoppedProcesses"
                :key="process.processId"
                :class="[
                  'cursor-pointer rounded-lg border p-3 opacity-60 transition-all',
                  selectedProcess === process.processId
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ]"
                @click="selectProcess(process)"
              >
                <div class="flex items-start justify-between">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                      {{ process.title || process.name || process.command || 'Process' }}
                    </p>
                    <p
                      v-if="getProjectName(process.projectId)"
                      class="mt-1 truncate text-xs text-slate-500"
                    >
                      {{ getProjectName(process.projectId) }}
                    </p>
                    <p class="mt-1 text-xs text-slate-400">
                      {{ process.status === 'failed' ? 'Failed' : 'Stopped' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Process display area -->
      <div class="flex-1 bg-[#1e1e1e] p-4">
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
