<script setup lang="ts">
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'bg-card text-card-foreground focus:ring-primary-500 flex flex-col gap-6 rounded-xl border py-6 shadow-sm focus:ring-2 focus-visible:ring-2 focus-visible:outline-none',
        props.class
      )
    "
  >
    <slot />
  </div>
</template>
