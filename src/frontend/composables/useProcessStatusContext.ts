import { type InjectionKey, inject, provide, type Ref } from 'vue';

interface ProcessStatusContext {
  processStatuses: Ref<any[] | undefined>;
  getProjectStatus: (projectId: string) => any | null;
}

const ProcessStatusContextKey: InjectionKey<ProcessStatusContext> = Symbol('ProcessStatusContext');

export function provideProcessStatusContext(processStatuses: Ref<any[] | undefined>) {
  const getProjectStatus = (projectId: string): any | null => {
    if (!processStatuses.value || !Array.isArray(processStatuses.value)) {
      return null;
    }

    const projectStatus = processStatuses.value.find((ps: any) => ps.projectId === projectId);
    return projectStatus || null;
  };

  const context: ProcessStatusContext = {
    processStatuses,
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
