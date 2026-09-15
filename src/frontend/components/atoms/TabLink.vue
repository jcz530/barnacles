<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { cn } from '@/lib/utils';

interface Props {
  to: { name: string; params: Record<string, string> };
  active?: boolean;
  label: string;
}

const props = defineProps<Props>();

/**
 * Classes mirror SegmentedControl's item, which mirrors TabsTrigger, so the
 * three controls stay visually identical.
 */
const linkClasses = computed(() =>
  cn(
    `text-foreground inline-flex h-[calc(100%-1px)] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
    props.active && 'bg-background shadow-sm'
  )
);
</script>

<template>
  <RouterLink :to="to" :class="[linkClasses]" :aria-current="active ? 'page' : undefined">
    {{ label }}
  </RouterLink>
</template>
