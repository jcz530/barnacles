<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '@/composables/useQueries';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import FolderAutocompleteInput from '../../molecules/FolderAutocompleteInput.vue';
import { FolderSearch } from 'lucide-vue-next';

interface Props {
  open: boolean;
  projectId: string;
}

interface Emits {
  close: [];
  added: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { useAddRelatedFolderMutation } = useQueries();
const addMutation = useAddRelatedFolderMutation();

const folderPath = ref('');
const errorMessage = ref('');

// Watch for modal open/close to reset state
watch(
  () => props.open,
  isOpen => {
    if (!isOpen) {
      folderPath.value = '';
      errorMessage.value = '';
    }
  }
);

const handleAdd = async () => {
  if (!folderPath.value.trim()) {
    errorMessage.value = 'Please select a folder';
    return;
  }

  errorMessage.value = '';

  try {
    await addMutation.mutateAsync({
      projectId: props.projectId,
      folderPath: folderPath.value,
    });
    emit('added');
    emit('close');
  } catch (error: any) {
    // Extract error message from the API response
    const apiError = error?.response?.data?.error || error?.message;
    errorMessage.value = apiError || 'Failed to add folder';
  }
};

const handleClose = () => {
  emit('close');
};

const handleBrowse = async () => {
  try {
    const result = await window.electron.files.selectFolder();

    if (result.success && result.data) {
      folderPath.value = result.data;
      errorMessage.value = '';
    } else if (!result.canceled) {
      errorMessage.value = result.error || 'Failed to select folder';
    }
  } catch (error) {
    console.error('Error opening folder dialog:', error);
    errorMessage.value = 'Failed to open folder selector';
  }
};
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Add Related Folder</DialogTitle>
        <DialogDescription>
          Add a folder from your file system that is related to this project.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Folder Path</label>
          <div class="flex gap-2">
            <div class="flex-1">
              <FolderAutocompleteInput
                v-model="folderPath"
                placeholder="Type to search for a folder..."
                :strict="false"
              />
            </div>
            <Button
              variant="outline"
              class="shrink-0"
              @click="handleBrowse"
              title="Browse for folder"
            >
              <FolderSearch :size="18" />
            </Button>
          </div>
          <p class="text-xs text-slate-500">
            Type to search or click the browse button to select a folder
          </p>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="text-danger-700 bg-danger-50 rounded-md p-3 text-sm">
          {{ errorMessage }}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleClose"> Cancel </Button>
        <Button :disabled="!folderPath.trim() || addMutation.isPending.value" @click="handleAdd">
          {{ addMutation.isPending.value ? 'Adding...' : 'Add Folder' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
