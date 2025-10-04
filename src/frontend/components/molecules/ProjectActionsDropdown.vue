<script setup lang="ts">
import { Copy, ExternalLink, FolderOpen, MoreVertical, RefreshCw, Trash2 } from 'lucide-vue-next';
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
  gitRemoteUrl?: string | null;
}

const props = defineProps<Props>();

const {
  deleteProject,
  rescanProject,
  openInFinder,
  copyPath,
  openGitRemote,
  getGitProvider,
  isDeleting,
  isRescanning,
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
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm">
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
