<script setup lang="ts">
import { computed, ref } from 'vue';
import FileTreeNode from '../molecules/FileTreeNode.vue';
import type { FileNode } from '@/types/window';
import type { FilterValue } from '../molecules/FileTypeFilter.vue';
import { type FileCategory, matchesCategory } from '@/utils/file-types';
import { useFileTreeNavigation } from '@/composables/useFileTreeNavigation';

interface Props {
  nodes: FileNode[];
  projectPath: string;
  selectedPath?: string | null;
  searchQuery?: string;
  filters?: FilterValue[];
  matchingFilePaths?: Set<string> | null;
  isRelatedFoldersMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selectedPath: null,
  searchQuery: '',
  filters: () => [],
  matchingFilePaths: null,
  isRelatedFoldersMode: false,
});

const emit = defineEmits<{
  select: [node: FileNode];
  'remove-folder': [folderPath: string];
  'hide-folder': [path: string];
}>();

const handleRemoveFolder = (folderPath: string) => {
  emit('remove-folder', folderPath);
};

const handleHideFolder = (path: string) => {
  emit('hide-folder', path);
};

// Track which directories are expanded
const expandedPaths = ref<Set<string>>(new Set());

// Create a ref for selected path to pass to navigation composable
const selectedPathRef = computed({
  get: () => props.selectedPath,
  set: () => {}, // Read-only computed ref
});

// Shared filter matching logic
const fileMatchesFilters = (extension: string | undefined, filters: FilterValue[]): boolean => {
  if (filters.length === 0) return true;

  const ext = extension?.toLowerCase();

  return filters.some(filter => {
    if (filter.type === 'category') {
      return matchesCategory(ext, filter.value as FileCategory);
    } else if (filter.type === 'extension') {
      return ext === filter.value.toLowerCase();
    }
    return false;
  });
};

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
    const matchesSearch =
      props.matchingFilePaths === null || props.matchingFilePaths?.has(node.path);
    const matchesFilter = fileMatchesFilters(node.extension, props.filters);

    return matchesSearch && matchesFilter ? 1 : 0;
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
      // File node - check both search and filter matches
      const matchesSearch =
        props.matchingFilePaths === null || props.matchingFilePaths?.has(node.path);
      const matchesFilter = fileMatchesFilters(node.extension, props.filters);

      if (matchesSearch && matchesFilter) {
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

// Setup keyboard navigation
const { containerRef, focusedIndex, flattenedNodes, updateFocusFromDOM } = useFileTreeNavigation({
  nodes: filteredNodes,
  expandedPaths,
  selectedPath: selectedPathRef,
  onToggle: toggleExpand,
  onSelect: handleSelect,
});

// Handle focus events from tree items
const handleFocus = () => {
  updateFocusFromDOM();
};

// Expose methods to parent component
defineExpose({
  collapseAll,
});
</script>

<template>
  <div ref="containerRef" class="flex h-full flex-col overflow-y-auto p-1" tabindex="-1">
    <div v-if="filteredNodes.length === 0" class="p-4 text-center text-sm text-slate-500">
      No files found
    </div>

    <FileTreeNode
      v-for="(node, index) in filteredNodes"
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
      :is-related-folders-mode="isRelatedFoldersMode"
      :focused-index="focusedIndex"
      :flattened-nodes="flattenedNodes"
      @toggle="toggleExpand"
      @select="handleSelect"
      @remove-folder="handleRemoveFolder"
      @hide-folder="handleHideFolder"
      @focus="handleFocus"
    />
  </div>
</template>
