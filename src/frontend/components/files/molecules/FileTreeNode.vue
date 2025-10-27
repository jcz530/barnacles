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
}

defineProps<Props>();

const emit = defineEmits<{
  toggle: [node: FileNode];
  select: [node: FileNode];
}>();
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
      @toggle="emit('toggle', node)"
      @select="emit('select', node)"
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
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
      />
    </template>
  </div>
</template>
