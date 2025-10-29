<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFileDrop } from '@/composables/useFileDrop';
import MoveFilesToFolderDialog from '../../projects/organisms/MoveFilesToFolderDialog.vue';
import { toast } from 'vue-sonner';
import { FolderInput } from 'lucide-vue-next';
import type { FolderTreeNode } from '@/types/folder-tree';

interface Props {
  folders: Array<{ id: string; folderPath: string }>;
  enabled?: boolean;
}

interface Emits {
  filesMovedSuccessfully: [];
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
});

const emit = defineEmits<Emits>();

const dropZoneRef = ref<HTMLElement>();
const droppedFiles = ref<string[]>([]);
const isMoveDialogOpen = ref(false);
const folderTrees = ref<FolderTreeNode[]>([]);
const isLoadingFolders = ref(false);

const hasRelatedFolders = computed(() => {
  return props.folders && props.folders.length > 0;
});

// Load folder trees when folders change
watch(
  () => props.folders,
  async newFolders => {
    if (!newFolders || newFolders.length === 0) {
      folderTrees.value = [];
      return;
    }

    isLoadingFolders.value = true;
    try {
      const trees = await Promise.all(
        newFolders.map(async folder => {
          try {
            const result = await window.electron.files.readDirectory(folder.folderPath);
            if (result.success && result.data) {
              return {
                id: folder.id,
                name: folder.folderPath.split('/').pop() || folder.folderPath,
                path: folder.folderPath,
                type: 'directory' as const,
                children: result.data,
              };
            }
            return {
              id: folder.id,
              name: folder.folderPath.split('/').pop() || folder.folderPath,
              path: folder.folderPath,
              type: 'directory' as const,
              children: [],
            };
          } catch (error) {
            console.error(`Failed to load folder tree for ${folder.folderPath}:`, error);
            return {
              id: folder.id,
              name: folder.folderPath.split('/').pop() || folder.folderPath,
              path: folder.folderPath,
              type: 'directory' as const,
              children: [],
            };
          }
        })
      );
      folderTrees.value = trees;
    } finally {
      isLoadingFolders.value = false;
    }
  },
  { immediate: true }
);

const handleFileDrop = (files: string[]) => {
  if (!hasRelatedFolders.value) {
    toast.error('No related folders', {
      description: 'Please add related folders first before moving files.',
    });
    return;
  }

  droppedFiles.value = files;
  isMoveDialogOpen.value = true;
};

const isEnabled = computed(() => props.enabled && hasRelatedFolders.value);

const { isDragging } = useFileDrop(dropZoneRef, {
  onDrop: handleFileDrop,
  enabled: isEnabled,
});

const handleMoveFiles = async (targetFolderPath: string) => {
  if (!targetFolderPath) {
    toast.error('Error', {
      description: 'Target folder not found.',
    });
    return;
  }

  try {
    // Ensure we're only passing string paths, not File objects
    const filePaths = droppedFiles.value.map(f => String(f));

    const result = await window.electron.files.moveFiles(filePaths, targetFolderPath);

    if (result.success) {
      toast.success('Files moved successfully', {
        description: `Moved ${droppedFiles.value.length} file(s) to ${targetFolderPath}`,
      });
      isMoveDialogOpen.value = false;
      droppedFiles.value = [];

      // Emit event to notify parent that files were moved
      emit('filesMovedSuccessfully');
    } else {
      // Show detailed error for failed files
      const failedFiles = result.results?.filter(r => !r.success) || [];
      const errorMsg =
        failedFiles.length > 0
          ? `Failed to move ${failedFiles.length} file(s): ${failedFiles.map(f => f.error).join(', ')}`
          : result.error || 'Failed to move files';

      toast.error('Error moving files', {
        description: errorMsg,
      });
    }
  } catch (error) {
    console.error('Error moving files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to move files';
    toast.error('Error moving files', {
      description: errorMessage,
    });
  }
};

const handleCloseDialog = () => {
  isMoveDialogOpen.value = false;
  droppedFiles.value = [];
};
</script>

<template>
  <div ref="dropZoneRef" class="h-full w-full">
    <!-- Drop zone indicator overlay -->
    <div
      v-if="isDragging"
      class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-sky-500/20 backdrop-blur-sm"
    >
      <div class="rounded-lg border-4 border-dashed border-sky-500 bg-slate-100 p-8 shadow-2xl">
        <div class="flex flex-col items-center gap-4">
          <FolderInput class="h-16 w-16 text-sky-500" />
          <div class="text-center">
            <p class="text-xl font-semibold text-slate-900">Drop files here</p>
            <p class="mt-1 text-sm text-slate-600">
              Choose a related folder to move {{ droppedFiles.length || 'your' }} file{{
                droppedFiles.length === 1 ? '' : 's'
              }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Slot for content -->
    <slot />

    <!-- Move Files Dialog -->
    <MoveFilesToFolderDialog
      :open="isMoveDialogOpen"
      :files="droppedFiles"
      :folder-trees="folderTrees"
      :loading="isLoadingFolders"
      @close="handleCloseDialog"
      @move="handleMoveFiles"
    />
  </div>
</template>
