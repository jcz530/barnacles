<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { RadioGroup } from '../../ui/radio-group';
import { FileText, Loader2 } from 'lucide-vue-next';
import FolderTreeItem from '../../files/molecules/FolderTreeItem.vue';
import type { FolderTreeNode } from '@/types/folder-tree';

interface Props {
  open: boolean;
  files: string[]; // Array of file paths
  folderTrees: FolderTreeNode[];
  loading?: boolean;
}

interface Emits {
  close: [];
  move: [targetFolderPath: string];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});
const emit = defineEmits<Emits>();

const selectedFolderPath = ref('');
const isMoving = ref(false);
const errorMessage = ref('');

// Watch for modal open/close to reset state
watch(
  () => props.open,
  isOpen => {
    if (isOpen) {
      // Auto-select if there's only one folder and no subfolders
      if (
        props.folderTrees.length === 1 &&
        (!props.folderTrees[0].children || props.folderTrees[0].children.length === 0)
      ) {
        selectedFolderPath.value = props.folderTrees[0].path;
      }
    } else {
      selectedFolderPath.value = '';
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
  if (!selectedFolderPath.value) {
    errorMessage.value = 'Please select a folder';
    return;
  }

  errorMessage.value = '';
  isMoving.value = true;

  try {
    emit('move', selectedFolderPath.value);
  } catch (error: any) {
    errorMessage.value = error?.message || 'Failed to move files';
    isMoving.value = false;
  }
};

const handleSelectFolder = (path: string) => {
  selectedFolderPath.value = path;
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
          <div v-if="loading" class="flex items-center justify-center py-8 text-slate-500">
            <Loader2 :size="24" class="animate-spin" />
            <span class="ml-2">Loading folders...</span>
          </div>
          <div
            v-else-if="folderTrees.length === 0"
            class="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600"
          >
            No related folders available
          </div>
          <RadioGroup v-else v-model="selectedFolderPath" class="space-y-1">
            <div
              v-for="tree in folderTrees"
              :key="tree.id"
              class="rounded-md border border-slate-200 p-2"
            >
              <!-- Root folder -->
              <FolderTreeItem
                :node="{
                  name: tree.name,
                  path: tree.path,
                  type: 'directory',
                  children: tree.children,
                }"
                :level="0"
                :selected-path="selectedFolderPath"
                :parent-path="tree.path.substring(0, tree.path.lastIndexOf('/'))"
                @select="handleSelectFolder"
              />
            </div>
          </RadioGroup>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="text-danger-700 bg-danger-50 rounded-md p-3 text-sm">
          {{ errorMessage }}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleClose" :disabled="isMoving"> Cancel </Button>
        <Button :disabled="!selectedFolderPath || isMoving || loading" @click="handleMove">
          {{ isMoving ? 'Moving...' : 'Move Files' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
