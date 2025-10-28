<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFileDrop } from '@/composables/useFileDrop';
import MoveFilesToFolderDialog from '../../projects/organisms/MoveFilesToFolderDialog.vue';
import { toast } from 'vue-sonner';
import { FolderInput } from 'lucide-vue-next';

interface Props {
  folders: Array<{ id: string; folderPath: string }>;
  enabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
});

const dropZoneRef = ref<HTMLElement>();
const droppedFiles = ref<string[]>([]);
const isMoveDialogOpen = ref(false);

const hasRelatedFolders = computed(() => {
  return props.folders && props.folders.length > 0;
});

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

const handleMoveFiles = async (targetFolderId: string) => {
  const targetFolder = props.folders?.find(f => f.id === targetFolderId);

  if (!targetFolder) {
    toast.error('Error', {
      description: 'Target folder not found.',
    });
    return;
  }

  try {
    // Ensure we're only passing string paths, not File objects
    const filePaths = droppedFiles.value.map(f => String(f));

    const result = await window.electron.files.moveFiles(filePaths, targetFolder.folderPath);

    if (result.success) {
      toast.success('Files moved successfully', {
        description: `Moved ${droppedFiles.value.length} file(s) to ${targetFolder.folderPath}`,
      });
      isMoveDialogOpen.value = false;
      droppedFiles.value = [];
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
      :folders="folders"
      @close="handleCloseDialog"
      @move="handleMoveFiles"
    />
  </div>
</template>
