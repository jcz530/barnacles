<script setup lang="ts">
import {
  Archive,
  Copy,
  ExternalLink as ExternalLinkIcon,
  FolderOpen,
  MoreVertical,
  PackageX,
  RefreshCw,
  Star,
  Terminal as TerminalIcon,
  Trash2,
} from 'lucide-vue-next';
import { computed } from 'vue';
import type { DetectedIDE, DetectedTerminal } from '../../../shared/types/api';
import { useProjectActions } from '../../composables/useProjectActions';
import { useQueries } from '../../composables/useQueries';
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
  detectedIDEs?: DetectedIDE[];
  detectedTerminals?: DetectedTerminal[];
  preferredIdeId?: string | null;
  preferredTerminalId?: string | null;
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
} = useQueries();
const updateTerminalMutation = useUpdatePreferredTerminalMutation();
const openTerminalMutation = useOpenTerminalMutation();
const updateIDEMutation = useUpdatePreferredIDEMutation();
const openProjectMutation = useOpenProjectMutation();
const settingsQuery = useSettingsQuery({ enabled: true });

const gitProvider = computed(() => getGitProvider(props.gitRemoteUrl));

const installedTerminals = computed(() => {
  return props.detectedTerminals?.filter(terminal => terminal.installed) || [];
});

const installedIDEs = computed(() => {
  return props.detectedIDEs?.filter(ide => ide.installed) || [];
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
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" @click.stop>
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
            <span v-if="terminal.id === preferredTerminalId" class="ml-auto text-xs text-slate-500"
              >✓</span
            >
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator v-if="installedIDEs.length > 0 || installedTerminals.length > 0" />

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
</template>
