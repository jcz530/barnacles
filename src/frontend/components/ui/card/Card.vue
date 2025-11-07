<script setup lang="ts">
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'vue';
import { RouteLocationRaw } from 'vue-router';

const props = defineProps<{
  class?: HTMLAttributes['class'];
  to?: RouteLocationRaw;
}>();
</script>

<template>
  <div
    data-slot="card"
    :class="[
      cn(
        'bg-card text-card-foreground focus:ring-primary-500 flex flex-col gap-6 rounded-xl border py-6 shadow-sm focus:ring-2 focus-visible:ring-2 focus-visible:outline-none',
        props.class
      ),
      to && 'relative',
    ]"
  >
    <RouterLink
      v-if="to"
      class="focus-visible:ring-ring focus:ring-ring absolute inset-0 z-50 rounded-xl outline-none focus:ring-2 focus-visible:ring-2 focus-visible:ring-offset-2"
      :to="to"
    />
    <slot />
  </div>
</template>
