<script setup lang="ts">
import { computed, markRaw, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { utilityRegistry, discoverUtilities } from '@/utilities';
import type { Component } from 'vue';

const route = useRoute();
const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();

const utilityComponent = ref<Component | null>(null);
const utilityName = ref('');
const isLoading = ref(true);
const error = ref<string | null>(null);

const utilityId = computed(() => route.params.utilityId as string);

onMounted(async () => {
  try {
    // Ensure utilities are discovered
    await discoverUtilities();

    // Get the utility registration
    const registration = utilityRegistry.get(utilityId.value);

    if (!registration) {
      error.value = 'Utility not found';
      router.push('/utilities');
      return;
    }

    // Load the component
    utilityName.value = registration.metadata.name;
    const componentModule = await registration.metadata.component();
    // Use markRaw to prevent Vue from making the component reactive
    utilityComponent.value = markRaw(componentModule.default || componentModule);

    // Set breadcrumbs
    setBreadcrumbs([{ label: 'Utilities', to: '/utilities' }, { label: utilityName.value }]);
  } catch (err) {
    console.error('Failed to load utility:', err);
    error.value = 'Failed to load utility';
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div>
    <div v-if="isLoading" class="text-muted-foreground py-12 text-center">
      <p>Loading utility...</p>
    </div>

    <div v-else-if="error" class="text-destructive py-12 text-center">
      <p>{{ error }}</p>
    </div>

    <component :is="utilityComponent" v-else />
  </div>
</template>
