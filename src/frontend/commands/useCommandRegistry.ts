import { computed, ref, type Ref } from 'vue';
import { useDark, useLocalStorage } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { useQueries } from '@/composables/useQueries';
import type { RunnableScript, StartProcess } from '@shared/types/process';
import { useProjectActions } from '@/composables/useProjectActions';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { handlePermissionError } from '@/utils/error-handlers';
import { getAllUtilities } from '@/utilities';
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
  const {
    useProjectsQuery,
    usePortsQuery,
    useProcessStatusQuery,
    useOpenProjectMutation,
    useOpenTerminalMutation,
    useKillPortMutation,
    useStartProjectProcessesMutation,
    useStopProjectProcessesMutation,
    useStartProcessMutation,
    useRestartProcessMutation,
    useStopProcessMutation,
    fetchStartProcesses,
    fetchRunnableScripts,
    useCreateProcessMutation,
    useDetectedIDEsQuery,
    useDetectedTerminalsQuery,
    useSettingsQuery,
    useUpdatePreferredIDEMutation,
    useUpdatePreferredTerminalMutation,
  } = useQueries();

  const { openInFinder } = useProjectActions();

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
  const startProcess = useStartProcessMutation();
  const restartProcess = useRestartProcessMutation();
  const stopProcess = useStopProcessMutation();
  const createProcess = useCreateProcessMutation();
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

  /**
   * Configured processes, per project, for the projects someone has opened.
   *
   * Fetched lazily: they are only ever shown inside a project's own level, and
   * fetching every project's up front would be a request per project on every
   * palette open for a level most opens never reach.
   *
   * Held here rather than on the level because the level stack rebuilds every
   * open level from `actions` whenever this list changes. Keeping the data in
   * the registry means that rebuild reproduces the same rows -- and is in fact
   * what puts the fetched ones on screen.
   */
  const configuredProcesses = ref<Record<string, StartProcess[]>>({});
  const loadingProcesses = ref<Record<string, boolean>>({});

  const loadProcesses = (projectId: string) => {
    if (configuredProcesses.value[projectId] || loadingProcesses.value[projectId]) return;
    loadingProcesses.value = { ...loadingProcesses.value, [projectId]: true };

    void fetchStartProcesses(projectId)
      .then(data => {
        // Replacing the object rather than mutating it: the commands computed
        // below has to see a change, or the open level would never rebuild.
        configuredProcesses.value = { ...configuredProcesses.value, [projectId]: data ?? [] };
      })
      .catch(() => {
        // Leave the group empty rather than stuck on a skeleton. The project's
        // own actions are unaffected.
        configuredProcesses.value = { ...configuredProcesses.value, [projectId]: [] };
      })
      .finally(() => {
        const { [projectId]: _done, ...rest } = loadingProcesses.value;
        loadingProcesses.value = rest;
      });
  };

  /**
   * A project's runnable scripts, fetched on the same trigger as its processes.
   *
   * Separate from the processes cache because they are separate things: these
   * are read from package.json/composer.json on disk and run as ad-hoc
   * processes, where configured processes are DB-backed and tracked by id.
   */
  const scripts = ref<Record<string, RunnableScript[]>>({});
  const loadingScripts = ref<Record<string, boolean>>({});

  const loadScripts = (projectId: string) => {
    if (scripts.value[projectId] || loadingScripts.value[projectId]) return;
    loadingScripts.value = { ...loadingScripts.value, [projectId]: true };

    void fetchRunnableScripts(projectId)
      .then(data => {
        scripts.value = { ...scripts.value, [projectId]: data ?? [] };
      })
      .catch(() => {
        scripts.value = { ...scripts.value, [projectId]: [] };
      })
      .finally(() => {
        const { [projectId]: _done, ...rest } = loadingScripts.value;
        loadingScripts.value = rest;
      });
  };

  /**
   * Forget what was fetched lazily, so reopening does not serve a list from the
   * last time this window was used -- the floating renderer outlives an open.
   */
  const resetLazyState = () => {
    configuredProcesses.value = {};
    loadingProcesses.value = {};
    scripts.value = {};
    loadingScripts.value = {};
  };

  const commands = computed<Command[]>(() => {
    if (!isOpen.value) return [];

    const projectList = projects.value ?? [];
    const statusList = processStatuses.value ?? [];

    const processState = {
      configured: configuredProcesses.value,
      loading: loadingProcesses.value,
    };

    const scriptState = {
      scripts: scripts.value,
      loading: loadingScripts.value,
    };

    const scriptDeps = {
      runScript: async (projectId: string, cwd: string, command: string) => {
        await createProcess.mutateAsync({ projectId, cwd, command, title: command });
      },
    };

    const processDeps = {
      startProcesses: async (projectId: string) => {
        await startProcesses.mutateAsync(projectId);
      },
      stopProcesses: async (projectId: string) => {
        await stopProcesses.mutateAsync(projectId);
      },
      startProcess: async (projectId: string, processId: string) => {
        await startProcess.mutateAsync({ projectId, processId });
      },
      stopProcess: async (projectId: string, processId: string) => {
        await stopProcess.mutateAsync({ projectId, processId });
      },
      restartProcess: async (projectId: string, processId: string) => {
        await restartProcess.mutateAsync({ projectId, processId });
      },
      openExternal: (url: string) => window.electron.shell.openExternal(url),
    };

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
        // The confirmations these used to toast are raised by the provider
        // instead: it knows which tool was chosen, so it can say so by name.
        setPreferredIde: async (projectId, ideId) => {
          await updatePreferredIde.mutateAsync({ projectId, ideId });
        },
        setPreferredTerminal: async (projectId, terminalId) => {
          await updatePreferredTerminal.mutateAsync({ projectId, terminalId });
        },
        revealInFinder: openInFinder,
        // Wrapped rather than passed straight through. The shared copyPath
        // catches its own failure and alert()s, so it resolves either way --
        // and the palette would go on to report a copy that never happened.
        // Copy through the same channel the port actions use, so a failure
        // rejects and the provider can say so. The shared one keeps its
        // behaviour for the projects page, which is not this plan's to change.
        copyPath: async (projectPath: string) => {
          await window.electron.clipboard.writeText(projectPath);
        },
        processStatuses: statusList,
        processState,
        processDeps,
        scriptState,
        scriptDeps,
        loadProcesses,
        loadScripts,
      }),
      ...processCommands(projectList, statusList, processState, processDeps),
      ...portCommands(ports.value ?? [], {
        killPort: async pid => {
          await killPort.mutateAsync(pid);
        },
        copyText: async text => {
          await window.electron.clipboard.writeText(text);
        },
        openExternal: url => window.electron.shell.openExternal(url),
      }),
      ...navigationCommands(),
      ...utilityCommands(utilities),
      ...appCommands({
        rescanAll: () => startScan(),
        toggleTheme: () => {
          themeMode.value = isDark.value ? 'light' : 'dark';
        },
        isDark: () => isDark.value,
        newWindow: async () => {
          await window.electron.createNewWindow();
        },
        globalShortcutEnabled: settingValue('commandPaletteShortcutEnabled') === 'true',
      }),
    ];
  });

  return { commands, resetLazyState };
};
