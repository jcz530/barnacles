<script setup lang="ts">
import FileTreeItem from './FileTreeItem.vue';
import type { FileNode } from '@/types/window';

interface Props {
  node: FileNode;
  projectPath: string;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  selectedPath: string | null | undefined;
  expandedPaths: Set<string>;
  fileCounts: Map<string, { total: number; filtered: number }>;
  fileCount?: { total: number; filtered: number };
  hasFilters: boolean;
  isRelatedFoldersMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isRelatedFoldersMode: false,
});

const emit = defineEmits<{
  toggle: [node: FileNode];
  select: [node: FileNode];
  'remove-folder': [folderPath: string];
}>();

// Check if this node is a root folder in related folders mode
const isRootFolder = props.depth === 0 && props.isRelatedFoldersMode;
</script>

<template>
  <div>
    <!-- Render the current node -->
    <FileTreeItem
      :node="node"
      :project-path="projectPath"
      :depth="depth"
      :is-expanded="isExpanded"
      :is-selected="isSelected"
      :file-count="fileCount"
      :has-filters="hasFilters"
      :is-root-folder="isRootFolder"
      @toggle="emit('toggle', node)"
      @select="emit('select', node)"
      @remove-folder="emit('remove-folder', $event)"
    />

    <!-- Recursively render children if directory is expanded -->
    <template v-if="node.type === 'directory' && isExpanded && node.children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :project-path="projectPath"
        :depth="depth + 1"
        :is-expanded="expandedPaths.has(child.path)"
        :is-selected="selectedPath === child.path"
        :selected-path="selectedPath"
        :expanded-paths="expandedPaths"
        :file-counts="fileCounts"
        :file-count="child.type === 'directory' ? fileCounts.get(child.path) : undefined"
        :has-filters="hasFilters"
        :is-related-folders-mode="isRelatedFoldersMode"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
        @remove-folder="emit('remove-folder', $event)"
      />
    </template>
  </div>
</template>
