<script setup lang="ts">
import {
  Archive,
  Copy,
  ExternalLink,
  FolderOpen,
  MoreVertical,
  PackageX,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useProjectActions } from '../../composables/useProjectActions';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

const gitProvider = computed(() => getGitProvider(props.gitRemoteUrl));

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
      <DropdownMenuItem @click="handleRescan" :disabled="isRescanning">
        <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': isRescanning }" />
        Rescan Project
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleOpenInFinder">
        <FolderOpen class="mr-2 h-4 w-4" />
        Open in Finder
      </DropdownMenuItem>
      <DropdownMenuItem v-if="gitProvider" @click="handleOpenGitRemote">
        <ExternalLink class="mr-2 h-4 w-4" />
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
