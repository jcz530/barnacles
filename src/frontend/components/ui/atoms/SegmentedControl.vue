<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue';
import { cn } from '@/lib/utils';

/**
 * A single-choice control styled like the Tabs primitive.
 *
 * Tabs themselves are the wrong tool for a plain selection — they own a panel
 * per value and switch between them — but the segmented look is right for
 * picking one of a few options, so the classes are shared with TabsList and
 * TabsTrigger to keep the two visually identical.
 */
const props = defineProps<{
  options: Array<{ value: T; label: string; icon?: Component }>;
  class?: string;
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <div
    role="radiogroup"
    :class="
      cn(
        'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
        props.class
      )
    "
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :class="
        cn(
          `text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
          model === option.value &&
            'bg-background dark:text-foreground dark:border-input dark:bg-input/30 shadow-sm'
        )
      "
      @click="model = option.value"
    >
      <component :is="option.icon" v-if="option.icon" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>
