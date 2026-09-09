import { computed, type Ref } from 'vue';
import { useDark, useLocalStorage } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { useQueries } from '@/composables/useQueries';
import { useProjectActions } from '@/composables/useProjectActions';
import { useApi } from '@/composables/useApi';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { handlePermissionError } from '@/utils/error-handlers';
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
    useDetectedIDEsQuery,
    useDetectedTerminalsQuery,
    useSettingsQuery,
    useUpdatePreferredIDEMutation,
    useUpdatePreferredTerminalMutation,
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

  // Neither detection query takes an enabled option, so unlike the polling
  // queries above they can't be gated on isOpen. They are one-shot lookups with
  // no refetch interval, so an idle palette costs nothing to keep them warm.
  const { data: ides } = useDetectedIDEsQuery();
  const { data: terminals } = useDetectedTerminalsQuery();
  const { data: settings } = useSettingsQuery({ enabled: isOpen });

  const openProject = useOpenProjectMutation();
  const openTerminal = useOpenTerminalMutation();
  const killPort = useKillPortMutation();
  const startProcesses = useStartProjectProcessesMutation();
  const stopProcesses = useStopProjectProcessesMutation();
  const updatePreferredIde = useUpdatePreferredIDEMutation();
  const updatePreferredTerminal = useUpdatePreferredTerminalMutation();

  const installedIdes = computed(() => (ides.value ?? []).filter(ide => ide.installed));
  const installedTerminals = computed(() =>
    (terminals.value ?? []).filter(terminal => terminal.installed)
  );

  const settingValue = (key: string): string | null =>
    settings.value?.find(setting => setting.key === key)?.value || null;

  /**
   * Launching an editor or terminal can fail for reasons worth saying out loud
   * -- most often macOS automation permissions. The palette used to swallow
   * these, so a press of Enter simply did nothing.
   *
   * Toasts rather than alert(): the floating palette is a frameless panel, and
   * a modal dialog over it has nowhere to go.
   */
  const reportLaunchFailure = (error: unknown, appType: 'terminal' | 'IDE') => {
    const permissionMessage = handlePermissionError(error as never, appType);
    toast.error(permissionMessage ?? `Could not open ${appType}`, {
      description: permissionMessage ? undefined : 'Make sure it is installed and try again.',
    });
  };

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
        ides: installedIdes.value,
        terminals: installedTerminals.value,
        defaultIdeId: settingValue('defaultIde'),
        defaultTerminalId: settingValue('defaultTerminal'),
        openInIde: async (projectId, ideId) => {
          try {
            await openProject.mutateAsync({ projectId, ideId });
          } catch (error) {
            reportLaunchFailure(error, 'IDE');
          }
        },
        openTerminal: async (projectId, terminalId) => {
          try {
            await openTerminal.mutateAsync({ projectId, terminalId });
          } catch (error) {
            reportLaunchFailure(error, 'terminal');
          }
        },
        setPreferredIde: async (projectId, ideId) => {
          await updatePreferredIde.mutateAsync({ projectId, ideId });
          toast.success('Default IDE updated');
        },
        setPreferredTerminal: async (projectId, terminalId) => {
          await updatePreferredTerminal.mutateAsync({ projectId, terminalId });
          toast.success('Default terminal updated');
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
