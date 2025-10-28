<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FileTree from '@/components/files/organisms/FileTree.vue';
import FileViewer from '@/components/files/organisms/FileViewer.vue';
import FileSearchInput from '@/components/files/molecules/FileSearchInput.vue';
import FileTypeFilter, { type FilterValue } from '@/components/files/molecules/FileTypeFilter.vue';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { FileNode } from '@/types/window';
import { ListChevronsDownUp } from 'lucide-vue-next';
import { useFileTree } from '@/composables/useFileTree';
import { CONFIG_FILE_PATHS } from '../../shared/constants/config-files';

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

// Recursively prepend base path to all children paths
const prependBasePath = (nodes: FileNode[], basePath: string): FileNode[] => {
  return nodes.map(node => ({
    ...node,
    path: `${basePath}/${node.path}`,
    children: node.children ? prependBasePath(node.children, basePath) : undefined,
  }));
};

// Build file tree from config file paths
const buildConfigFileTree = async (): Promise<FileNode[]> => {
  const fs = window.electron.files;
  const rootNodes: Map<string, FileNode> = new Map();

  for (const configPath of CONFIG_FILE_PATHS) {
    try {
      // Check if path is a directory
      if (configPath.endsWith('/')) {
        // Read entire directory recursively (IPC will handle ~ expansion)
        const dirPathWithoutSlash = configPath.slice(0, -1);
        const result = await fs.readDirectory(dirPathWithoutSlash);
        if (result.success && result.data) {
          // Prepend the base path to all children since readDirectory returns relative paths
          const childrenWithFullPaths = prependBasePath(result.data, dirPathWithoutSlash);

          // Add to root with relative name
          const dirName = configPath.split('/').filter(Boolean).pop() || configPath;
          rootNodes.set(configPath, {
            name: dirName,
            path: dirPathWithoutSlash,
            type: 'directory',
            children: childrenWithFullPaths,
          });
        }
      } else {
        // Individual file - try to read it to see if it exists (IPC will handle ~ expansion)
        const fileResult = await fs.readFile(configPath);
        if (fileResult.success && fileResult.data) {
          const fileName = configPath.split('/').pop() || configPath;
          const extension = fileName.includes('.') ? fileName.split('.').pop() : undefined;

          rootNodes.set(configPath, {
            name: fileName,
            path: configPath,
            type: 'file',
            size: fileResult.data.size,
            extension,
          });
        }
      }
    } catch (err) {
      // File doesn't exist or can't be read - skip it
      console.debug(`Skipping ${configPath}: ${err}`);
    }
  }

  return Array.from(rootNodes.values());
};

// Load config files on mount
const loadConfigFiles = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    fileTree.value = await buildConfigFileTree();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load config files';
    fileTree.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadConfigFiles();
});

// Collapse all directories in the tree
const handleCollapseAll = () => {
  fileTreeRef.value?.collapseAll();
};
</script>

<template>
  <div class="mt-6 flex h-[calc(100vh-5rem)] flex-col">
    <div class="mb-4">
      <h1 class="text-2xl font-semibold text-slate-900">Config Files</h1>
      <p class="mt-1 text-sm text-slate-600">
        View common developer configuration files from your home directory
      </p>
    </div>

    <div class="flex flex-1 overflow-hidden rounded-lg border border-slate-200">
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

          <!-- Empty state -->
          <div v-else-if="fileTree.length === 0" class="p-4">
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p class="text-sm text-slate-600">No config files found</p>
            </div>
          </div>

          <!-- File tree -->
          <FileTree
            v-else
            ref="fileTreeRef"
            :nodes="fileTree"
            project-path=""
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
        <FileViewer :file-path="selectedFilePath" project-path="" />
      </div>
    </div>
  </div>
</template>
