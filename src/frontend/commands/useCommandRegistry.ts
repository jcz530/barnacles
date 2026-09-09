import { computed, type Ref } from 'vue';
import { useDark, useLocalStorage } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { useQueries } from '@/composables/useQueries';
import { useProjectActions } from '@/composables/useProjectActions';
import { useApi } from '@/composables/useApi';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { getAllUtilities } from '@/utilities';
import { API_ROUTES } from '../../shared/constants';
import type { ApiResponse } from '../../shared/types/api';
import { appCommands } from './providers/app';
import { navigationCommands } from './providers/navigation';
import { portCommands } from './providers/ports';
import { processCommands } from './providers/processes';
import { projectCommands } from './providers/projects';
import { utilityCommands } from './providers/utilities';
import type { Command } from './types';

/**
 * Builds the full command list for a palette.
 *
 * `isOpen` gates both the polling queries and the array construction: a closed
 * palette must not keep the 5s ports poll alive in every window, and rebuilding
 * hundreds of command objects on every projects change is wasted work when
 * nothing is showing.
 */
export const useCommandRegistry = (isOpen: Ref<boolean>) => {
  const { apiCall } = useApi();
  const {
    useProjectsQuery,
    usePortsQuery,
    useProcessStatusQuery,
    useOpenProjectMutation,
    useOpenTerminalMutation,
    useKillPortMutation,
    useStartProjectProcessesMutation,
    useStopProjectProcessesMutation,
  } = useQueries();

  const { openInFinder, copyPath } = useProjectActions();

  // Fixed for the lifetime of the renderer: utilities are registered when the
  // registry module is evaluated, so this cannot change and has no business
  // being rebuilt every time a project does.
  const utilities = getAllUtilities();
  const { startScan } = useProjectScanWebSocket();

  const { data: projects } = useProjectsQuery({ enabled: isOpen });
  const { data: ports } = usePortsQuery({ enabled: isOpen });
  const { data: processStatuses } = useProcessStatusQuery(undefined, { enabled: isOpen });

  const openProject = useOpenProjectMutation();
  const openTerminal = useOpenTerminalMutation();
  const killPort = useKillPortMutation();
  const startProcesses = useStartProjectProcessesMutation();
  const stopProcesses = useStopProjectProcessesMutation();

  const isDark = useDark({
    selector: 'html',
    attribute: 'class',
    valueDark: 'dark',
    valueLight: 'light',
  });
  const themeMode = useLocalStorage<'light' | 'dark' | 'auto'>('vueuse-color-scheme', 'auto');

  const commands = computed<Command[]>(() => {
    if (!isOpen.value) return [];

    const projectList = projects.value ?? [];
    const statusList = processStatuses.value ?? [];

    return [
      ...projectCommands(projectList, {
        openInIde: async projectId => {
          await openProject.mutateAsync({ projectId });
        },
        openTerminal: async projectId => {
          await openTerminal.mutateAsync({ projectId });
        },
        revealInFinder: openInFinder,
        copyPath,
      }),
      ...processCommands(projectList, statusList, {
        startProcesses: async projectId => {
          await startProcesses.mutateAsync(projectId);
        },
        stopProcesses: async projectId => {
          await stopProcesses.mutateAsync(projectId);
        },
      }),
      ...portCommands(ports.value ?? [], {
        killPort: async pid => {
          await killPort.mutateAsync(pid);
        },
        copyText: async text => {
          await window.electron.clipboard.writeText(text);
          toast.success(`Copied ${text}`);
        },
        openExternal: url => window.electron.shell.openExternal(url),
      }),
      ...navigationCommands(),
      ...utilityCommands(utilities),
      ...appCommands({
        addProject: async () => {
          const selection = await window.electron.files.selectFolder();
          if (!selection?.success || !selection.data) return;
          const response = await apiCall<ApiResponse<{ name: string }>>(
            'POST',
            API_ROUTES.PROJECTS_ADD_BY_PATH,
            { path: selection.data }
          );
          if (response?.data) {
            toast.success(`Added ${response.data.name}`);
          }
        },
        rescanAll: () => startScan(),
        toggleTheme: () => {
          themeMode.value = isDark.value ? 'light' : 'dark';
        },
        isDark: () => isDark.value,
        newWindow: async () => {
          await window.electron.createNewWindow();
        },
      }),
    ];
  });

  return { commands };
};
