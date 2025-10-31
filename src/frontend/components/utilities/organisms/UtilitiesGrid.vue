<script setup lang="ts">
import { computed, ref } from 'vue';
import { Input } from '@/components/ui/input';
import UtilityCard from '../molecules/UtilityCard.vue';
import type { UtilityMetadata } from '@/utilities/types';

interface Props {
  utilities: UtilityMetadata[];
}

const props = defineProps<Props>();

const searchQuery = ref('');

const filteredUtilities = computed(() => {
  if (!searchQuery.value) {
    return props.utilities;
  }

  const query = searchQuery.value.toLowerCase();
  return props.utilities.filter(
    utility =>
      utility.name.toLowerCase().includes(query) ||
      utility.description.toLowerCase().includes(query) ||
      utility.tags?.some(tag => tag.toLowerCase().includes(query))
  );
});

const categorizedUtilities = computed(() => {
  const categories = new Map<string, UtilityMetadata[]>();

  filteredUtilities.value.forEach(utility => {
    const category = utility.category || 'Other';
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(utility);
  });

  return Array.from(categories.entries()).map(([category, utilities]) => ({
    category,
    utilities,
  }));
});

const hasResults = computed(() => filteredUtilities.value.length > 0);
</script>

<template>
  <div class="space-y-6">
    <!-- Search Bar -->
    <div class="max-w-md">
      <Input v-model="searchQuery" type="search" placeholder="Search utilities..." class="w-full" />
    </div>

    <!-- No Results -->
    <div v-if="!hasResults" class="text-muted-foreground py-12 text-center">
      <p class="text-lg">No utilities found matching "{{ searchQuery }}"</p>
      <p class="mt-2 text-sm">Try adjusting your search terms</p>
    </div>

    <!-- Utilities Grid by Category -->
    <div v-else class="space-y-8">
      <div v-for="{ category, utilities } in categorizedUtilities" :key="category">
        <h3 class="mb-4 text-lg font-semibold">{{ category }}</h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <UtilityCard v-for="utility in utilities" :key="utility.id" :utility="utility" />
        </div>
      </div>
    </div>
  </div>
</template>
