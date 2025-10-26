<script setup lang="ts">
import { computed } from 'vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { Filter } from 'lucide-vue-next';
import { type FileCategory, getFileCategories } from '../../../utils/file-types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const props = defineProps<{
  selectedCategories: FileCategory[];
}>();

const emit = defineEmits<{
  'update:selectedCategories': [value: FileCategory[]];
}>();

const categories = getFileCategories();

const toggleCategory = (category: FileCategory) => {
  console.log('togle cate: ', category);
  const current = [...props.selectedCategories];
  const index = current.indexOf(category);

  if (index > -1) {
    current.splice(index, 1);
  } else {
    current.push(category);
  }

  emit('update:selectedCategories', current);
};

const clearFilters = () => {
  emit('update:selectedCategories', []);
};

const hasFilters = computed(() => props.selectedCategories.length > 0);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="relative">
        <Filter class="mr-2 h-4 w-4" />
        File Type
        <span
          v-if="hasFilters"
          class="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white"
        >
          {{ selectedCategories.length }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuLabel>Filter by File Type</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div class="max-h-80 overflow-y-auto">
        <Label
          v-for="category in categories"
          :key="category.value"
          class="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-slate-100"
        >
          <Checkbox
            type="checkbox"
            model:value="selectedCategories.includes(category.value)"
            class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            @update:model-value="() => toggleCategory(category.value)"
          />
          <span>{{ category.label }}</span>
        </Label>
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
