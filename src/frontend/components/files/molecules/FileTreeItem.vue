<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown, ChevronRight, Copy, FolderOpen } from 'lucide-vue-next';
import { formatFileSize, getFileTypeInfo, getFolderIcon } from '@/utils/file-types';
import type { FileNode } from '@/types/window';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface Props {
  node: FileNode;
  projectPath: string;
  depth?: number;
  isExpanded?: boolean;
  isSelected?: boolean;
  fileCount?: { total: number; filtered: number };
  hasFilters?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  isExpanded: false,
  isSelected: false,
  fileCount: undefined,
  hasFilters: false,
});

const emit = defineEmits<{
  toggle: [node: FileNode];
  select: [node: FileNode];
}>();

const fileTypeInfo = computed(() => getFileTypeInfo(props.node.extension));
const folderIcon = computed(() => getFolderIcon(props.isExpanded));

// Format file count display
const fileCountText = computed(() => {
  if (!props.fileCount || props.node.type !== 'directory') {
    return null;
  }

  const { total, filtered } = props.fileCount;

  // If filters are active and some files are filtered out, show "filtered/total"
  if (props.hasFilters && filtered !== total) {
    return `${filtered}/${total}`;
  }

  // Otherwise just show total
  return total.toString();
});

const handleClick = () => {
  if (props.node.type === 'directory') {
    emit('toggle', props.node);
  }
  emit('select', props.node);
};

const openInFinder = () => {
  const fullPath = `${props.projectPath}/${props.node.path}`;

  // For files, reveal them in Finder. For directories, open them.
  if (props.node.type === 'file') {
    window.electron?.shell.showItemInFolder(fullPath);
  } else {
    window.electron?.shell.openPath(fullPath);
  }
};

const copyPath = async () => {
  const fullPath = `${props.projectPath}/${props.node.path}`;
  try {
    await navigator.clipboard.writeText(fullPath);
  } catch (error) {
    console.error('Failed to copy path:', error);
  }
};
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        class="group flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 transition-colors hover:bg-slate-200"
        :class="{
          'bg-sky-400/20': isSelected,
        }"
        :style="{ paddingLeft: `${depth * 12 + 8}px` }"
        @click="handleClick"
      >
        <!-- Expand/collapse icon for directories -->
        <div class="flex h-4 w-4 flex-shrink-0 items-center justify-center">
          <ChevronDown
            v-if="node.type === 'directory' && isExpanded"
            class="h-4 w-4 text-slate-500"
          />
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

        <!-- File count (for directories) -->
        <span
          :title="`${fileCount?.total} files`"
          v-if="node.type === 'directory' && fileCountText"
          class="flex-shrink-0 text-xs"
          :class="{
            'text-slate-400': !hasFilters || fileCount?.filtered === fileCount?.total,
            'font-medium text-sky-600': hasFilters && fileCount?.filtered !== fileCount?.total,
          }"
        >
          {{ fileCountText }}
        </span>

        <!-- File size (only for files) -->
        <span v-if="node.type === 'file' && node.size" class="flex-shrink-0 text-xs text-slate-400">
          {{ formatFileSize(node.size) }}
        </span>
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent>
      <ContextMenuItem @click="openInFinder">
        <FolderOpen class="h-4 w-4" />
        View in Finder
      </ContextMenuItem>
      <ContextMenuItem @click="copyPath">
        <Copy class="h-4 w-4" />
        Copy Path
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
