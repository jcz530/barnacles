<script setup lang="ts">
import TabLink from '../atoms/TabLink.vue';

export interface Tab {
  name: string;
  label: string;
  value: string;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  routeParams: Record<string, string>;
}

defineProps<Props>();
</script>

<template>
  <div
    class="mb-6 inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500"
  >
    <TabLink
      v-for="tab in tabs"
      :key="tab.value"
      :to="{ name: tab.name, params: routeParams }"
      :active="activeTab === tab.value"
      :label="tab.label"
    />
  </div>
</template>
