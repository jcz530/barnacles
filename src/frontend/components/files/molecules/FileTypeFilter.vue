<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { ChevronDown, ChevronRight, Filter, Search } from 'lucide-vue-next';
import {
  type FileCategory,
  getExtensionsByCategory,
  getFileCategories,
} from '../../../utils/file-types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// Filter value can be either a category or a specific extension
export type FilterValue = FileCategory | string;

const props = defineProps<{
  selectedFilters: FilterValue[];
  availableExtensions?: Set<string>;
}>();

const emit = defineEmits<{
  'update:selectedFilters': [value: FilterValue[]];
}>();

const searchQuery = ref('');
const expandedCategories = ref<Set<FileCategory>>(new Set());
const onlyShowExisting = ref(true); // Default: only show file types that exist in project

const categories = getFileCategories();

// Build nested structure with extensions
const categoryTree = computed(() => {
  return categories
    .map(cat => {
      const allExtensions = getExtensionsByCategory(cat.value);

      // Filter extensions based on onlyShowExisting setting
      const extensions =
        onlyShowExisting.value && props.availableExtensions
          ? allExtensions.filter(ext => props.availableExtensions!.has(ext.toLowerCase()))
          : allExtensions;

      return {
        ...cat,
        extensions,
      };
    })
    .filter(cat => cat.extensions.length > 0); // Only include categories with extensions
});

// Filter categories and extensions based on search
const filteredTree = computed(() => {
  if (!searchQuery.value.trim()) {
    return categoryTree.value;
  }

  const query = searchQuery.value.toLowerCase();
  return categoryTree.value
    .map(cat => {
      const matchesCategory = cat.label.toLowerCase().includes(query);
      const matchingExtensions = cat.extensions.filter(ext => ext.toLowerCase().includes(query));

      if (matchesCategory || matchingExtensions.length > 0) {
        return {
          ...cat,
          extensions: matchesCategory ? cat.extensions : matchingExtensions,
        };
      }
      return null;
    })
    .filter((cat): cat is NonNullable<typeof cat> => cat !== null);
});

const toggleCategory = (category: FileCategory) => {
  const current = [...props.selectedFilters];
  const index = current.indexOf(category);
  const extensions = getExtensionsByCategory(category);

  if (index > -1) {
    // Unchecking category - remove it
    current.splice(index, 1);
  } else {
    // Checking category - add it and remove any individual extensions from this category
    current.push(category);
    // Remove any individual extensions that belong to this category
    extensions.forEach(ext => {
      const extIndex = current.indexOf(ext);
      if (extIndex > -1) {
        current.splice(extIndex, 1);
      }
    });
  }

  emit('update:selectedFilters', current);
};

const toggleExtension = (extension: string, category: FileCategory) => {
  const current = [...props.selectedFilters];
  const extIndex = current.indexOf(extension);
  const catIndex = current.indexOf(category);

  // Remove parent category if it exists
  if (catIndex > -1) {
    current.splice(catIndex, 1);
  }

  if (extIndex > -1) {
    // Unchecking extension
    current.splice(extIndex, 1);
  } else {
    // Checking extension
    current.push(extension);
  }

  emit('update:selectedFilters', current);
};

const toggleCategoryExpanded = (category: FileCategory) => {
  if (expandedCategories.value.has(category)) {
    expandedCategories.value.delete(category);
  } else {
    expandedCategories.value.add(category);
  }
};

const clearFilters = () => {
  emit('update:selectedFilters', []);
};

const isFilterSelected = (filter: FilterValue) => {
  return props.selectedFilters.includes(filter);
};

// Check if a category should be in indeterminate state
const isCategoryIndeterminate = (category: FileCategory): boolean => {
  // If the category itself is selected, not indeterminate
  if (props.selectedFilters.includes(category)) {
    return false;
  }

  const extensions = getExtensionsByCategory(category);
  const selectedExtensions = extensions.filter(ext => props.selectedFilters.includes(ext));

  // Indeterminate if some (but not all) extensions are selected
  return selectedExtensions.length > 0 && selectedExtensions.length < extensions.length;
};

