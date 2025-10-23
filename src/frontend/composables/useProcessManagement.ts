import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';
import type { UseMutationReturnType } from '@tanstack/vue-query';

interface Process {
  processId: string;
  status: 'running' | 'stopped' | 'failed';
  title?: string;
  name?: string;
  command?: string;
  projectId?: string;
  cwd?: string;
}

interface UseProcessManagementOptions {
  processes: Ref<Process[] | undefined> | ComputedRef<Process[] | undefined>;
  selectedProcess: Ref<string | null>;
  killProcessMutation: UseMutationReturnType<void, Error, string, unknown>;
}

export function useProcessManagement({
  processes,
  selectedProcess,
  killProcessMutation,
}: UseProcessManagementOptions) {
  const runningProcesses = computed(() => {
    return processes.value?.filter(p => p.status === 'running') || [];
  });

  const stoppedProcesses = computed(() => {
    return processes.value?.filter(p => p.status === 'stopped' || p.status === 'failed') || [];
  });

  const handleKillProcess = async (processId: string) => {
    try {
      await killProcessMutation.mutateAsync(processId);

      // If we killed the selected process, select another one
      if (selectedProcess.value === processId) {
        const remaining = runningProcesses.value.filter(p => p.processId !== processId);
        selectedProcess.value = remaining.length > 0 ? remaining[0].processId : null;
      }
    } catch (error) {
      console.error('Failed to kill process:', error);
    }
  };

  const handleDeleteProcess = async (processId: string) => {
    try {
      await killProcessMutation.mutateAsync(processId);

      if (selectedProcess.value === processId) {
        selectedProcess.value = null;
      }
    } catch (error) {
      console.error('Failed to delete process:', error);
    }
  };

  const handleClearAllStopped = async () => {
    try {
      const promises = stoppedProcesses.value.map(p =>
        killProcessMutation.mutateAsync(p.processId)
      );
      await Promise.all(promises);

      if (
        selectedProcess.value &&
        stoppedProcesses.value.some(p => p.processId === selectedProcess.value)
      ) {
        selectedProcess.value = null;
      }
    } catch (error) {
      console.error('Failed to clear stopped processes:', error);
    }
  };

  return {
    runningProcesses,
    stoppedProcesses,
    handleKillProcess,
    handleDeleteProcess,
    handleClearAllStopped,
  };
}
