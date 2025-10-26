<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { formatFileSize, getFileTypeInfo, getFolderIcon } from '@/utils/file-types';
import type { FileNode } from '@/types/window';

interface Props {
  node: FileNode;
  depth?: number;
  isExpanded?: boolean;
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  isExpanded: false,
  isSelected: false,
});

const emit = defineEmits<{
  toggle: [node: FileNode];
  select: [node: FileNode];
}>();

const fileTypeInfo = computed(() => getFileTypeInfo(props.node.extension));
const folderIcon = computed(() => getFolderIcon(props.isExpanded));

const handleClick = () => {
  if (props.node.type === 'directory') {
    emit('toggle', props.node);
  }
  emit('select', props.node);
};
</script>

<template>
  <div
    class="group flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 transition-colors hover:bg-slate-100"
    :class="{
      'bg-blue-50 hover:bg-blue-100': isSelected,
    }"
    :style="{ paddingLeft: `${depth * 12 + 8}px` }"
    @click="handleClick"
  >
    <!-- Expand/collapse icon for directories -->
    <div class="flex h-4 w-4 flex-shrink-0 items-center justify-center">
      <ChevronDown v-if="node.type === 'directory' && isExpanded" class="h-4 w-4 text-slate-500" />
      <ChevronRight
        v-else-if="node.type === 'directory' && !isExpanded"
        class="h-4 w-4 text-slate-500"
      />
    </div>

    <!-- File/folder icon -->
    <component
      :is="node.type === 'directory' ? folderIcon : fileTypeInfo.icon"
      class="h-4 w-4 flex-shrink-0"
      :class="{
        'text-sky-500': node.type === 'directory',
        'text-slate-500': node.type === 'file',
      }"
    />

    <!-- File/folder name -->
    <span
      class="flex-1 truncate text-sm"
      :class="{
        'font-medium': node.type === 'directory',
        'text-slate-900': isSelected,
        'text-slate-700': !isSelected,
      }"
    >
      {{ node.name }}
    </span>

    <!-- File size (only for files) -->
    <span v-if="node.type === 'file' && node.size" class="flex-shrink-0 text-xs text-slate-400">
      {{ formatFileSize(node.size) }}
    </span>
  </div>
</template>