// Check if a category checkbox should be checked
const isCategoryChecked = (category: FileCategory): boolean | 'indeterminate' => {
  // Checked if the category itself is selected
  if (props.selectedFilters.includes(category)) {
    return true;
  }
  if (isCategoryIndeterminate(category)) {
    return 'indeterminate';
  }

  // Also checked if ALL extensions are selected
  const extensions = getExtensionsByCategory(category);
  if (extensions.length === 0) return false;

  const selectedExtensions = extensions.filter(ext => props.selectedFilters.includes(ext));
  return selectedExtensions.length === extensions.length;
};

const hasFilters = computed(() => props.selectedFilters.length > 0);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="relative">
        <Filter class="mr-2 h-4 w-4" />
        File Type
        <span
          v-if="hasFilters"
          class="bg-success-400/40 ml-2 rounded-full px-2 py-0.5 text-xs text-white"
        >
          {{ selectedFilters.length }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-64">
      <DropdownMenuLabel>Filter by File Type</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <!-- Only Show Existing Toggle -->
      <div class="px-2 py-2">
        <Label class="flex cursor-pointer items-center gap-2">
          <Checkbox v-model="onlyShowExisting" class="h-3.5 w-3.5 shadow-none" />
          <span class="text-sm text-slate-500">Only show types in project</span>
        </Label>
      </div>
      <DropdownMenuSeparator />

      <!-- Search Input -->
      <div class="px-2 pl-4">
        <div class="relative">
          <Search class="absolute top-2.5 left-2 h-4 w-4 text-slate-400" />
          <Input
            v-model="searchQuery"
            placeholder="Search file types..."
            class="h-9 border-2 pl-8 text-sm shadow-none"
          />
        </div>
      </div>
      <DropdownMenuSeparator />

      <!-- Category Tree -->
      <div class="max-h-80 overflow-y-auto">
        <div v-for="category in filteredTree" :key="category.value" class="mb-1">
          <!-- Category Header -->
          <div class="flex items-center">
            <div
              @click="toggleCategoryExpanded(category.value)"
              class="flex h-8 flex-1 items-center gap-1 rounded-sm px-2 text-sm hover:bg-slate-100"
            >
              <component
                :is="expandedCategories.has(category.value) ? ChevronDown : ChevronRight"
                class="h-4 w-4 text-slate-500"
              />
              <Label @click.stop class="ml-4">
                <Checkbox
                  :model-value="isCategoryChecked(category.value)"
                  class="h-4 w-4 shadow-none"
                  @click.stop
                  @update:model-value="() => toggleCategory(category.value)"
                />
                <span class="font-medium">{{ category.label }}</span>
              </Label>
            </div>
          </div>

          <!-- Extension Children -->
          <div
            v-if="expandedCategories.has(category.value)"
            class="mt-1 ml-7 space-y-0.5 border-l-2 border-slate-200 pl-2"
          >
            <Label
              v-for="ext in category.extensions"
              :key="`${category.value}-${ext}`"
              class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-slate-100"
            >
              <Checkbox
                :model-value="isFilterSelected(ext)"
                class="h-3.5 w-3.5 shadow-none"
                @update:model-value="() => toggleExtension(ext, category.value)"
              />
              <span class="font-mono text-xs text-slate-600">.{{ ext }}</span>
            </Label>
          </div>
        </div>

        <!-- No results message -->
        <div v-if="filteredTree.length === 0" class="px-2 py-4 text-center text-sm text-slate-500">
          No file types found
        </div>
      </div>

      <DropdownMenuSeparator v-if="hasFilters" />
      <button
        v-if="hasFilters"
        @click="clearFilters"
        class="w-full rounded-sm px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100"
      >
        Clear filters
      </button>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
