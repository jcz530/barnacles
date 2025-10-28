import { computed, ref, type Ref } from 'vue';
import type { FileNode } from '@/types/window';
import { type FileCategory, matchesCategory } from '@/utils/file-types';
import { useFuzzySearch } from './useFuzzySearch';
import type { FilterValue } from '@/components/files/molecules/FileTypeFilter.vue';

interface UseFileTreeOptions {
  fileTree: Ref<FileNode[]>;
  searchQuery: Ref<string>;
  filters: Ref<FilterValue[]>;
}

export function useFileTree({ fileTree, searchQuery, filters }: UseFileTreeOptions) {
  const selectedFile = ref<FileNode | null>(null);

  // Handle file selection
  const handleSelect = (node: FileNode) => {
    if (node.type === 'file') {
      selectedFile.value = node;
    }
  };

  // Computed selected file path
  const selectedFilePath = computed(() => selectedFile.value?.path || null);

  // Extract all unique extensions that exist in the tree
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

  // Flatten the file tree into a list of all file nodes for fuzzy searching
  const allFiles = computed(() => {
    const files: FileNode[] = [];

    const extractFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          files.push(node);
        } else if (node.type === 'directory' && node.children) {
          extractFiles(node.children);
        }
      }
    };

    extractFiles(fileTree.value);
    return files;
  });

  // Use fuzzy search on the flattened file list
  const { filteredItems: fuzzyMatchedFiles } = useFuzzySearch({
    items: allFiles,
    searchQuery: searchQuery,
    fuseOptions: {
      keys: ['name'],
      threshold: 0.4, // Lower = more strict, higher = more fuzzy
      ignoreLocation: true, // Don't care where in the string the match is
    },
  });

  // Create a Set of matching file paths for quick lookup
  const matchingFilePaths = computed(() => {
    // If no search query, all files match
    if (!searchQuery.value || searchQuery.value.trim() === '') {
      return null; // null means "match all"
    }

    return new Set(fuzzyMatchedFiles.value.map(file => file.path));
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
          // Check if file matches search query using fuzzy search results
          const matchesSearch =
            matchingFilePaths.value === null || matchingFilePaths.value.has(node.path);

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

  return {
    selectedFile,
    selectedFilePath,
    handleSelect,
    availableExtensions,
    allFiles,
    matchingFilePaths,
    totalFileCount,
    filteredFileCount,
    hasActiveFilters,
  };
}
