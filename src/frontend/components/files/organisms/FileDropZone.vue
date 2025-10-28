<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFileDrop } from '@/composables/useFileDrop';
import MoveFilesToFolderDialog from '../../projects/organisms/MoveFilesToFolderDialog.vue';
import { toast } from 'vue-sonner';

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
  console.log('handleFileDrop', files);
  if (!hasRelatedFolders.value) {
    toast({
      title: 'No related folders',
      description: 'Please add related folders first before moving files.',
      variant: 'destructive',
    });
    return;
  }

  droppedFiles.value = files;
  isMoveDialogOpen.value = true;
};

const isEnabled = computed(() => props.enabled && hasRelatedFolders.value);

const { isDragging, isOverDropZone } = useFileDrop(dropZoneRef, {
  onDrop: handleFileDrop,
  enabled: isEnabled,
});

const handleMoveFiles = async (targetFolderId: string) => {
  const targetFolder = props.folders?.find(f => f.id === targetFolderId);

  if (!targetFolder) {
    toast({
      title: 'Error',
      description: 'Target folder not found.',
      variant: 'destructive',
    });
    return;
  }

  try {
    const result = await window.electron.files.moveFiles(
      droppedFiles.value,
      targetFolder.folderPath
    );

    if (result.success) {
      toast({
        title: 'Files moved successfully',
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

      toast({
        title: 'Error moving files',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  } catch (error) {
    console.error('Error moving files:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to move files',
      variant: 'destructive',
    });
  }
};

const handleCloseDialog = () => {
  isMoveDialogOpen.value = false;
  droppedFiles.value = [];
};
</script>

<template>
  <div
    ref="dropZoneRef"
    class="h-full w-full"
    :class="isOverDropZone ? 'bg-red-400' : 'bg-emerald-400'"
  >
    <!-- Drop zone indicator overlay -->
    <div
      v-if="isDragging"
      class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-sky-500/20 backdrop-blur-sm"
    >
      <div class="rounded-lg border-4 border-dashed border-sky-500 bg-slate-100 p-8 shadow-2xl">
        <div class="flex flex-col items-center gap-4">
          <svg class="h-16 w-16 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
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
