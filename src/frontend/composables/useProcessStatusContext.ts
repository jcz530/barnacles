import { inject, type InjectionKey, isRef, provide, type Ref, toRef } from 'vue';
import type { ProjectProcessStatus } from '../../shared/types/process';

interface ProcessStatusContext {
  processStatuses: Ref<ProjectProcessStatus[] | undefined>;
  getProjectStatus: (projectId: string) => ProjectProcessStatus | null;
}

const ProcessStatusContextKey: InjectionKey<ProcessStatusContext> = Symbol('ProcessStatusContext');

export function provideProcessStatusContext(
  processStatuses: Ref<ProjectProcessStatus[] | undefined> | ProjectProcessStatus[] | undefined
) {
  // Ensure we have a Ref
  const statusesRef = isRef(processStatuses) ? processStatuses : toRef(() => processStatuses);

  const getProjectStatus = (projectId: string): ProjectProcessStatus | null => {
    if (!statusesRef.value || !Array.isArray(statusesRef.value)) {
      return null;
    }

    const projectStatus = statusesRef.value.find(ps => ps.projectId === projectId);
    return projectStatus || null;
  };

  const context: ProcessStatusContext = {
    processStatuses: statusesRef,
    getProjectStatus,
  };

  provide(ProcessStatusContextKey, context);

  return context;
}

export function useProcessStatusContext() {
  const context = inject(ProcessStatusContextKey);

  if (!context) {
    throw new Error('useProcessStatusContext must be used within a ProcessStatusContext provider');
  }

  return context;
}
