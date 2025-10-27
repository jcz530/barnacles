<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FileTree from './FileTree.vue';
import FileViewer from './FileViewer.vue';
import FileSearchInput from '../molecules/FileSearchInput.vue';
import FileTypeFilter, { type FilterValue } from '../molecules/FileTypeFilter.vue';
import { Skeleton } from '../../ui/skeleton';
import type { FileNode } from '../../../types/window';

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
</script>

<template>
  <div class="flex h-full">
    <!-- Sidebar: File tree -->
    <div class="flex w-80 flex-col rounded-l-lg border-r border-slate-200 bg-slate-100">
      <!-- Search and filter controls -->
      <div class="space-y-2 border-b border-slate-200 p-3">
        <FileSearchInput v-model="searchQuery" />
        <div class="flex gap-2">
          <FileTypeFilter
            :selected-filters="filters"
            :available-extensions="availableExtensions"
            @update:selected-filters="filters = $event"
          />
        </div>
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
