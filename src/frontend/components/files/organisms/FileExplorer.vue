<script setup lang="ts">
import { ref, watch } from 'vue';
import FileTree from './FileTree.vue';
import FileViewer from './FileViewer.vue';
import FileSearchInput from '../molecules/FileSearchInput.vue';
import FileTypeFilter, { type FilterValue } from '../molecules/FileTypeFilter.vue';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import type { FileNode } from '@/types/window';
import { ListChevronsDownUp } from 'lucide-vue-next';
import { useFileTree } from '@/composables/useFileTree';

interface Props {
  projectPath: string;
}

const props = defineProps<Props>();

const isLoading = ref(false);
const error = ref<string | null>(null);
const fileTree = ref<FileNode[]>([]);
const searchQuery = ref('');
const filters = ref<FilterValue[]>([]);
const fileTreeRef = ref<InstanceType<typeof FileTree> | null>(null);

// Use the file tree composable for shared logic
const {
  selectedFilePath,
  handleSelect,
  availableExtensions,
  matchingFilePaths,
  totalFileCount,
  filteredFileCount,
  hasActiveFilters,
} = useFileTree({ fileTree, searchQuery, filters });

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
          :matching-file-paths="matchingFilePaths"
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
