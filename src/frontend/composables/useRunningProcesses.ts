import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import type { ProcessStatus } from '../../shared/types/process';

/**
 * Get running processes for a project from the process statuses array
 */
export function useRunningProcesses(
  projectId: MaybeRefOrGetter<string>,
  allProcessStatuses: MaybeRefOrGetter<unknown>
): ComputedRef<ProcessStatus[]> {
  return computed(() => {
    const statuses = toValue(allProcessStatuses);
    const id = toValue(projectId);

    if (!statuses || !Array.isArray(statuses)) return [];

    const projectStatus = statuses.find((ps: any) => ps.projectId === id);

    if (!projectStatus || !('processes' in projectStatus)) return [];

    const processes = (projectStatus as { processes: ProcessStatus[] }).processes;
    return processes.filter(p => p.status === 'running');
  });
}
