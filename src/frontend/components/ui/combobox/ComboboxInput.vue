<script setup lang="ts">
import { cn } from '@/lib/utils';
import { reactiveOmit } from '@vueuse/core';
import { SearchIcon } from 'lucide-vue-next';
import type { ComboboxInputEmits, ComboboxInputProps } from 'reka-ui';
import { ComboboxInput, useForwardPropsEmits } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<
  ComboboxInputProps & {
    class?: HTMLAttributes['class'];
  }
>();

const emits = defineEmits<ComboboxInputEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="border-input flex h-9 w-full items-center gap-2 rounded-md border px-3 shadow-xs"
  >
    <SearchIcon class="size-4 shrink-0 opacity-50" />
    <ComboboxInput
      data-slot="command-input"
      :class="
        cn(
          'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          props.class
        )
      "
      v-bind="{ ...forwarded, ...$attrs }"
    >
      <slot />
    </ComboboxInput>
  </div>
</template>
