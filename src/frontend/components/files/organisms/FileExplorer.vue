<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FileTree from './FileTree.vue';
import FileViewer from './FileViewer.vue';
import FileSearchInput from '../molecules/FileSearchInput.vue';
import FileTypeFilter, { type FilterValue } from '../molecules/FileTypeFilter.vue';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import type { FileNode } from '@/types/window';
import { type FileCategory, matchesCategory } from '@/utils/file-types';
import { ListChevronsDownUp } from 'lucide-vue-next';

interface Props {
  projectPath: string;
}

const props = defineProps<Props>();

const isLoading = ref(false);
const error = ref<string | null>(null);
const fileTree = ref<FileNode[]>([]);
const selectedFile = ref<FileNode | null>(null);
const searchQuery = ref('');
const filters = ref<FilterValue[]>([]);
const fileTreeRef = ref<InstanceType<typeof FileTree> | null>(null);

// Load directory tree on mount
const loadFileTree = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await window.electron.files.readDirectory(props.projectPath);

    if (result.success && result.data) {
      fileTree.value = result.data;
    } else {
      error.value = result.error || 'Failed to load file tree';
      fileTree.value = [];
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    fileTree.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Load file tree when component mounts
watch(
  () => props.projectPath,
  () => {
    loadFileTree();
  },
  { immediate: true }
);

// Handle file selection
const handleSelect = (node: FileNode) => {
  if (node.type === 'file') {
    selectedFile.value = node;
  }
};

// Computed selected file path
const selectedFilePath = computed(() => selectedFile.value?.path || null);

// Extract all unique extensions that exist in the project
const availableExtensions = computed(() => {
  const extensions = new Set<string>();

  const extractExtensions = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file' && node.extension) {
        extensions.add(node.extension.toLowerCase());
      }
      if (node.type === 'directory' && node.children) {
        extractExtensions(node.children);
      }
    }
  };

  extractExtensions(fileTree.value);
  return extensions;
});

// Calculate total file count
const totalFileCount = computed(() => {
  const countFiles = (nodes: FileNode[]): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'file') {
        count++;
      } else if (node.type === 'directory' && node.children) {
        count += countFiles(node.children);
      }
    }
    return count;
  };

  return countFiles(fileTree.value);
});

// Calculate filtered file count
const filteredFileCount = computed(() => {
  const countFilteredFiles = (nodes: FileNode[]): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'file') {
        // Check if file matches search query
        const matchesSearch = searchQuery.value
          ? node.name.toLowerCase().includes(searchQuery.value.toLowerCase())
          : true;

        // Check if file matches filters
        const matchesFilter = () => {
          if (filters.value.length === 0) return true;

          const ext = node.extension?.toLowerCase();
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

          return filters.value.some(filter => {
            if (categories.includes(filter as FileCategory)) {
              return matchesCategory(ext, filter as FileCategory);
            }
            return ext === filter.toLowerCase();
          });
        };

        if (matchesSearch && matchesFilter()) {
          count++;
        }
      } else if (node.type === 'directory' && node.children) {
        count += countFilteredFiles(node.children);
      }
    }
    return count;
  };

  return countFilteredFiles(fileTree.value);
});

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim().length > 0 || filters.value.length > 0;
});

// Collapse all directories in the tree
const handleCollapseAll = () => {
  fileTreeRef.value?.collapseAll();
};
</script>

<template>
  <div class="flex h-full">
    <!-- Sidebar: File tree -->
    <div class="flex w-80 flex-col rounded-l-lg border-r border-slate-200 bg-slate-100">
      <!-- Search and filter controls -->
      <div class="space-y-2 p-3">
        <FileSearchInput v-model="searchQuery" />
        <div class="flex gap-2">
          <FileTypeFilter
            :selected-filters="filters"
            :available-extensions="availableExtensions"
            @update:selected-filters="filters = $event"
          />
        </div>
      </div>

      <!-- File count and actions -->
      <div class="flex items-center justify-between border-b border-slate-200 px-3 pb-1">
        <span class="text-xs text-slate-600">
          <template v-if="hasActiveFilters">
            <span class="font-medium text-sky-600">{{ filteredFileCount }}</span>
            <span class="text-slate-400">/{{ totalFileCount }}</span>
            <span class="ml-1">files</span>
          </template>
          <template v-else>
            <span class="font-medium">{{ totalFileCount }}</span>
            <span class="ml-1">files</span>
          </template>
        </span>
        <Button
          title="Collapse All"
          variant="ghost"
          size="icon"
          class="h-6 px-2 text-xs hover:bg-slate-200/50 hover:text-sky-600"
          @click="handleCollapseAll"
        >
          <ListChevronsDownUp />
        </Button>
      </div>

      <!-- File tree -->
      <div class="flex-1 overflow-hidden">
        <!-- Loading state -->
        <div v-if="isLoading" class="space-y-2 p-3">
          <Skeleton v-for="i in 8" :key="i" class="h-6 w-full" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="p-4">
          <div class="rounded-lg border border-red-200 bg-red-50 p-3">
            <p class="text-sm text-red-700">{{ error }}</p>
          </div>
        </div>

        <!-- File tree -->
        <FileTree
          v-else
          ref="fileTreeRef"
          :nodes="fileTree"
          :project-path="projectPath"
          :selected-path="selectedFilePath"
          :search-query="searchQuery"
          :filters="filters"
          @select="handleSelect"
        />
      </div>
    </div>

    <!-- Main content: File viewer -->
    <div class="flex-1">
      <FileViewer :file-path="selectedFilePath" :project-path="projectPath" />
    </div>
  </div>
</template>
