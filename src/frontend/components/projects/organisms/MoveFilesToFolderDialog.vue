<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Label } from '../../ui/label';
import { FolderOpen, FileText } from 'lucide-vue-next';

interface Props {
  open: boolean;
  files: string[]; // Array of file paths
  folders: Array<{ id: string; folderPath: string }>;
}

interface Emits {
  close: [];
  move: [targetFolderId: string];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedFolderId = ref('');
const isMoving = ref(false);
const errorMessage = ref('');

// Watch for modal open/close to reset state
watch(
  () => props.open,
  isOpen => {
    if (isOpen) {
      // Auto-select if there's only one folder
      if (props.folders.length === 1) {
        selectedFolderId.value = props.folders[0].id;
      }
    } else {
      selectedFolderId.value = '';
      isMoving.value = false;
      errorMessage.value = '';
    }
  }
);

const fileNames = computed(() => {
  return props.files.map(path => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  });
});

const handleMove = async () => {
  if (!selectedFolderId.value) {
    errorMessage.value = 'Please select a folder';
    return;
  }

  errorMessage.value = '';
  isMoving.value = true;

  try {
    emit('move', selectedFolderId.value);
  } catch (error: any) {
    errorMessage.value = error?.message || 'Failed to move files';
    isMoving.value = false;
  }
};

const handleClose = () => {
  if (!isMoving.value) {
    emit('close');
  }
};
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Move Files to Folder</DialogTitle>
        <DialogDescription>
          Select a related folder to move {{ files.length }} file{{ files.length === 1 ? '' : 's' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Files being moved -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Files to move:</label>
          <div class="max-h-32 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
            <div
              v-for="(fileName, index) in fileNames"
              :key="index"
              class="flex items-center gap-2 text-sm text-slate-700"
            >
              <FileText :size="14" class="flex-shrink-0 text-slate-400" />
              <span class="truncate">{{ fileName }}</span>
            </div>
          </div>
        </div>

        <!-- Folder selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Select destination folder:</label>
          <RadioGroup v-model="selectedFolderId" class="space-y-2">
            <div
              v-for="folder in folders"
              :key="folder.id"
              class="flex items-center space-x-2 rounded-md border border-slate-200 p-3 transition-colors hover:bg-slate-50"
              :class="{ 'border-sky-500 bg-sky-50': selectedFolderId === folder.id }"
            >
              <RadioGroupItem :id="folder.id" :value="folder.id" />
              <Label
                :for="folder.id"
                class="flex flex-1 cursor-pointer items-center gap-2 text-sm font-normal"
              >
                <FolderOpen :size="16" class="text-sky-500" />
                <span class="truncate">{{ folder.folderPath }}</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ errorMessage }}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleClose" :disabled="isMoving"> Cancel </Button>
        <Button :disabled="!selectedFolderId || isMoving" @click="handleMove">
          {{ isMoving ? 'Moving...' : 'Move Files' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
