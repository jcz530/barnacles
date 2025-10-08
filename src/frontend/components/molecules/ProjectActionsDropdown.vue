<script setup lang="ts">
import {
  Archive,
  Copy,
  ExternalLink as ExternalLinkIcon,
  FolderOpen,
  MoreVertical,
  PackageX,
  Play,
  RefreshCw,
  Settings,
  Square,
  Star,
  Terminal as TerminalIcon,
  Trash2,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { StartProcess } from '../../../shared/types/process';
import { useProjectActions } from '../../composables/useProjectActions';
import { useQueries } from '../../composables/useQueries';
import ProcessConfigEditor from './ProcessConfigEditor.vue';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface Props {
  projectId: string;
  projectPath: string;
  projectName: string;
  isArchived: boolean;
  isFavorite: boolean;
  gitRemoteUrl?: string | null;
  thirdPartySize?: number | null;
  preferredIdeId?: string | null;
  preferredTerminalId?: string | null;
  processStatuses?: any;
}

const props = defineProps<Props>();

const {
  deleteProject,
  rescanProject,
  archiveProject,
  unarchiveProject,
  toggleFavorite,
  openInFinder,
  copyPath,
  openGitRemote,
  getGitProvider,
  deleteThirdPartyPackages,
  isDeleting,
  isRescanning,
  isArchiving,
  isUnarchiving,
  isTogglingFavorite,
  isDeletingPackages,
} = useProjectActions();

const {
  useUpdatePreferredTerminalMutation,
  useOpenTerminalMutation,
  useUpdatePreferredIDEMutation,
  useOpenProjectMutation,
  useSettingsQuery,
  useDetectedIDEsQuery,
  useDetectedTerminalsQuery,
  useStartProcessesQuery,
  useUpdateStartProcessesMutation,
  useStartProjectProcessesMutation,
  useStopProjectProcessesMutation,
} = useQueries();
const updateTerminalMutation = useUpdatePreferredTerminalMutation();
const openTerminalMutation = useOpenTerminalMutation();
const updateIDEMutation = useUpdatePreferredIDEMutation();
const openProjectMutation = useOpenProjectMutation();
const settingsQuery = useSettingsQuery({ enabled: true });
const { data: detectedIDEs } = useDetectedIDEsQuery();
const { data: detectedTerminals } = useDetectedTerminalsQuery();

// Process management
const isConfigEditorOpen = ref(false);
const { data: startProcesses } = useStartProcessesQuery(props.projectId);
const updateProcessesMutation = useUpdateStartProcessesMutation();
const startProcessesMutation = useStartProjectProcessesMutation();
const stopProcessesMutation = useStopProjectProcessesMutation();

// Get process status from props instead of individual query
const processStatus = computed(() => {
  if (!props.processStatuses || !Array.isArray(props.processStatuses)) return null;

  const projectStatus = props.processStatuses.find((ps: any) => ps.projectId === props.projectId);

  return projectStatus || null;
});

const gitProvider = computed(() => getGitProvider(props.gitRemoteUrl));

const installedTerminals = computed(() => {
  return detectedTerminals.value?.filter(terminal => terminal.installed) || [];
});

const installedIDEs = computed(() => {
  return detectedIDEs.value?.filter(ide => ide.installed) || [];
});

const defaultTerminalId = computed(() => {
  const setting = settingsQuery.data.value?.find(s => s.key === 'defaultTerminal');
  return setting?.value || null;
});

const defaultIdeId = computed(() => {
  const setting = settingsQuery.data.value?.find(s => s.key === 'defaultIde');
  return setting?.value || null;
});

const preferredTerminal = computed(() => {
  const terminalId = props.preferredTerminalId || defaultTerminalId.value;
  if (!terminalId) return null;
  return installedTerminals.value.find(terminal => terminal.id === terminalId);
});

const preferredIDE = computed(() => {
  const ideId = props.preferredIdeId || defaultIdeId.value;
  if (!ideId) return null;
  return installedIDEs.value.find(ide => ide.id === ideId);
});

const handleDelete = () => {
  deleteProject(props.projectId, props.projectName);
};

const handleRescan = () => {
  rescanProject(props.projectId);
};

const handleOpenInFinder = () => {
  openInFinder(props.projectPath);
};

const handleCopyPath = () => {
  copyPath(props.projectPath);
};

const handleOpenGitRemote = () => {
  if (props.gitRemoteUrl) {
    openGitRemote(props.gitRemoteUrl);
  }
};

const handleArchive = () => {
  archiveProject(props.projectId);
};

const handleUnarchive = () => {
  unarchiveProject(props.projectId);
};

const handleToggleFavorite = () => {
  toggleFavorite(props.projectId);
};

const handleDeletePackages = () => {
  deleteThirdPartyPackages(props.projectId, props.thirdPartySize);
};

const handleOpenTerminal = async () => {
  try {
    await openTerminalMutation.mutateAsync({ projectId: props.projectId });
  } catch (error) {
    console.error('Failed to open terminal:', error);
    alert('Failed to open terminal. Make sure the terminal is installed.');
  }
};

const handleSelectTerminal = async (terminalId: string) => {
  try {
    await updateTerminalMutation.mutateAsync({ projectId: props.projectId, terminalId });
    await handleOpenTerminal();
  } catch (error) {
    console.error('Failed to update preferred terminal:', error);
    alert('Failed to update preferred terminal. Please try again.');
  }
};

const handleOpenInIDE = async () => {
  try {
    await openProjectMutation.mutateAsync({ projectId: props.projectId });
  } catch (error) {
    console.error('Failed to open project:', error);
    alert('Failed to open project. Make sure the IDE is installed.');
  }
};

const handleSelectIDE = async (ideId: string) => {
  try {
    await updateIDEMutation.mutateAsync({ projectId: props.projectId, ideId });
    await handleOpenInIDE();
  } catch (error) {
    console.error('Failed to update preferred IDE:', error);
    alert('Failed to update preferred IDE. Please try again.');
  }
};

// Process management handlers
const hasProcesses = computed(() => {
  return startProcesses.value && startProcesses.value.length > 0;
});

const isProcessRunning = computed(() => {
  const status = processStatus.value;
  if (!status || !('processes' in status)) return false;
  const processes = (status as { processes: { status: string }[] }).processes;
  return processes.some((p: { status: string }) => p.status === 'running');
});

const handleOpenConfigEditor = () => {
  isConfigEditorOpen.value = true;
};

const handleSaveProcessConfig = async (processes: StartProcess[]) => {
  try {
    await updateProcessesMutation.mutateAsync({
      projectId: props.projectId,
      startProcesses: processes,
    });
  } catch (error) {
    console.error('Failed to save process configuration:', error);
    alert('Failed to save process configuration. Please try again.');
  }
};

const handleStartProcesses = async () => {
  try {
    await startProcessesMutation.mutateAsync(props.projectId);

    // Check auto-open setting
    const autoOpenSetting = settingsQuery.data.value?.find(s => s.key === 'autoOpenProcessUrls');
    const shouldAutoOpen = autoOpenSetting?.value === 'true' || autoOpenSetting?.value === true;

    if (shouldAutoOpen) {
      // Wait a bit for URLs to be detected
      setTimeout(() => {
        const urls = processUrls.value;
        urls.forEach(urlInfo => {
          window.electron?.shell.openExternal(urlInfo.url);
        });
      }, 3000); // Wait 3 seconds for processes to start and URLs to be detected
    }
  } catch (error) {
    console.error('Failed to start processes:', error);
    alert('Failed to start processes. Please try again.');
  }
};

const handleStopProcesses = async () => {
  try {
    await stopProcessesMutation.mutateAsync(props.projectId);
  } catch (error) {
    console.error('Failed to stop processes:', error);
    alert('Failed to stop processes. Please try again.');
  }
};

const processUrls = computed(() => {
  const status = processStatus.value;
  if (!status || !('processes' in status)) return [];
  const processes = (status as { processes: { status: string; url?: string; processId: string }[] })
    .processes;
  return processes
    .filter((p: { status: string; url?: string }) => p.status === 'running' && p.url)
    .map((p: { url?: string; processId: string }) => ({ url: p.url!, processId: p.processId }));
});

const handleOpenUrl = (url: string) => {
  window.electron?.shell.openExternal(url);
};
</script>

<template>
  <div>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm">
          <MoreVertical class="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <!-- Open in IDE sub-menu -->
        <DropdownMenuSub v-if="installedIDEs.length > 0">
          <DropdownMenuSubTrigger
            @click="preferredIDE ? handleOpenInIDE() : undefined"
            :disabled="openProjectMutation.isPending.value"
          >
            <ExternalLinkIcon class="mr-2 h-4 w-4" />
            {{ preferredIDE ? `Open in ${preferredIDE.name}` : 'Open in IDE' }}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              v-for="ide in installedIDEs"
              :key="ide.id"
              @click="handleSelectIDE(ide.id)"
              :disabled="updateIDEMutation.isPending.value"
            >
              <div
                v-if="ide.color"
                class="mr-2 h-3 w-3 rounded-sm"
                :style="{ backgroundColor: ide.color }"
              />
              {{ ide.name }}
              <span v-if="ide.id === preferredIdeId" class="ml-auto text-xs text-slate-500">✓</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <!-- Open in Terminal sub-menu -->
        <DropdownMenuSub v-if="installedTerminals.length > 0">
          <DropdownMenuSubTrigger
            @click="preferredTerminal ? handleOpenTerminal() : undefined"
            :disabled="openTerminalMutation.isPending.value"
          >
            <TerminalIcon class="mr-2 h-4 w-4" />
            {{ preferredTerminal ? `Open in ${preferredTerminal.name}` : 'Open in Terminal' }}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              v-for="terminal in installedTerminals"
              :key="terminal.id"
              @click="handleSelectTerminal(terminal.id)"
              :disabled="updateTerminalMutation.isPending.value"
            >
              <div
                v-if="terminal.color"
                class="mr-2 h-3 w-3 rounded-sm"
                :style="{ backgroundColor: terminal.color }"
              />
              {{ terminal.name }}
              <span
                v-if="terminal.id === preferredTerminalId"
                class="ml-auto text-xs text-slate-500"
                >✓</span
              >
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator v-if="installedIDEs.length > 0 || installedTerminals.length > 0" />

        <!-- Start/Stop Processes -->
        <DropdownMenuItem
          v-if="hasProcesses && !isProcessRunning"
          @click="handleStartProcesses"
          :disabled="startProcessesMutation.isPending.value"
        >
          <Play class="mr-2 h-4 w-4" />
          Start Project
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="hasProcesses && isProcessRunning"
          @click="handleStopProcesses"
          :disabled="stopProcessesMutation.isPending.value"
          class="text-amber-600 focus:text-amber-600"
        >
          <Square class="mr-2 h-4 w-4" />
          Stop Project
        </DropdownMenuItem>

        <!-- Open in Browser -->
        <DropdownMenuItem
          v-for="urlInfo in processUrls"
          :key="urlInfo.processId"
          @click="handleOpenUrl(urlInfo.url)"
        >
          <ExternalLinkIcon class="mr-2 h-4 w-4" />
          Open {{ urlInfo.url }}
        </DropdownMenuItem>

        <!-- Configure Start Command -->
        <DropdownMenuItem @click="handleOpenConfigEditor">
          <Settings class="mr-2 h-4 w-4" />
          Configure Start Command
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem @click="handleRescan" :disabled="isRescanning">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': isRescanning }" />
          Rescan Project
        </DropdownMenuItem>
        <DropdownMenuItem @click="handleOpenInFinder">
          <FolderOpen class="mr-2 h-4 w-4" />
          Open in Finder
        </DropdownMenuItem>
        <DropdownMenuItem v-if="gitProvider" @click="handleOpenGitRemote">
          <ExternalLinkIcon class="mr-2 h-4 w-4" />
          View on {{ gitProvider.name }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="handleCopyPath">
          <Copy class="mr-2 h-4 w-4" />
          Copy Path
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="handleToggleFavorite" :disabled="isTogglingFavorite">
          <Star class="mr-2 h-4 w-4" :fill="isFavorite ? 'currentColor' : 'none'" />
          {{ isFavorite ? 'Unfavorite' : 'Favorite' }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          v-if="thirdPartySize && thirdPartySize > 0"
          @click="handleDeletePackages"
          :disabled="isDeletingPackages"
          class="text-amber-600 focus:text-amber-600"
        >
          <PackageX class="mr-2 h-4 w-4" />
          Delete Packages
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="thirdPartySize && thirdPartySize > 0" />
        <DropdownMenuItem v-if="!isArchived" @click="handleArchive" :disabled="isArchiving">
          <Archive class="mr-2 h-4 w-4" />
          Archive Project
        </DropdownMenuItem>
        <DropdownMenuItem v-else @click="handleUnarchive" :disabled="isUnarchiving">
          <Archive class="mr-2 h-4 w-4" />
          Unarchive Project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          @click="handleDelete"
          :disabled="isDeleting"
          class="text-destructive focus:text-destructive"
        >
          <Trash2 class="mr-2 h-4 w-4" />
          Delete Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Process Config Editor -->
    <ProcessConfigEditor
      :project-id="projectId"
      :is-open="isConfigEditorOpen"
      :initial-processes="(startProcesses as StartProcess[]) || []"
      @update:is-open="isConfigEditorOpen = $event"
      @save="handleSaveProcessConfig"
    />
  </div>
</template>
