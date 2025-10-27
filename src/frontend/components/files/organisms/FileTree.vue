<script setup lang="ts">
import { computed, ref } from 'vue';
import FileTreeNode from '../molecules/FileTreeNode.vue';
import type { FileNode } from '@/types/window';
import type { FilterValue } from '../molecules/FileTypeFilter.vue';
import { type FileCategory, matchesCategory } from '@/utils/file-types';

interface Props {
  nodes: FileNode[];
  projectPath: string;
  selectedPath?: string | null;
  searchQuery?: string;
  filters?: FilterValue[];
}

const props = withDefaults(defineProps<Props>(), {
  selectedPath: null,
  searchQuery: '',
  filters: () => [],
});

const emit = defineEmits<{
  select: [node: FileNode];
}>();

// Track which directories are expanded
const expandedPaths = ref<Set<string>>(new Set());

// Calculate total file count for a node (recursive)
function getTotalFileCount(node: FileNode): number {
  if (node.type === 'file') {
    return 1;
  }

  if (node.type === 'directory' && node.children) {
    return node.children.reduce((count, child) => count + getTotalFileCount(child), 0);
  }

  return 0;
}

// Calculate filtered file count for a node (recursive)
function getFilteredFileCount(node: FileNode): number {
  if (node.type === 'file') {
    // Check if this file matches the current filters
    const matchesSearch = props.searchQuery
      ? node.name.toLowerCase().includes(props.searchQuery.toLowerCase())
      : true;

    const matchesFilter = () => {
      if (props.filters.length === 0) return true;

      const ext = node.extension?.toLowerCase();

      return props.filters.some(filter => {
        const categories: FileCategory[] = [
          'image',
          'video',
          'audio',
          'document',
          'code',
          'data',
          'archive',
          'other',
        ];

        if (categories.includes(filter as FileCategory)) {
          return matchesCategory(ext, filter as FileCategory);
        }

        return ext === filter.toLowerCase();
      });
    };

    return matchesSearch && matchesFilter() ? 1 : 0;
  }

  if (node.type === 'directory' && node.children) {
    return node.children.reduce((count, child) => count + getFilteredFileCount(child), 0);
  }

  return 0;
}

// Map to store file counts for each directory
const fileCounts = computed(() => {
  const counts = new Map<string, { total: number; filtered: number }>();

  const calculateCounts = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'directory') {
        const total = getTotalFileCount(node);
        const filtered = getFilteredFileCount(node);
        counts.set(node.path, { total, filtered });

        if (node.children) {
          calculateCounts(node.children);
        }
      }
    }
  };

  calculateCounts(props.nodes);
  return counts;
});

// Filter nodes based on search query and category filters
const filteredNodes = computed(() => {
  return filterNodesRecursive(props.nodes);
});

function filterNodesRecursive(nodes: FileNode[]): FileNode[] {
  const filtered: FileNode[] = [];

  for (const node of nodes) {
    if (node.type === 'directory') {
      // Recursively filter children
      const filteredChildren = node.children ? filterNodesRecursive(node.children) : [];

      // Only include directory if it has matching children
      if (filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });

        // Auto-expand directories when searching or filtering
        if ((props.searchQuery || props.filters.length > 0) && filteredChildren.length > 0) {
          expandedPaths.value.add(node.path);
        }
      }
    } else {
      // File node
      const matchesSearch = props.searchQuery
        ? node.name.toLowerCase().includes(props.searchQuery.toLowerCase())
        : true;

      // Check if file matches any of the filters
      const matchesFilter = () => {
        if (props.filters.length === 0) return true;

        const ext = node.extension?.toLowerCase();

        return props.filters.some(filter => {
          // Check if filter is a category
          const categories: FileCategory[] = [
            'image',
            'video',
            'audio',
            'document',
            'code',
            'data',
            'archive',
            'other',
          ];

          if (categories.includes(filter as FileCategory)) {
            return matchesCategory(ext, filter as FileCategory);
          }

          // Otherwise it's a specific extension
          return ext === filter.toLowerCase();
        });
      };

      if (matchesSearch && matchesFilter()) {
        filtered.push(node);
      }
    }
  }

  return filtered;
}

const toggleExpand = (node: FileNode) => {
  if (expandedPaths.value.has(node.path)) {
    expandedPaths.value.delete(node.path);
  } else {
    expandedPaths.value.add(node.path);
  }
};

const handleSelect = (node: FileNode) => {
  emit('select', node);
};

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return props.searchQuery.trim().length > 0 || props.filters.length > 0;
});

// Collapse all expanded directories
const collapseAll = () => {
  expandedPaths.value.clear();
};

// Expose methods to parent component
defineExpose({
  collapseAll,
});
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <div v-if="filteredNodes.length === 0" class="p-4 text-center text-sm text-slate-500">
      No files found
    </div>

    <FileTreeNode
      v-for="node in filteredNodes"
      :key="node.path"
      :node="node"
      :project-path="projectPath"
      :depth="0"
      :is-expanded="expandedPaths.has(node.path)"
      :is-selected="selectedPath === node.path"
      :selected-path="selectedPath"
      :expanded-paths="expandedPaths"
      :file-counts="fileCounts"
      :file-count="node.type === 'directory' ? fileCounts.get(node.path) : undefined"
      :has-filters="hasActiveFilters"
      @toggle="toggleExpand"
      @select="handleSelect"
    />
  </div>
</template>
