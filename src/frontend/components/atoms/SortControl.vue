<script setup lang="ts">
import { ArrowDownAZ, ArrowUpAZ, Calendar, HardDrive } from 'lucide-vue-next';
import { computed } from 'vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

type SortField = 'name' | 'lastModified' | 'size';
type SortDirection = 'asc' | 'desc';

const props = defineProps<{
  sortField: SortField;
  sortDirection: SortDirection;
}>();

const emit = defineEmits<{
  'update:sortField': [field: SortField];
  'update:sortDirection': [direction: SortDirection];
}>();

const sortOptions = [
  { value: 'name', label: 'Name', icon: ArrowDownAZ },
  { value: 'lastModified', label: 'Last Modified', icon: Calendar },
  { value: 'size', label: 'Size', icon: HardDrive },
] as const;

const currentSortOption = computed(() => {
  return sortOptions.find(opt => opt.value === props.sortField);
});

const toggleDirection = () => {
  emit('update:sortDirection', props.sortDirection === 'asc' ? 'desc' : 'asc');
};
</script>

<template>
  <div class="flex items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm" class="gap-2">
          <component :is="currentSortOption?.icon" class="h-4 w-4" />
          Sort: {{ currentSortOption?.label }}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          :model-value="sortField"
          @update:model-value="emit('update:sortField', $event as SortField)"
        >
          <DropdownMenuRadioItem
            v-for="option in sortOptions"
            :key="option.value"
            :value="option.value"
          >
            <component :is="option.icon" class="mr-2 h-4 w-4" />
            {{ option.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <Button variant="outline" size="sm" @click="toggleDirection" class="px-2">
      <ArrowUpAZ v-if="sortDirection === 'asc'" class="h-4 w-4" />
      <ArrowDownAZ v-else class="h-4 w-4" />
    </Button>
  </div>
</template>
