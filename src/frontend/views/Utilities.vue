<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { discoverUtilities, getAllUtilities } from '@/utilities';
import UtilitiesGrid from '@/components/utilities/organisms/UtilitiesGrid.vue';
import type { UtilityMetadata } from '@/utilities/types';

const { setBreadcrumbs } = useBreadcrumbs();

const utilities = ref<UtilityMetadata[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  setBreadcrumbs([{ label: 'Utilities' }]);

  // Discover and load all utilities
  try {
    await discoverUtilities();
    utilities.value = getAllUtilities();
  } catch (error) {
    console.error('Failed to load utilities:', error);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">Utilities</h2>
        <p class="text-muted-foreground mt-1">
          A collection of helpful tools and converters for your development workflow
        </p>
      </div>

      <div v-if="isLoading" class="text-muted-foreground py-12 text-center">
        <p>Loading utilities...</p>
      </div>

      <div v-else-if="utilities.length === 0" class="text-muted-foreground py-12 text-center">
        <p class="text-lg">No utilities available</p>
        <p class="mt-2 text-sm">Check back later for new utilities</p>
      </div>

      <UtilitiesGrid v-else :utilities="utilities" />
    </section>
  </div>
</template>
