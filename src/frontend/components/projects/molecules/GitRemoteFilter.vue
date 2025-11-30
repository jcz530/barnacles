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
import { GitBranch } from 'lucide-vue-next';

const props = defineProps<{
  availableProviders: string[];
  selectedProviders: string[];
}>();

const emit = defineEmits<{
  'update:selectedProviders': [value: string[]];
}>();

const toggleProvider = (provider: string) => {
  const current = [...props.selectedProviders];
  const index = current.indexOf(provider);

  if (index > -1) {
    current.splice(index, 1);
  } else {
    current.push(provider);
  }

  emit('update:selectedProviders', current);
};

const clearFilters = () => {
  emit('update:selectedProviders', []);
};

const hasFilters = computed(() => props.selectedProviders.length > 0);

// Sort providers with "None" always last
const sortedProviders = computed(() => {
  return [...props.availableProviders].sort((a, b) => {
    if (a === 'None') return 1;
    if (b === 'None') return -1;
    return a.localeCompare(b);
  });
});
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="relative">
        <GitBranch class="mr-2 h-4 w-4" />
        Remote
        <span
          v-if="hasFilters"
          class="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-50"
        >
          {{ selectedProviders.length }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuLabel>Filter by Git Remote</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div class="max-h-80 overflow-y-auto">
        <div
          v-for="provider in sortedProviders"
          :key="provider"
          class="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-slate-100"
          @click="toggleProvider(provider)"
        >
          <input
            type="checkbox"
            :checked="selectedProviders.includes(provider)"
            class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            @click.stop="toggleProvider(provider)"
          />
          <span>{{ provider }}</span>
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
