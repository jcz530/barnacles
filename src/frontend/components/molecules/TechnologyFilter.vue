<script setup lang="ts">
import { computed } from 'vue';
import type { Technology } from '../../../shared/types/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Filter } from 'lucide-vue-next';

const props = defineProps<{
  technologies: Technology[];
  selectedTechnologies: string[];
}>();

const emit = defineEmits<{
  'update:selectedTechnologies': [value: string[]];
}>();

const toggleTechnology = (slug: string) => {
  const current = [...props.selectedTechnologies];
  const index = current.indexOf(slug);

  if (index > -1) {
    current.splice(index, 1);
  } else {
    current.push(slug);
  }

  emit('update:selectedTechnologies', current);
};

const clearFilters = () => {
  emit('update:selectedTechnologies', []);
};

const hasFilters = computed(() => props.selectedTechnologies.length > 0);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="relative">
        <Filter class="mr-2 h-4 w-4" />
        Technologies
        <span
          v-if="hasFilters"
          class="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white"
        >
          {{ selectedTechnologies.length }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuLabel>Filter by Technology</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div class="max-h-80 overflow-y-auto">
        <div
          v-for="tech in technologies"
          :key="tech.id"
          class="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-slate-100"
          @click="toggleTechnology(tech.slug)"
        >
          <input
            type="checkbox"
            :checked="selectedTechnologies.includes(tech.slug)"
            class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            @click.stop="toggleTechnology(tech.slug)"
          />
          <div class="flex items-center gap-2">
            <div
              v-if="tech.color"
              class="h-3 w-3 rounded-sm"
              :style="{ backgroundColor: tech.color }"
            />
            <span>{{ tech.name }}</span>
          </div>
        </div>
      </div>
      <DropdownMenuSeparator v-if="hasFilters" />
      <button
        v-if="hasFilters"
        @click="clearFilters"
        class="w-full px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100"
      >
        Clear filters
      </button>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
