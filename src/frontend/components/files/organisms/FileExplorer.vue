<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FileTree from './FileTree.vue';
import FileViewer from './FileViewer.vue';
import FileSearchInput from '../molecules/FileSearchInput.vue';
import FileTypeFilter, { type FilterValue } from '../molecules/FileTypeFilter.vue';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import type { FileNode } from '@/types/window';
import { ArrowDownAZ, Clock, ListChevronsDownUp } from 'lucide-vue-next';
import { useFileTree } from '@/composables/useFileTree';

interface Props {
  projectPath?: string;
  rootFolders?: Array<{ id: string; folderPath: string }>;
  sortBy?: 'alphabetical' | 'lastModified';
}

const props = withDefaults(defineProps<Props>(), {
  sortBy: 'alphabetical',
});

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

// Emit events for sort changes and folder removal
const emit = defineEmits<{
  'update:sortBy': [value: 'alphabetical' | 'lastModified'];
  'remove-folder': [folderId: string];
}>();

// Check if we're in related folders mode
const isRelatedFoldersMode = computed(() => {
  return props.rootFolders && props.rootFolders.length > 0;
});

// Handle folder removal request
const handleRemoveFolder = (folderPath: string) => {
  // Find the folder ID by path
  const folder = props.rootFolders?.find(f => f.folderPath === folderPath);
  if (folder) {
    emit('remove-folder', folder.id);
  }
};

const currentSortBy = ref<'alphabetical' | 'lastModified'>(props.sortBy);

// Toggle sort mode
const toggleSort = () => {
  currentSortBy.value = currentSortBy.value === 'alphabetical' ? 'lastModified' : 'alphabetical';
  emit('update:sortBy', currentSortBy.value);
};

// Sort icon component
const sortIcon = computed(() => {
  return currentSortBy.value === 'alphabetical' ? ArrowDownAZ : Clock;
});

const sortTooltip = computed(() => {
  return currentSortBy.value === 'alphabetical' ? 'Sort by name (A-Z)' : 'Sort by last modified';
});

// Helper function to convert relative paths to absolute paths
const makePathsAbsolute = (nodes: FileNode[], basePath: string): FileNode[] => {
  return nodes.map(node => {
    // If path is already absolute, don't modify it
    const absolutePath = node.path.startsWith('/') ? node.path : `${basePath}/${node.path}`;

    return {
      ...node,
      path: absolutePath,
      children: node.children ? makePathsAbsolute(node.children, basePath) : undefined,
    };
  });
};

// Load directory tree on mount
const loadFileTree = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    // If we have multiple root folders, load each one
    if (props.rootFolders && props.rootFolders.length > 0) {
      const folderTrees = await Promise.all(
        props.rootFolders.map(async folder => {
          const result = await window.electron.files.readDirectory(folder.folderPath);
          if (result.success && result.data) {
            // Convert relative paths to absolute paths
            const childrenWithAbsolutePaths = makePathsAbsolute(result.data, folder.folderPath);

            // Create a root node for this folder
            const folderName = folder.folderPath.split('/').pop() || folder.folderPath;
            return {
              name: folderName,
              path: folder.folderPath,
              type: 'directory' as const,
              children: childrenWithAbsolutePaths,
            };
          }
          return null;
        })
      );

      // Filter out any failed loads and set the tree
      fileTree.value = folderTrees.filter(Boolean) as FileNode[];
    } else if (props.projectPath) {
      // Single project path mode (original behavior)
      const result = await window.electron.files.readDirectory(props.projectPath);

      if (result.success && result.data) {
        fileTree.value = result.data;
      } else {
        error.value = result.error || 'Failed to load file tree';
        fileTree.value = [];
      }
    } else {
      fileTree.value = [];
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    fileTree.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Load file tree when component mounts or props change
watch(
  () => [props.projectPath, props.rootFolders],
  () => {
    loadFileTree();
  },
  { immediate: true, deep: true }
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
            <span class="text-primary-600 font-medium">{{ filteredFileCount }}</span>
            <span class="text-slate-400">/{{ totalFileCount }}</span>
            <span class="ml-1">files</span>
          </template>
          <template v-else>
            <span class="font-medium">{{ totalFileCount }}</span>
            <span class="ml-1">files</span>
          </template>
        </span>
        <div class="flex gap-1">
          <Button
            v-if="rootFolders && rootFolders.length > 0"
            :title="sortTooltip"
            variant="ghost"
            size="icon"
            class="hover:text-primary-600 h-6 px-2 text-xs hover:bg-slate-200/50"
            @click="toggleSort"
          >
            <component :is="sortIcon" :size="16" />
          </Button>
          <Button
            title="Collapse All"
            variant="ghost"
            size="icon"
            class="hover:text-primary-600 h-6 px-2 text-xs hover:bg-slate-200/50"
            @click="handleCollapseAll"
          >
            <ListChevronsDownUp :size="16" />
          </Button>
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
          ref="fileTreeRef"
          :nodes="fileTree"
          :project-path="projectPath || ''"
          :selected-path="selectedFilePath"
          :search-query="searchQuery"
          :filters="filters"
          :matching-file-paths="matchingFilePaths"
          :is-related-folders-mode="isRelatedFoldersMode"
          @select="handleSelect"
          @remove-folder="handleRemoveFolder"
        />
      </div>
    </div>

    <!-- Main content: File viewer -->
    <div class="flex-1">
      <FileViewer :file-path="selectedFilePath" :project-path="projectPath || ''" />
    </div>
  </div>
</template>
