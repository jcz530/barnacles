import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import type { ProcessStatus } from '../../shared/types/process';
import { useProcessStatusContext } from './useProcessStatusContext';

/**
 * Get running processes for a project from the process status context
 */
export function useRunningProcesses(
  projectId: MaybeRefOrGetter<string>
): ComputedRef<ProcessStatus[]> {
  const { getProjectStatus } = useProcessStatusContext();

  return computed(() => {
    const id = toValue(projectId);
    const projectStatus = getProjectStatus(id);

    if (!projectStatus || !('processes' in projectStatus)) return [];

    const processes = (projectStatus as { processes: ProcessStatus[] }).processes;
    return processes.filter(p => p.status === 'running');
  });
}
