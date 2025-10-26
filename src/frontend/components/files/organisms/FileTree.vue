<script setup lang="ts">
import { computed, ref } from 'vue';
import FileTreeItem from '../molecules/FileTreeItem.vue';
import type { FileNode } from '../../../types/window';
import type { FileCategory } from '../../../utils/file-types';
import { matchesCategory } from '../../../utils/file-types';

interface Props {
  nodes: FileNode[];
  selectedPath?: string | null;
  searchQuery?: string;
  categoryFilters?: FileCategory[];
}

const props = withDefaults(defineProps<Props>(), {
  selectedPath: null,
  searchQuery: '',
  categoryFilters: () => [],
});

const emit = defineEmits<{
  select: [node: FileNode];
}>();

// Track which directories are expanded
const expandedPaths = ref<Set<string>>(new Set());

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

      // Include directory if it has matching children or matches search
      const matchesSearch = props.searchQuery
        ? node.name.toLowerCase().includes(props.searchQuery.toLowerCase())
        : true;

      if (filteredChildren.length > 0 || matchesSearch) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });

        // Auto-expand directories when searching
        if (props.searchQuery && filteredChildren.length > 0) {
          expandedPaths.value.add(node.path);
        }
      }
    } else {
      // File node
      const matchesSearch = props.searchQuery
        ? node.name.toLowerCase().includes(props.searchQuery.toLowerCase())
        : true;

      const inCategory =
        props.categoryFilters.length === 0 ||
        props.categoryFilters.some(category => matchesCategory(node.extension, category));

      if (matchesSearch && inCategory) {
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

// Recursive component to render tree nodes
const renderNode = (node: FileNode, depth: number) => ({
  node,
  depth,
  isExpanded: expandedPaths.value.has(node.path),
  isSelected: props.selectedPath === node.path,
});
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <div v-if="filteredNodes.length === 0" class="p-4 text-center text-sm text-slate-500">
      No files found
    </div>

    <template v-for="node in filteredNodes" :key="node.path">
      <FileTreeItem v-bind="renderNode(node, 0)" @toggle="toggleExpand" @select="handleSelect" />

      <!-- Recursively render children if directory is expanded -->
      <template v-if="node.type === 'directory' && expandedPaths.has(node.path) && node.children">
        <template v-for="child in node.children" :key="child.path">
          <FileTreeItem
            v-bind="renderNode(child, 1)"
            @toggle="toggleExpand"
            @select="handleSelect"
          />

          <!-- Level 2 -->
          <template
            v-if="child.type === 'directory' && expandedPaths.has(child.path) && child.children"
          >
            <template v-for="grandchild in child.children" :key="grandchild.path">
              <FileTreeItem
                v-bind="renderNode(grandchild, 2)"
                @toggle="toggleExpand"
                @select="handleSelect"
              />

              <!-- Level 3 and deeper (flatten beyond this for simplicity) -->
              <template
                v-if="
                  grandchild.type === 'directory' &&
                  expandedPaths.has(grandchild.path) &&
                  grandchild.children
                "
              >
                <template v-for="deepChild in grandchild.children" :key="deepChild.path">
                  <FileTreeItem
                    v-bind="renderNode(deepChild, 3)"
                    @toggle="toggleExpand"
                    @select="handleSelect"
                  />
                </template>
              </template>
            </template>
          </template>
        </template>
      </template>
    </template>
  </div>
</template>
