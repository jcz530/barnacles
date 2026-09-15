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
  <!-- Container classes kept identical to TabsList and SegmentedControl. -->
  <div
    class="bg-muted text-muted-foreground mb-6 inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]"
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
