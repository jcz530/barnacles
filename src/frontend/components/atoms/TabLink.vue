<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

interface Props {
  to: { name: string; params: Record<string, string> };
  active?: boolean;
  label: string;
}

const props = defineProps<Props>();

const linkClasses = computed(() => {
  const baseClasses =
    'inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap ring-ring transition-all focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';
  const activeClasses = 'text-slate-950 shadow';
  const inactiveClasses = 'hover:bg-slate-200/50';

  return props.active ? `${baseClasses} ${activeClasses}` : `${baseClasses} ${inactiveClasses}`;
});
</script>

<template>
  <RouterLink :to="to" :class="[linkClasses]">
    {{ label }}
  </RouterLink>
</template>
