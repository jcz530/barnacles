<script setup lang="ts">
import { cn } from '@/lib/utils';
import { computed, HTMLAttributes } from 'vue';
import { RouteLocationRaw } from 'vue-router';

const props = defineProps<{
  class?: HTMLAttributes['class'];
  to?: RouteLocationRaw;
  interactable?: boolean;
}>();

const interactableClasses = computed(() => {
  if (!props.to && !props.interactable) return '';

  return [
    'cursor-pointer',
    'focus:ring-ring focus:ring-2 focus-visible:ring-2 focus-visible:outline-none',
    'hover:ring-ring hover:shadow-lg hover:ring-2',
  ];
});
</script>

<template>
  <div
    data-slot="card"
    :class="[
      cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
        interactableClasses,
        props.class,
        to && 'relative'
      ),
    ]"
  >
    <RouterLink
      v-if="to"
      :class="[
        'absolute inset-0 z-50 rounded-xl outline-none',
        'focus-visible:ring-ring focus:ring-ring focus:ring-2 focus-visible:ring-2',
        'focus-visible:ring-offset-2',
      ]"
      :to="to"
    />
    <slot />
  </div>
</template>
